import { SessionType } from '../../types/session';
import { logger } from '../../lib/logger';

// Gemini API 타입 정의
interface GeminiPart {
  inline_data?: {
    mime_type: string;
    data: string;
  };
  text?: string;
}

interface GeminiImageConfig {
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  imageSize: '1K' | '2K' | '4K';
}

interface GeminiGenerationConfig {
  responseModalities: string[];
  imageConfig: GeminiImageConfig;
  seed?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
}

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
    // Retry 로직: 500 에러 시 최대 2번 재시도
    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 5000; // 5초 대기 (Rate Limiting 대응)

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          logger.warn(`🔄 재시도 중... (${attempt}/${MAX_RETRIES})`);
          callbacks.onProgress?.(`재시도 중... (${attempt}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }

        return await generateImageInternal(apiKey, params, callbacks);
      } catch (error) {
        const errorMessage = (error as Error).message;
        const is500Error = errorMessage.includes('500');

        // 500 에러가 아니거나 마지막 시도면 에러 던지기
        if (!is500Error || attempt === MAX_RETRIES) {
          throw error;
        }

        // 500 에러면 재시도
        logger.warn(`⚠️ 500 에러 발생. ${RETRY_DELAY_MS / 1000}초 후 재시도합니다...`);
      }
    }

    // 이 코드는 실행되지 않지만 TypeScript를 위해 추가
    throw new Error('최대 재시도 횟수 초과');
  };

  const generateImageInternal = async (
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

      logger.debug('🎨 이미지 생성 시작');
      logger.debug('   - 프롬프트 길이:', params.prompt.length);
      logger.debug('   - 참조 이미지 개수:', params.referenceImages?.length || 0);
      logger.debug('   - 비율:', params.aspectRatio || '1:1');
      logger.debug('   - 크기:', params.imageSize || '2K');

      callbacks.onProgress?.('이미지 생성 요청 중...');

      // Gemini 이미지 생성 모델 (2026-01-06 기준)
      const MODEL_NAME = 'gemini-3-pro-image-preview';
      logger.debug(`📦 사용 모델: ${MODEL_NAME}`);

      // 첫 시도 시 모델 사용 가능 여부 확인
      if (params.seed === undefined) {
        // Seed가 없을 때만 확인 (첫 생성으로 간주)
        try {
          const checkUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}?key=${cleanApiKey}`;
          const checkResponse = await fetch(checkUrl);

          if (!checkResponse.ok) {
            logger.error(`❌ 모델 "${MODEL_NAME}"을 사용할 수 없습니다! (${checkResponse.status})`);
            logger.error('💡 사용 가능한 모델 확인 방법:');
            logger.error('   1. 콘솔에서: listGeminiModels() 실행');
            logger.error('   2. 직접 확인: https://ai.google.dev/gemini-api/docs/models/gemini');

            // 모든 모델 리스트 조회
            const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanApiKey}`;
            const listResponse = await fetch(listUrl);
            if (listResponse.ok) {
              const result = await listResponse.json();
              const imageModels = result.models?.filter((m: any) =>
                m.name.toLowerCase().includes('image') ||
                m.name.toLowerCase().includes('vision') ||
                m.supportedGenerationMethods?.includes('generateContent')
              ) || [];

              if (imageModels.length > 0) {
                logger.error('📋 사용 가능한 이미지 생성 모델:');
                imageModels.slice(0, 5).forEach((model: any) => {
                  logger.error(`   - ${model.name.replace('models/', '')}`);
                });
              }
            }
          } else {
            logger.debug(`✅ 모델 "${MODEL_NAME}" 사용 가능 확인됨`);
          }
        } catch (checkError) {
          logger.warn('⚠️ 모델 확인 실패 (계속 진행):', checkError);
        }
      }

      // Gemini API 엔드포인트
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${cleanApiKey}`;

      // contents 배열 구성: [참조 이미지들..., 프롬프트]
      const parts: GeminiPart[] = [];

      // 1. 참조 이미지가 있으면 먼저 추가 (최대 10개)
      const hasReferenceImages = params.referenceImages && params.referenceImages.length > 0;

      if (hasReferenceImages && params.referenceImages) {
        const maxImages = Math.min(params.referenceImages.length, 10);
        logger.debug(`   - 참조 이미지 ${maxImages}개 추가 중...`);

        let totalImageSize = 0;
        for (let i = 0; i < maxImages; i++) {
          const imageBase64 = params.referenceImages[i];

          // Base64에서 data URL prefix 제거
          const base64Data = imageBase64.includes(',')
            ? imageBase64.split(',')[1]
            : imageBase64;

          // MIME 타입 추출
          const mimeMatch = imageBase64.match(/data:([^;]+);base64/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

          // 이미지 크기 로깅 (KB 단위)
          const imageSizeKB = (base64Data.length * 0.75) / 1024; // Base64는 원본의 약 1.33배
          totalImageSize += imageSizeKB;
          logger.debug(`     [${i + 1}] ${mimeType}, ${imageSizeKB.toFixed(2)} KB`);

          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          });
        }
        logger.debug(`   - 총 이미지 크기: ${totalImageSize.toFixed(2)} KB`);

        // 경고: 이미지가 너무 크면 500 에러 발생 가능
        if (totalImageSize > 20000) { // 20MB 이상
          logger.warn(`⚠️ 경고: 참조 이미지 크기가 매우 큽니다 (${totalImageSize.toFixed(2)} KB). 500 에러가 발생할 수 있습니다.`);
          logger.warn('   해결책: 참조 이미지 개수를 줄이거나 이미지 크기를 줄이세요.');
        }
      }

      // 2. 프롬프트 추가 (참조 이미지가 있으면 일관성 강조)
      let fullPrompt = '';

      if (hasReferenceImages && params.sessionType === 'BACKGROUND') {
        // 배경 세션: 배경 스타일 유지하며 다양한 환경 생성
        fullPrompt = `🌄 MISSION: Create a NEW ENVIRONMENT/LOCATION while PERFECTLY REPLICATING the visual style from reference backgrounds.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: UNDERSTAND THE REQUESTED ENVIRONMENT (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEW ENVIRONMENT TO CREATE: "${params.prompt || 'a natural outdoor scene'}"

🎯 INTERPRET THE ENVIRONMENT REQUEST:
- "forest" / "숲" = Trees, foliage, woodland atmosphere
- "beach" / "해변" = Sand, ocean, coastal scenery
- "city" / "도시" = Buildings, urban structures, streets
- "cave" / "동굴" = Rocky interior, enclosed space, dim lighting

⚠️ CRITICAL: The reference images show DIFFERENT locations - focus on their VISUAL STYLE, not their content.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: REPLICATE THE BACKGROUND VISUAL STYLE 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

While creating the NEW environment, COPY these style elements EXACTLY:

🔒 ART STYLE & TECHNIQUE:
- Drawing/painting technique (watercolor, cel-shaded, realistic, etc.)
- Line quality and edge treatment
- Level of detail and stylization
- Artistic approach (loose, precise, impressionistic, etc.)

🔒 COLOR PALETTE & ATMOSPHERE:
- Color harmony and relationships
- Saturation, brightness, contrast levels
- Color temperature (warm/cool tones)
- Atmospheric effects (fog, haze, lighting)

🔒 LIGHTING & MOOD:
- Light direction and intensity
- Shadow style and softness
- Time of day feeling
- Overall mood and atmosphere

🔒 COMPOSITION STYLE:
- Depth handling (foreground/midground/background)
- Perspective approach
- Scale and proportion style
- Framing and layout principles

🔒 TEXTURE & DETAIL:
- Surface texture treatment
- Material representation style
- Level of detail consistency
- Pattern and repetition style

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: CRITICAL REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- NO characters, people, or creatures (background only)
- Focus entirely on environment and scenery
- Maintain consistent style throughout the entire scene
- Create a cohesive, immersive environment

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FINAL CHECK BEFORE GENERATING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Does the new environment match the requested location/scene? (Step 1)
2. Does the visual style EXACTLY match the reference backgrounds? (Step 2)
3. Is it purely environmental without characters/creatures?
4. Is the style consistent across the entire image?

NEVER add your own style interpretation. CLONE the reference style EXACTLY.`;
      } else if (hasReferenceImages && params.sessionType === 'ICON') {
        // 아이콘 세션: 아이콘 스타일 유지하며 다양한 오브젝트 생성
        fullPrompt = `🎨 MISSION: Create a NEW ITEM/OBJECT ICON while PERFECTLY REPLICATING the visual style from reference icons.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: UNDERSTAND THE REQUESTED ITEM (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEW ITEM TO DRAW: "${params.prompt || 'a game item'}"

🎯 INTERPRET THE ITEM REQUEST:
- "sword" / "검" = Blade weapon, hilt, guard
- "potion" / "물약" = Bottle/flask with liquid
- "coin" / "동전" = Currency, circular metal object
- "crystal" / "크리스탈" = Gem, mineral, shiny rock

⚠️ CRITICAL: The reference icons show DIFFERENT items - focus on their VISUAL STYLE, not their content.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: REPLICATE THE ICON VISUAL STYLE 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

While creating the NEW item, COPY these style elements EXACTLY:

🔒 ICON FORM & STRUCTURE:
- Overall shape language (rounded, angular, organic, geometric)
- Proportion and scale approach
- Silhouette clarity and readability
- Size ratio of details to main object

🔒 LINE & EDGE TREATMENT:
- Outline thickness and style (thick, thin, absent)
- Edge quality (sharp, soft, stylized)
- Line color and contrast
- Highlight/outline technique

🔒 COLOR & SHADING STYLE:
- Color palette and harmony
- Shading technique (cel-shaded, gradient, flat)
- Highlight placement and intensity
- Shadow style and opacity
- Color saturation and brightness levels

🔒 MATERIAL REPRESENTATION:
- How metals look (shiny, matte, reflective)
- How glass/crystals appear (transparent, luminous)
- How fabrics are shown (textured, smooth)
- Surface quality representation

🔒 LIGHTING & EFFECTS:
- Light source direction (top-down, angled, etc.)
- Glow/shine effects style
- Shadow casting approach
- Special effects (sparkles, aura, etc.)

🔒 BACKGROUND & FRAMING:
- Background treatment (solid color, gradient, transparent)
- Framing approach (centered, tilted, floating)
- Border/frame style if present
- Negative space handling

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: ICON-SPECIFIC REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Clear, recognizable silhouette
- Readable at small sizes
- Focus on single main object (no complex scenes)
- Maintain icon clarity and simplicity
- Consistent detail level with references

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FINAL CHECK BEFORE GENERATING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Is the new item clearly recognizable? (Step 1)
2. Does the visual style EXACTLY match the reference icons? (Step 2)
3. Is it clean and readable as an icon?
4. Is the style consistent with typical game/app icon standards?

NEVER add your own artistic interpretation. CLONE the reference icon style EXACTLY.`;
      } else if (hasReferenceImages && params.sessionType === 'CHARACTER') {
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
      const imageConfig: GeminiImageConfig = {
        aspectRatio: params.aspectRatio || '1:1',
        imageSize: params.imageSize || '2K',
      };

      // 참조 이미지 영향력 (참조 이미지가 있을 때만)
      // ⚠️ 주의: referenceStrength는 현재 Gemini API에서 공식 지원되지 않음 (2025-12-30 기준)
      // UI에는 표시되지만 실제 API 호출 시에는 사용되지 않음
      // if (hasReferenceImages && params.referenceStrength !== undefined) {
      //   imageConfig.referenceStrength = params.referenceStrength;
      //   logger.debug('   - Reference Strength:', params.referenceStrength);
      // }

      const generationConfig: GeminiGenerationConfig = {
        responseModalities: ['IMAGE'], // 이미지만 응답
        imageConfig,
      };

      // 고급 설정 추가 (값이 있을 때만)
      if (params.seed !== undefined) {
        generationConfig.seed = params.seed;
        logger.debug('   - Seed:', params.seed);
      }
      if (params.temperature !== undefined) {
        generationConfig.temperature = params.temperature;
        logger.debug('   - Temperature:', params.temperature);
      }
      if (params.topK !== undefined) {
        generationConfig.topK = params.topK;
        logger.debug('   - Top-K:', params.topK);
      }
      if (params.topP !== undefined) {
        generationConfig.topP = params.topP;
        logger.debug('   - Top-P:', params.topP);
      }

      const requestBody = {
        contents: [{ parts }],
        generationConfig,
      };

      // 디버깅: 요청 내용 요약
      logger.debug('🌐 API 요청 전송...');
      logger.debug('   - parts 개수:', parts.length);
      logger.debug('   - generationConfig:', JSON.stringify(generationConfig, null, 2));
      const imagePartsCount = parts.filter(p => 'inline_data' in p).length;
      const textPartsCount = parts.filter(p => 'text' in p).length;
      logger.debug('   - 이미지 parts:', imagePartsCount);
      logger.debug('   - 텍스트 parts:', textPartsCount);

      // 요청 페이로드 크기 확인
      const requestBodyString = JSON.stringify(requestBody);
      const requestSizeMB = requestBodyString.length / (1024 * 1024);
      logger.debug(`   - 요청 페이로드 크기: ${requestSizeMB.toFixed(2)} MB`);

      if (requestSizeMB > 20) {
        logger.error(`❌ 요청이 너무 큽니다 (${requestSizeMB.toFixed(2)} MB)! Gemini API 제한을 초과했을 가능성이 높습니다.`);
        logger.error('   해결책:');
        logger.error('   1. 참조 이미지 개수를 1-2개로 줄이세요');
        logger.error('   2. 이미지 해상도를 낮추세요 (예: 512x512 이하)');
        logger.error('   3. 포즈 가이드를 제거하고 텍스트만으로 시도하세요');
      }

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
        logger.error('❌ API 오류:', response.status, errorText);

        // 에러 상세 정보 파싱
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            logger.error('   - 에러 코드:', errorJson.error.code);
            logger.error('   - 에러 메시지:', errorJson.error.message);
            logger.error('   - 에러 상태:', errorJson.error.status);
          }
        } catch (e) {
          // JSON 파싱 실패 시 무시
        }

        throw new Error(`API 오류 (${response.status}): ${errorText}`);
      }

      callbacks.onProgress?.('이미지 생성 완료, 로딩 중...');

      const result = await response.json();
      logger.debug('✅ Gemini 응답 수신');

      // 응답 파싱: candidates[0].content.parts[]
      const responseParts = result.candidates?.[0]?.content?.parts || [];

      let imageBase64 = '';
      let textResponse = '';

      for (const part of responseParts) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data;
          logger.debug('   - 이미지 데이터 수신 (길이:', imageBase64.length, ')');
        } else if (part.text) {
          textResponse += part.text;
        }
      }

      if (!imageBase64) {
        logger.error('❌ 생성된 이미지 없음');
        logger.error('   - 응답:', JSON.stringify(result, null, 2));
        throw new Error('생성된 이미지가 없습니다');
      }

      logger.debug('✅ 이미지 생성 완료!');
      callbacks.onComplete(imageBase64, textResponse);
    } catch (error) {
      logger.error('이미지 생성 오류:', error);
      callbacks.onError(
        error instanceof Error ? error : new Error('알 수 없는 오류가 발생했습니다')
      );
    }
  };

  return { generateImage };
}
