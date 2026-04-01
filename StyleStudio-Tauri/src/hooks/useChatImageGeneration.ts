import { useState, useCallback } from 'react';
import { Session } from '../types/session';
import { ChatMessage } from '../types/chat';
import { logger } from '../lib/logger';

// 최대 재시도 횟수
const MAX_RETRIES = 2;
// 재시도 대기 시간 (ms)
const RETRY_DELAY = 5000;

interface GenerationResult {
  content: string;
  images: string[];
  isGeneratedImage: boolean;
}

interface UseChatImageGenerationReturn {
  isGenerating: boolean;
  generationStatus: string;
  generateFromChat: (userMessage: string, userImages?: string[]) => Promise<GenerationResult>;
  summarizeMessages: (messages: ChatMessage[], existingSummary?: string) => Promise<string>;
}

export function useChatImageGeneration(
  session: Session,
  apiKey: string
): UseChatImageGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const chatData = session.chatData;

  // multi-turn contents 배열 구성
  const buildContents = useCallback((additionalUserText?: string, additionalUserImages?: string[]) => {
    const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

    // 요약이 있으면 첫 번째 컨텍스트로 추가
    if (chatData?.summary) {
      contents.push({
        role: 'user',
        parts: [{ text: `[이전 대화 요약]\n${chatData.summary}\n\n위 내용은 이전 대화의 요약입니다. 이 맥락을 기반으로 대화를 이어가주세요.` }],
      });
      contents.push({
        role: 'model',
        parts: [{ text: '네, 이전 대화 내용을 이해했습니다. 이어서 도와드리겠습니다.' }],
      });
    }

    // 요약 이후의 메시지들만 포함
    const startIndex = (chatData?.summarizedUpTo ?? -1) + 1;
    const messages = chatData?.messages?.slice(startIndex) ?? [];

    for (const msg of messages) {
      if (msg.role === 'summary') continue;
      const parts: Array<Record<string, unknown>> = [];
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      if (msg.images && msg.images.length > 0) {
        for (const img of msg.images) {
          const base64Data = img.includes(',') ? img.split(',')[1] : img;
          parts.push({ inline_data: { mime_type: 'image/png', data: base64Data } });
        }
      }
      if (parts.length > 0) {
        contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts });
      }
    }

    // 현재 사용자 메시지 추가
    if (additionalUserText || (additionalUserImages && additionalUserImages.length > 0)) {
      const userParts: Array<Record<string, unknown>> = [];
      if (additionalUserText) {
        userParts.push({ text: additionalUserText });
      }
      if (additionalUserImages) {
        for (const img of additionalUserImages) {
          const base64Data = img.includes(',') ? img.split(',')[1] : img;
          userParts.push({ inline_data: { mime_type: 'image/png', data: base64Data } });
        }
      }
      contents.push({ role: 'user', parts: userParts });
    }

    return contents;
  }, [chatData]);

  // 채팅 기반 이미지/텍스트 생성
  const generateFromChat = useCallback(async (
    userMessage: string,
    userImages?: string[]
  ): Promise<GenerationResult> => {
    if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');

    setIsGenerating(true);
    setGenerationStatus('응답 생성 중...');

    const imageModel = chatData?.settings?.imageModel ?? 'gemini-3-pro-image-preview';
    const aspectRatio = chatData?.settings?.aspectRatio ?? '1:1';
    const contents = buildContents(userMessage, userImages);

    const requestBody = {
      contents,
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio },
      },
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          setGenerationStatus(`재시도 중... (${attempt}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = (errorData as Record<string, Record<string, string>>)?.error?.message || `HTTP ${response.status}`;
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            logger.warn(`⚠️ 서버 에러 (${response.status}), 재시도 예정...`);
            lastError = new Error(errorMessage);
            continue;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        const candidate = (data as Record<string, Array<Record<string, Record<string, Array<Record<string, unknown>>>>>>)?.candidates?.[0];
        if (!candidate?.content?.parts) {
          throw new Error('응답에서 콘텐츠를 찾을 수 없습니다.');
        }

        let textContent = '';
        const generatedImages: string[] = [];

        for (const part of candidate.content.parts) {
          if (part.text) {
            textContent += part.text as string;
          }
          if (part.inlineData) {
            const inlineData = part.inlineData as Record<string, string>;
            generatedImages.push(`data:${inlineData.mimeType};base64,${inlineData.data}`);
          }
        }

        setIsGenerating(false);
        setGenerationStatus('');
        return { content: textContent, images: generatedImages, isGeneratedImage: generatedImages.length > 0 };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt >= MAX_RETRIES) break;
      }
    }

    setIsGenerating(false);
    setGenerationStatus('');
    throw lastError || new Error('이미지 생성에 실패했습니다.');
  }, [apiKey, chatData, buildContents]);

  // 메시지 요약 (Gemini 2.5 Flash 사용)
  const summarizeMessages = useCallback(async (
    messagesToSummarize: ChatMessage[],
    existingSummary?: string
  ): Promise<string> => {
    if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');

    const conversationText = messagesToSummarize
      .filter(m => m.role !== 'summary')
      .map(m => {
        const role = m.role === 'user' ? '사용자' : 'AI';
        const imageNote = m.images?.length ? ` [이미지 ${m.images.length}개 포함]` : '';
        return `${role}: ${m.content}${imageNote}`;
      })
      .join('\n');

    const prompt = existingSummary
      ? `다음은 이전 대화 요약과 이후 추가된 대화입니다. 전체 맥락을 하나의 요약으로 통합해주세요.\n\n[이전 요약]\n${existingSummary}\n\n[추가 대화]\n${conversationText}\n\n한국어로 핵심 내용을 3-5문장으로 요약해주세요. 이미지 생성 요청과 결과도 포함해주세요.`
      : `다음 대화를 한국어로 핵심 내용 3-5문장으로 요약해주세요. 이미지 생성 요청과 결과도 포함해주세요.\n\n${conversationText}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['TEXT'] },
          }),
        }
      );

      if (!response.ok) throw new Error(`요약 실패: HTTP ${response.status}`);

      const data = await response.json();
      const text = (data as Record<string, Array<Record<string, Record<string, Array<Record<string, string>>>>>>)
        ?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('요약 응답이 비어있습니다.');

      logger.info('📝 대화 요약 생성 완료');
      return text;
    } catch (error) {
      logger.error('❌ 대화 요약 실패:', error);
      throw error;
    }
  }, [apiKey]);

  return { isGenerating, generationStatus, generateFromChat, summarizeMessages };
}
