import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Download, MessageCircle } from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { Session } from '../../types/session';
import { useChatSession, RECENT_MESSAGES_TO_KEEP } from '../../hooks/useChatSession';
import { useChatImageGeneration } from '../../hooks/useChatImageGeneration';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatSettings } from './ChatSettings';

interface ChatPanelProps {
  session: Session;
  apiKey: string;
  onSessionUpdate: (session: Session) => void;
}

/** 채팅 패널 메인 컴포넌트 */
export function ChatPanel({ session, apiKey, onSessionUpdate }: ChatPanelProps) {
  const {
    messages,
    settings,
    summary,
    needsSummarization,
    addMessage,
    deleteMessage,
    updateSettings,
    markSummarized,
  } = useChatSession(session, onSessionUpdate);

  const { isGenerating, generateFromChat, summarizeMessages } = useChatImageGeneration(session, apiKey);

  // 이미지 미리보기 모달 상태
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 메시지 스크롤 영역 ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 새 메시지 추가 시 하단으로 자동 스크롤
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length]);

  // 메시지 전송 핸들러
  const handleSend = useCallback(async (text: string, images: string[]) => {
    // 1. 사용자 메시지 즉시 추가
    addMessage('user', text, images.length > 0 ? images : undefined);

    try {
      // 2. AI 응답 생성
      const result = await generateFromChat(text, images.length > 0 ? images : undefined);

      // 3. AI 응답 메시지 추가
      addMessage(
        'assistant',
        result.content,
        result.images.length > 0 ? result.images : undefined,
        result.isGeneratedImage,
      );

      // 4. 요약 필요 여부 확인 후 처리
      if (needsSummarization) {
        const totalMessages = messages.length + 2; // user + assistant 추가분
        const summarizeUpToIndex = totalMessages - RECENT_MESSAGES_TO_KEEP - 1;
        if (summarizeUpToIndex >= 0) {
          const messagesToSummarize = messages.slice(0, summarizeUpToIndex + 1);
          if (messagesToSummarize.length > 0) {
            try {
              const summaryText = await summarizeMessages(messagesToSummarize, summary);
              markSummarized(summaryText, summarizeUpToIndex);
            } catch (err) {
              console.error('요약 실패:', err);
            }
          }
        }
      }
    } catch (error) {
      // 5. 에러 발생 시 에러 메시지 추가
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      addMessage('assistant', `오류가 발생했습니다: ${errorMessage}`);
    }
  }, [addMessage, generateFromChat, needsSummarization, messages, summary, summarizeMessages, markSummarized]);

  // 이미지 저장 (Tauri 다이얼로그 + 파일 쓰기)
  const handleSaveImage = useCallback(async (imageBase64: string) => {
    try {
      const filePath = await save({
        filters: [{ name: 'PNG 이미지', extensions: ['png'] }],
        defaultPath: 'generated-image.png',
      });
      if (!filePath) return;

      // base64 데이터에서 순수 데이터 추출
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      await writeFile(filePath, bytes);
    } catch (err) {
      console.error('이미지 저장 실패:', err);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* 상단 설정 바 */}
      <ChatSettings settings={settings} onSettingsChange={updateSettings} />

      {/* 메시지 영역 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-gradient-to-b from-gray-50 to-white"
      >
        {/* 요약 배너 */}
        {summary && (
          <ChatMessage
            message={{
              id: 'summary',
              role: 'summary',
              content: summary,
              timestamp: new Date().toISOString(),
            }}
            onDelete={() => {}}
            onImageClick={setPreviewImage}
          />
        )}

        {/* 빈 상태 */}
        {messages.length === 0 && !summary && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm text-center leading-relaxed">
              대화를 시작해보세요!
              <br />
              이미지 생성을 요청하거나 이미지를 첨부하여 대화할 수 있습니다.
            </p>
          </div>
        )}

        {/* 메시지 목록 */}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onDelete={deleteMessage}
            onImageClick={setPreviewImage}
          />
        ))}
      </div>

      {/* 하단 입력 영역 */}
      <ChatInput
        onSend={handleSend}
        isGenerating={isGenerating}
        disabled={!apiKey}
      />

      {/* 이미지 미리보기 모달 */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
          onClick={() => setPreviewImage(null)}
        >
          {/* 닫기 버튼 */}
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* 저장 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSaveImage(previewImage);
            }}
            className="absolute top-4 right-16 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <Download className="w-6 h-6" />
          </button>

          {/* 이미지 */}
          <img
            src={previewImage}
            alt="미리보기"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
