import { SessionType } from '../types/session';

interface ImageGenerationParams {
  prompt: string; // 서술적 문장 권장
  referenceImages?: string[]; // base64 이미지 배열 (최대 14개)
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  imageSize?: '1K' | '2K' | '4K'; // Gemini 3 Pro만 지원
  negativePrompt?: string; // 피해야 할 요소
  sessionType?: SessionType; // 세션 타입 (CHARACTER/STYLE)
}

interface GenerationCallbacks {
  onProgress?: (status: string) => void;
  onComplete: (imageBase64: string, textResponse?: string) => void;
  onError: (error: Error) => void;
}

export function useGeminiImageGenerator() {
  const generateImage = async (
    apiKey: string,
    params: ImageGenerationParams,
    callbacks: GenerationCallbacks
  ) => {
    try {
      // API Key 검증
      const cleanApiKey = String(apiKey || '').trim();
      if (!cleanApiKey) {
        throw new Error('API Key가 비어있습니다');
      }

      console.log('🎨 이미지 생성 시작');
      console.log('   - 프롬프트 길이:', params.prompt.length);
      console.log('   - 참조 이미지 개수:', params.referenceImages?.length || 0);
      console.log('   - 비율:', params.aspectRatio || '1:1');
      console.log('   - 크기:', params.imageSize || '2K');

      callbacks.onProgress?.('이미지 생성 요청 중...');

      // Gemini 3 Pro Image Preview API 엔드포인트
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${cleanApiKey}`;

      // contents 배열 구성: [참조 이미지들..., 프롬프트]
      const parts: any[] = [];

      // 1. 참조 이미지가 있으면 먼저 추가 (최대 14개)
      const hasReferenceImages = params.referenceImages && params.referenceImages.length > 0;

      if (hasReferenceImages) {
        const maxImages = Math.min(params.referenceImages.length, 14);
        console.log(`   - 참조 이미지 ${maxImages}개 추가 중...`);

        for (let i = 0; i < maxImages; i++) {
          const imageBase64 = params.referenceImages[i];

          // Base64에서 data URL prefix 제거
          const base64Data = imageBase64.includes(',')
            ? imageBase64.split(',')[1]
            : imageBase64;

          // MIME 타입 추출
          const mimeMatch = imageBase64.match(/data:([^;]+);base64/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          });
        }
      }

      // 2. 프롬프트 추가 (참조 이미지가 있으면 일관성 강조)
      let fullPrompt = '';

      if (hasReferenceImages && params.sessionType === 'CHARACTER') {
        // 캐릭터 세션: 캐릭터 완벽 유지 + 흰색 배경 강제
        fullPrompt = `Generate an image of the EXACT SAME CHARACTER shown in the reference images above.

ABSOLUTE REQUIREMENTS (DO NOT DEVIATE):
- Maintain 100% IDENTICAL character features: face structure, facial features, hairstyle, hair color, eye shape, eye color, skin tone, clothing/outfit details
- The character must look EXACTLY like the reference - same person, same style, same appearance
- Keep the EXACT SAME art style, drawing technique, line quality, and visual aesthetic

CRITICAL BODY PROPORTIONS (MUST BE IDENTICAL):
- Head-to-body ratio MUST be exactly the same as reference
- Arm length MUST be exactly the same as reference (measure where hands reach when arms hang down)
- Leg length MUST be exactly the same as reference (same proportion to total body height)
- Torso shape and length MUST be exactly the same as reference
- Hand and finger style MUST be exactly the same as reference
- DO NOT make arms or legs longer or shorter than the reference
- DO NOT change body proportions in any way

Background: PURE WHITE (#FFFFFF) - no gradients, no shadows, no other colors
Only the character's pose, expression, or action can change as specified below:

${params.prompt}`;
      } else if (hasReferenceImages) {
        // 스타일 세션: 스타일 일관성 유지
        fullPrompt = `Generate an image with the EXACT SAME STYLE and visual characteristics shown in the reference images above.

CRITICAL REQUIREMENTS:
- Maintain the same art style, technique, color palette, and visual aesthetic
- Keep the same drawing/rendering style and quality
- Only the subject, composition, or scene can change as specified below

Style description and subject:
${params.prompt}`;
      } else {
        // 참조 이미지가 없을 때: 일반 프롬프트
        fullPrompt = params.prompt;
      }

      // Negative Prompt가 있으면 프롬프트에 명시
      if (params.negativePrompt && params.negativePrompt.trim()) {
        fullPrompt += `\n\nAvoid: ${params.negativePrompt}`;
      }

      parts.push({ text: fullPrompt });

      const requestBody = {
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['IMAGE'], // 이미지만 응답
          imageConfig: {
            aspectRatio: params.aspectRatio || '1:1',
            imageSize: params.imageSize || '2K',
          },
        },
      };

      console.log('🌐 API 요청 전송...');
      callbacks.onProgress?.('Gemini가 이미지를 생성하고 있습니다...');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API 오류:', response.status, errorText);
        throw new Error(`API 오류 (${response.status}): ${errorText}`);
      }

      callbacks.onProgress?.('이미지 생성 완료, 로딩 중...');

      const result = await response.json();
      console.log('✅ Gemini 응답 수신');

      // 응답 파싱: candidates[0].content.parts[]
      const responseParts = result.candidates?.[0]?.content?.parts || [];

      let imageBase64 = '';
      let textResponse = '';

      for (const part of responseParts) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data;
          console.log('   - 이미지 데이터 수신 (길이:', imageBase64.length, ')');
        } else if (part.text) {
          textResponse += part.text;
        }
      }

      if (!imageBase64) {
        console.error('❌ 생성된 이미지 없음');
        console.error('   - 응답:', JSON.stringify(result, null, 2));
        throw new Error('생성된 이미지가 없습니다');
      }

      console.log('✅ 이미지 생성 완료!');
      callbacks.onComplete(imageBase64, textResponse);
    } catch (error) {
      console.error('이미지 생성 오류:', error);
      callbacks.onError(
        error instanceof Error ? error : new Error('알 수 없는 오류가 발생했습니다')
      );
    }
  };

  return { generateImage };
}
