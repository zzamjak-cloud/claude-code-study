import { SessionType } from '../types/session';

interface ImageGenerationParams {
  prompt: string; // 서술적 문장 권장
  referenceImages?: string[]; // base64 이미지 배열 (최대 14개)
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  imageSize?: '1K' | '2K' | '4K'; // Gemini 3 Pro만 지원
  negativePrompt?: string; // 피해야 할 요소
  sessionType?: SessionType; // 세션 타입 (CHARACTER/STYLE)

  // 고급 설정
  seed?: number; // 재현성을 위한 시드 값
  temperature?: number; // 창의성 제어 (0.0 ~ 2.0)
  topK?: number; // 샘플링 다양성
  topP?: number; // 누적 확률 임계값 (0.0 ~ 1.0)
  referenceStrength?: number; // 참조 이미지 영향력 (0.0 ~ 1.0, 높을수록 참조 이미지를 강하게 따름)
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

      if (hasReferenceImages && params.referenceImages) {
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
        // 캐릭터 세션: 포즈 변경 최우선 + 캐릭터 외형/비율 완벽 복사
        fullPrompt = `🚨 MISSION: Draw the EXACT SAME character from reference images, but in a NEW POSE.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: APPLY NEW POSE (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEW POSE TO DRAW: "${params.prompt || 'standing naturally, neutral expression'}"

⚠️ CRITICAL POSE INSTRUCTIONS:
- "looking up" / "고개를 젖히고" = Head tilted backward, neck stretched, face pointing upward to sky
- "bowing" / "인사하고" = Upper body bent forward at waist, head down
- "sitting" / "앉아있고" = Legs bent, bottom on ground or chair
- "running" / "달리고" = One leg forward, one back, arms pumping, dynamic motion

🎯 FOLLOW THE POSE DESCRIPTION LITERALLY. The reference images show a DIFFERENT pose - IGNORE their pose completely.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: COPY CHARACTER APPEARANCE 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

While drawing the NEW pose, copy these features EXACTLY:

🔒 BODY PROPORTIONS (NEVER CHANGE THESE):
- Head-to-body ratio: Count heads in reference (e.g., 2-head, 3-head, 8-head) → USE EXACT SAME RATIO
- Leg length: Measure legs vs torso in reference → COPY EXACT RATIO
- If legs are SHORT in reference → Keep them SHORT
- If legs are LONG in reference → Keep them LONG
- Arm length, torso height, limb thickness → ALL identical to reference
- Overall "chibi" or "realistic" style → MUST match reference

🔒 HAIR (Copy every strand):
- Hairstyle, bangs/fringe, length, color
- DO NOT omit bangs if present in reference

🔒 FACE:
- Eye style, nose, mouth, face shape

🔒 CLOTHING:
- Outfit design, colors, accessories

🔒 ART STYLE:
- Line quality, shading, coloring technique

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: FRAMING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Draw FULL BODY (head to feet visible)
- White background
- Do NOT crop legs or body

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FINAL CHECK BEFORE GENERATING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Did you draw the NEW pose correctly? (Step 1)
2. Did you keep leg length IDENTICAL to reference? (Not longer, not shorter)
3. Did you keep head-to-body ratio IDENTICAL to reference?
4. Did you include all hair details (especially bangs)?
5. Is the full body visible?

If reference shows SHORT legs (chibi/casual style) → Your output MUST also have SHORT legs.
If reference shows LONG legs (realistic style) → Your output MUST also have LONG legs.

NEVER "improve" or "normalize" body proportions. COPY them EXACTLY.`;
      } else if (hasReferenceImages) {
        // 스타일 세션: 스타일 일관성 최우선
        fullPrompt = `🎨 ABSOLUTE PRIORITY: REPLICATE THE VISUAL STYLE SHOWN IN THE REFERENCE IMAGES ABOVE
This is your PRIMARY and MOST IMPORTANT task. Everything else is secondary.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 MANDATORY STYLE REPLICATION (NON-NEGOTIABLE):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a STYLE CLONING AI. Your job is to PERFECTLY COPY the visual style shown in the reference images.

CRITICAL REQUIREMENTS - These OVERRIDE all other instructions:

1. ART STYLE & TECHNIQUE:
   - Copy the EXACT drawing/painting technique
   - Match the artistic approach precisely
   - Use the SAME level of realism/stylization
   - Replicate the artist's signature style

2. COLOR & PALETTE:
   - Use the EXACT color palette from references
   - Match color saturation, brightness, contrast
   - Copy color relationships and harmonies
   - Replicate color application technique

3. LINES & EDGES:
   - Match line weight, thickness, variation
   - Copy line quality (smooth/rough/sketchy)
   - Replicate edge treatment
   - Use same line style throughout

4. SHADING & LIGHTING:
   - Copy shading technique precisely
   - Match light source and direction
   - Replicate shadow style and density
   - Use same highlights approach

5. TEXTURE & SURFACE:
   - Match material rendering style
   - Copy texture detail level
   - Replicate surface treatment
   - Use same texture techniques

6. OVERALL AESTHETIC:
   - Maintain the visual "feel"
   - Match the mood and atmosphere
   - Copy the artistic signature
   - Keep the same visual identity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL WARNING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO NOT:
- Add your own style interpretation
- Change the visual aesthetic
- Use different techniques
- Alter the color approach
- Modify the artistic style

The reference images are YOUR STYLE BIBLE. Follow them EXACTLY.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Subject/Content (Secondary - Apply with the style above):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${params.prompt}

REMEMBER: The style shown in references is MANDATORY. The subject/content can change, but the VISUAL STYLE must stay identical.`;
      } else {
        // 참조 이미지가 없을 때: 일반 프롬프트
        fullPrompt = params.prompt;
      }

      // Negative Prompt가 있으면 프롬프트에 명시
      if (params.negativePrompt && params.negativePrompt.trim()) {
        fullPrompt += `\n\nAvoid: ${params.negativePrompt}`;
      }

      parts.push({ text: fullPrompt });

      // generationConfig 구성
      const imageConfig: any = {
        aspectRatio: params.aspectRatio || '1:1',
        imageSize: params.imageSize || '2K',
      };

      // 참조 이미지 영향력 (참조 이미지가 있을 때만)
      // ⚠️ 주의: referenceStrength는 현재 Gemini API에서 공식 지원되지 않음 (2025-12-30 기준)
      // UI에는 표시되지만 실제 API 호출 시에는 사용되지 않음
      // if (hasReferenceImages && params.referenceStrength !== undefined) {
      //   imageConfig.referenceStrength = params.referenceStrength;
      //   console.log('   - Reference Strength:', params.referenceStrength);
      // }

      const generationConfig: any = {
        responseModalities: ['IMAGE'], // 이미지만 응답
        imageConfig,
      };

      // 고급 설정 추가 (값이 있을 때만)
      if (params.seed !== undefined) {
        generationConfig.seed = params.seed;
        console.log('   - Seed:', params.seed);
      }
      if (params.temperature !== undefined) {
        generationConfig.temperature = params.temperature;
        console.log('   - Temperature:', params.temperature);
      }
      if (params.topK !== undefined) {
        generationConfig.topK = params.topK;
        console.log('   - Top-K:', params.topK);
      }
      if (params.topP !== undefined) {
        generationConfig.topP = params.topP;
        console.log('   - Top-P:', params.topP);
      }

      const requestBody = {
        contents: [{ parts }],
        generationConfig,
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
