import { SessionType } from '../../types/session';
import { ReferenceDocument } from '../../types/referenceDocument';
import { logger } from '../../lib/logger';
import { PixelArtGridLayout, getPixelArtGridInfo } from '../../types/pixelart';
import { ImageAnalysisResult } from '../../types/analysis';

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
  analysis?: ImageAnalysisResult; // 이미지 분석 결과 (픽셀아트 해상도 추출용)
  pixelArtGrid?: PixelArtGridLayout; // 픽셀아트 그리드 레이아웃 (선택)
  referenceDocuments?: ReferenceDocument[]; // 참조 문서 (UI 세션 전용)

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

/**
 * ASCII 그리드 생성 (프롬프트 시각화용)
 */
function generateGridASCII(rows: number, cols: number): string {
  let ascii = '';
  for (let r = 0; r < rows; r++) {
    let row = '';
    for (let c = 0; c < cols; c++) {
      const frameNum = r * cols + c + 1;
      row += `[${frameNum.toString().padStart(2, '0')}] `;
    }
    ascii += row.trim() + '\n';
  }
  return ascii.trim();
}

/**
 * 해상도 문자열에서 숫자 추출
 * @param resolutionStr - "64x64", "128x128" 형식의 문자열
 * @returns 추출된 해상도 (기본값: 128)
 */
function parseResolutionEstimate(resolutionStr?: string): number {
  if (!resolutionStr) return 128; // 기본값

  // "64x64", "128x128", "256x256" 형식 파싱
  const match = resolutionStr.match(/(\d+)x(\d+)/);
  if (!match) return 128;

  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);

  // 정사각형 가정, 더 큰 쪽 사용
  const maxDimension = Math.max(width, height);

  // 16px ~ 512px 범위로 제한
  return Math.max(16, Math.min(512, maxDimension));
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
        // Grid 지원 추가
        if (params.pixelArtGrid && params.pixelArtGrid !== '1x1') {
          const gridLayout = params.pixelArtGrid;
          logger.debug('🌄 배경 그리드:', gridLayout, '(전달값:', params.pixelArtGrid, ')');
          const gridInfo = getPixelArtGridInfo(gridLayout);
          const { rows, cols, totalFrames, cellSize } = gridInfo;
          const backgroundSize = cellSize; // 각 셀 전체를 사용

          fullPrompt = `🌄 MISSION: Create MULTIPLE BACKGROUND VARIATIONS in a grid layout on a 1024x1024 canvas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: UNDERSTAND THE LAYOUT (CRITICAL!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 CANVAS: 1024x1024px (fixed)
🎯 GRID LAYOUT: ${rows} rows × ${cols} columns = ${totalFrames} backgrounds
🎯 CELL SIZE: ${cellSize}x${cellSize}px per background
🎯 BACKGROUND SIZE: ${backgroundSize}x${backgroundSize}px (fills each cell)

📐 GRID STRUCTURE:
${generateGridASCII(rows, cols)}

⚠️ CRITICAL: Each cell contains ONE complete background scene.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: UNDERSTAND THE ENVIRONMENT REQUEST (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENVIRONMENT REQUEST: "${params.prompt || 'various natural scenes'}"

🎯 INTERPRET THE ENVIRONMENT REQUEST:
- "forest" / "숲" = Trees, foliage, woodland atmosphere
- "beach" / "해변" = Sand, ocean, coastal scenery
- "city" / "도시" = Buildings, urban structures, streets
- "cave" / "동굴" = Rocky interior, enclosed space, dim lighting
- "castle" / "성" = Fortress, towers, medieval architecture
- "mountain" / "산" = Rocky peaks, cliffs, elevation

🎨 BACKGROUND VARIATIONS (${totalFrames} total):
Create ${totalFrames} different variations of the environment:
- Different times of day (dawn, noon, dusk, night)
- Different weather (clear, rain, snow, fog)
- Different angles (front view, side view, perspective)
- Different areas (entrance, middle, deep area, exit)
- Different seasons (spring, summer, autumn, winter)

⚠️ CRITICAL: The reference images show the VISUAL STYLE to copy - create NEW scenes with that style!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: REPLICATE THE BACKGROUND VISUAL STYLE 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

While creating NEW environments, COPY these style elements EXACTLY:

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

🔒 VARIATION CONSISTENCY:
- Background style stays IDENTICAL across all variations
- Only environment type/time/weather changes, never the core visual style
- Maintain consistent quality and detail level

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: LAYOUT ON 1024x1024 CANVAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📐 PRECISE POSITIONING:
- Divide 1024px canvas into ${rows}×${cols} grid
- Each cell is ${cellSize}×${cellSize}px
- Each background fills its ${backgroundSize}×${backgroundSize}px cell completely
- NO padding or spacing (backgrounds fill cells edge-to-edge)

🎯 BACKGROUND ORDER:
Read left-to-right, top-to-bottom (like reading text):
Background 1 at (0,0), Background 2 at (1,0), ..., Background ${cols} at (${cols-1},0)
Background ${cols+1} at (0,1), ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: BACKGROUND-SPECIFIC REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- NO characters, people, or creatures (background only)
- Focus entirely on environment and scenery
- Maintain consistent style throughout all variations
- Create cohesive, immersive environments
- Suitable for game/animation backgrounds

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FINAL CHECK BEFORE GENERATING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ✅ ${totalFrames} backgrounds total (${rows}×${cols} grid)?
2. ✅ Each background fills its ${backgroundSize}×${backgroundSize}px cell?
3. ✅ All backgrounds share the same visual style?
4. ✅ Background style EXACTLY matches reference?
5. ✅ Purely environmental without characters/creatures?
6. ✅ Consistent quality across all backgrounds?

CRITICAL: These are environment backgrounds. Visual consistency and immersion are essential.
NEVER add your own style interpretation. CLONE the reference style EXACTLY.`;
        } else {
          // 단일 배경 생성 (기존 프롬프트)
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
        }
      } else if (hasReferenceImages && params.sessionType === 'ICON') {
        // 아이콘 세션: 아이콘 스타일 유지하며 다양한 오브젝트 생성
        // Grid 지원 추가
        if (params.pixelArtGrid && params.pixelArtGrid !== '1x1') {
          const gridLayout = params.pixelArtGrid;
          logger.debug('🎨 아이콘 그리드:', gridLayout, '(전달값:', params.pixelArtGrid, ')');
          const gridInfo = getPixelArtGridInfo(gridLayout);
          const { rows, cols, totalFrames, cellSize } = gridInfo;
          const iconSize = cellSize; // 각 셀 전체를 사용

          fullPrompt = `🎨 MISSION: Create MULTIPLE ICON VARIATIONS in a grid layout on a 1024x1024 canvas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: UNDERSTAND THE LAYOUT (CRITICAL!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 CANVAS: 1024x1024px (fixed)
🎯 GRID LAYOUT: ${rows} rows × ${cols} columns = ${totalFrames} icons
🎯 CELL SIZE: ${cellSize}x${cellSize}px per icon
🎯 ICON SIZE: ${iconSize}x${iconSize}px (fills each cell)

📐 GRID STRUCTURE:
${generateGridASCII(rows, cols)}

⚠️ CRITICAL: Each cell contains ONE complete icon.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: UNDERSTAND THE ICON REQUEST (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ICON REQUEST: "${params.prompt || 'various game items'}"

🎯 INTERPRET THE ITEM REQUEST:
- "sword" / "검" = Blade weapon, hilt, guard
- "potion" / "물약" = Bottle/flask with liquid
- "coin" / "동전" = Currency, circular metal object
- "crystal" / "크리스탈" = Gem, mineral, shiny rock
- "weapon" / "무기" = Various combat tools (sword, axe, bow)
- "food" / "음식" = Consumable items (apple, bread, meat)

🎨 ICON VARIATIONS (${totalFrames} total):
Create ${totalFrames} different variations or related items:
- Different types (red potion, blue potion, green potion)
- Different sizes or levels (small coin, medium coin, large coin)
- Different rarities (common sword, rare sword, legendary sword)
- Related items (health potion, mana potion, stamina potion, antidote)

⚠️ CRITICAL: The reference icons show the VISUAL STYLE to copy - create NEW items with that style!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: REPLICATE THE ICON VISUAL STYLE 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

While creating NEW items, COPY these style elements EXACTLY:

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

🔒 VARIATION CONSISTENCY:
- Icon style stays IDENTICAL across all variations
- Only item type/color changes, never the core visual style
- Maintain consistent quality and detail level

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: LAYOUT ON 1024x1024 CANVAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📐 PRECISE POSITIONING:
- Divide 1024px canvas into ${rows}×${cols} grid
- Each cell is ${cellSize}×${cellSize}px
- Each icon fills its ${iconSize}×${iconSize}px cell completely
- NO padding or spacing (icons fill cells edge-to-edge)

🎯 ICON ORDER:
Read left-to-right, top-to-bottom (like reading text):
Icon 1 at (0,0), Icon 2 at (1,0), ..., Icon ${cols} at (${cols-1},0)
Icon ${cols+1} at (0,1), ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: ICON-SPECIFIC REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Clear, recognizable silhouette for each icon
- Readable at small sizes
- Focus on single main object per icon (no complex scenes)
- Consistent detail level with references
- Suitable for game inventory or UI use

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FINAL CHECK BEFORE GENERATING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ✅ ${totalFrames} icons total (${rows}×${cols} grid)?
2. ✅ Each icon fills its ${iconSize}×${iconSize}px cell?
3. ✅ All icons share the same visual style?
4. ✅ Icon style EXACTLY matches reference?
5. ✅ Clear and readable at small sizes?
6. ✅ Consistent quality across all icons?

CRITICAL: These are game/app icons. Visual consistency and readability are essential.
NEVER add your own artistic interpretation. CLONE the reference icon style EXACTLY.`;
        } else {
          // 단일 아이콘 생성 (기존 프롬프트)
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
        }
      } else if (hasReferenceImages && params.sessionType === 'UI') {
        // UI 세션: UI 디자인 스타일 유지하며 다양한 화면 생성

        // platform_type 추출하여 UI 요소 크기 결정
        const platformType = params.analysis?.ui_specific?.platform_type?.toLowerCase() || '';
        let uiSizeGuidance = '';

        if (platformType.includes('mobile') || platformType.includes('phone') ||
            platformType.includes('ios') || platformType.includes('android')) {
          uiSizeGuidance = `
🔒 UI ELEMENT SIZING (MOBILE):
- Larger touch targets (minimum 44×44px)
- Bigger buttons and interactive elements
- More spacing between elements for thumb accessibility
- Larger typography (16px+ for body text)
- Prominent CTAs and primary actions`;
        } else if (platformType.includes('desktop') || platformType.includes('web') ||
                   platformType.includes('landing')) {
          uiSizeGuidance = `
🔒 UI ELEMENT SIZING (DESKTOP):
- Compact, dense layout with more information
- Smaller interactive elements (mouse precision)
- Tighter spacing between elements
- Smaller typography (14px body text acceptable)
- Multiple columns and sidebars`;
        } else if (platformType.includes('tablet') || platformType.includes('ipad')) {
          uiSizeGuidance = `
🔒 UI ELEMENT SIZING (TABLET):
- Medium-sized touch targets (40×40px)
- Balanced spacing (between mobile and desktop)
- Flexible layout adapting to orientation
- Moderate typography (15px body text)`;
        } else {
          uiSizeGuidance = `
🔒 UI ELEMENT SIZING (ADAPTIVE):
- Balanced sizing suitable for multiple platforms
- Standard touch targets (40×40px)
- Comfortable spacing and typography`;
        }

        // 문서 내용 통합 (UI 세션 전용)
        let docContext = '';
        if (params.referenceDocuments && params.referenceDocuments.length > 0) {
          const docSummaries = params.referenceDocuments
            .map(doc => {
              const summary = doc.summary || doc.content.substring(0, 200);
              return `[${doc.fileName}] ${summary.substring(0, 200)}`;
            })
            .join('\n');

          docContext = `\n\n━━━ 기획 문서 참조 ━━━\n${docSummaries}\n`;
        }

        if (params.pixelArtGrid && params.pixelArtGrid !== '1x1') {
          // Grid 모드
          const gridInfo = getPixelArtGridInfo(params.pixelArtGrid);
          const { rows, cols, totalFrames, cellSize } = gridInfo;

          fullPrompt = `📱 MISSION: Create ${totalFrames} UI SCREEN DESIGNS in a ${rows}×${cols} grid on 1024x1024 canvas.

━━━ STEP 1: GRID LAYOUT ━━━
Canvas: 1024×1024px
Grid: ${rows}×${cols} = ${totalFrames} screens
Cell Size: ${cellSize}×${cellSize}px
${generateGridASCII(rows, cols)}

━━━ STEP 2: UI REQUEST ━━━
Request: "${params.prompt || 'various mobile app screens'}"
Create ${totalFrames} different UI screens:
- Different types (Home, List, Detail, Form, Empty state)
- Different states (Default, Loading, Error, Success)
- Different density (Minimal, Medium, Data-rich)${docContext}

━━━ STEP 3: STYLE REPLICATION 100% ━━━
Copy EXACTLY from reference UI:
🔒 Design system (Glassmorphism, Neumorphism, Flat, Material)
🔒 Color palette (Background, Accent, Text - EXACT match)
🔒 Typography (Font family, weights, hierarchy)
🔒 Component style (Buttons, inputs, cards, icons)
🔒 Navigation pattern (Bottom tabs, Sidebar, Top bar)
${uiSizeGuidance}

━━━ STEP 4: QUALITY BOOSTERS ━━━
Trending on Dribbble. Behance winner. Figma. UI/UX. High Fidelity. Clean interface. User-centered design.

━━━ EXECUTION RULES ━━━
✅ FLAT UI screens (NO device frames, NO phone mockups)
✅ Lorem Ipsum text (AI cannot write accurate text)
✅ Consistent style across all cells
❌ NO phone mockups, device frames, hands, photographs, messy layouts

Output: ${rows}×${cols} grid of UI screens. Style: EXACT match to reference.`;

        } else {
          // 단일 이미지 모드
          fullPrompt = `📱 Create ONE UI SCREEN in the exact style of reference.

Request: "${params.prompt || 'mobile app screen'}"${docContext}

━━━ STYLE REPLICATION 100% ━━━
🔒 Design system, Color palette, Typography, Component style, Navigation
${uiSizeGuidance}

━━━ QUALITY ━━━
Dribbble. Behance. Figma. UI/UX. High Fidelity.
FLAT UI only. Lorem Ipsum text. NO mockups.

Output: Single flat UI screen matching reference style.`;
        }
      } else if (hasReferenceImages && params.sessionType === 'LOGO') {
        // LOGO 세션: 게임 타이틀 로고 스타일 유지하며 새로운 로고 생성

        if (params.pixelArtGrid && params.pixelArtGrid !== '1x1') {
          // Grid 모드: 로고 바리에이션 생성
          const gridInfo = getPixelArtGridInfo(params.pixelArtGrid);
          const { rows, cols, totalFrames, cellSize } = gridInfo;

          fullPrompt = `🎮 MISSION: Create ${totalFrames} GAME LOGO VARIATIONS in a ${rows}×${cols} grid on 1024x1024 canvas.

━━━ STEP 1: GRID LAYOUT ━━━
Canvas: 1024×1024px
Grid: ${rows}×${cols} = ${totalFrames} logos
Cell Size: ${cellSize}×${cellSize}px
${generateGridASCII(rows, cols)}

━━━ STEP 2: LOGO REQUEST ━━━
Request: "${params.prompt || 'game title logo variations'}"

Create ${totalFrames} variations with:
- Different materials (Glossy Candy, Metallic, Jelly, Stone, Wooden)
- Different color schemes (Red, Blue, Green, Purple, Gold)
- Different effects (Glow, Shadow, Outline thickness variations)
- Consistent typography style across all

━━━ STEP 3: GAME LOGO STYLE REPLICATION 100% ━━━

🔒 TYPOGRAPHY & SHAPE (EXACT MATCH):
- Font vibe (Cartoonish, Bubble, Blocky, Handwritten, Graffiti)
- Letter warping (Arched, Fish-eye, Perspective, Wave)
- Weight consistency (Super Bold, Chunky, Bubble-like)
- Edge treatment (Rounded for Casual/Cute vs Angular for Action/RPG)
- Embossing and dimensionality
- Letter spacing and alignment

🔒 MATERIAL & RENDERING (CRITICAL):
⚠️ This is the MOST IMPORTANT aspect of game logos!
- Identify base material from reference:
  * Glossy Plastic/Candy (shiny highlights, vibrant reflections)
  * Jelly/Gelatinous (translucent, wobbly appearance, soft highlights)
  * Wooden (grain texture, natural color variations)
  * Metallic (chrome/gold/silver reflections, sharp highlights)
  * Stone (rough texture, matte finish, carved appearance)
  * Cookie/Food (baked texture, appetizing appearance)
- Rendering style: 2D Flat vs 3D Rendered (match reference exactly)
- Surface quality: Matte, Semi-Gloss, High-Gloss, Translucent
- For VARIATIONS: Apply same style to different materials while keeping typography

🔒 DECORATION & EFFECTS:
- Outline/Stroke: Thickness (1-5px typical), color (white/dark common), double outlines
- Drop Shadow: Offset, blur, color, opacity
- Inner Glow/Highlights: Rim lighting, specular highlights, ambient occlusion
- Embedded decorations: Icons (shields, stars, crowns), leaves, particles, sparkles
- Background elements: Simple solid color, subtle gradient, or decorative frame

🔒 COLOR STRATEGY (VIBRANT IS KEY):
- High saturation colors (typical for casual games)
- 2-3 primary colors maximum
- Gradient usage (common in mobile game logos)
- Color harmony: Complementary, Analogous, or Triadic
- Special colors for specific genres:
  * Puzzle Games: Bright, Vibrant, Multi-color
  * RPG/Strategy: Gold, Silver, Deep Blues, Purples
  * Action/Endless Runner: High Contrast, Bold, Speed-suggesting colors

━━━ STEP 4: GENRE-SPECIFIC ENHANCEMENT ━━━

Based on the request, apply genre-appropriate keywords:

**Puzzle Games Keywords:**
Juicy, Glossy, Candy texture, Bubble font, Splash effect, Pop art style,
Vibrant colors, Playful, Cute, Rounded edges, Soft shadows, Match-3 style

**RPG/Strategy Games Keywords:**
Metallic, Stone texture, Golden rim, Sharp edges, Shield background,
Epic, Embossed text, Medieval font, Battle-worn, Legendary, Fantasy style

**Endless Runner/Action Games Keywords:**
Speed lines, Italic font, Lightning effect, Motion blur, High contrast,
Dynamic, Energy, Bold, Angular, Aggressive, Athletic font

━━━ STEP 5: TEXT HANDLING (CRITICAL!) ━━━

⚠️ AI LIMITATION ACKNOWLEDGMENT:
Current AI models struggle with perfect text spelling.

APPROACH:
1. Focus on the VISUAL STYLE of text rather than perfect spelling
2. Use "Text saying '${params.prompt || 'GAME'}'" as starting point
3. Emphasize: "big chunky letters", "embossed 3D text", "glossy letter treatment"
4. Prioritize: Letter SHAPE, TEXTURE, EFFECTS over perfect readability
5. Output is a "design concept" - final text can be edited in Photoshop

KEYWORDS TO USE:
- "game logo"
- "game title"
- "vector style" (for clean edges)
- "3D render" or "blender 3d" (for depth)
- "vibrant colors"
- "white background" or "isolated on white" (for easy extraction)

━━━ STEP 6: LAYOUT EXECUTION ━━━

📐 PRECISE POSITIONING:
- Divide 1024px canvas into ${rows}×${cols} grid
- Each cell is ${cellSize}×${cellSize}px
- Center logo in each cell with comfortable padding
- Logos should be similar size across cells for comparison

🎯 LOGO ORDER:
Read left-to-right, top-to-bottom:
Logo 1 at (0,0), Logo 2 at (1,0), ..., Logo ${cols} at (${cols-1},0)
Logo ${cols+1} at (0,1), ...

🎨 BACKGROUND:
- Use white background (#FFFFFF) or subtle light gray for easy extraction
- OR use simple solid colors that complement the logo colors
- NO complex backgrounds, NO landscapes, NO busy patterns

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FINAL CHECKLIST:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ✅ ${totalFrames} logos total (${rows}×${cols} grid)?
2. ✅ Each logo clearly visible and distinguishable?
3. ✅ Typography style EXACTLY matches reference?
4. ✅ Material/texture variations applied correctly?
5. ✅ High saturation, vibrant colors used?
6. ✅ Clean white/solid background for extraction?
7. ✅ Logos are design concepts (text spelling is secondary)?

CRITICAL: These are GAME LOGOS for mobile apps. Visual impact and material quality are paramount.
NEVER use realistic photos, landscapes, or character portraits. ONLY stylized game title logos.`;

        } else {
          // 단일 로고 생성
          fullPrompt = `🎮 MISSION: Create a SINGLE GAME TITLE LOGO while PERFECTLY REPLICATING the style from reference logos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: UNDERSTAND THE LOGO REQUEST (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEW LOGO TO CREATE: "${params.prompt || 'game title logo'}"

🎯 INTERPRET THE REQUEST:
- Extract game title text (e.g., "DRAGON POP", "CANDY CRUSH")
- Identify genre hints (puzzle, RPG, action, casual)
- Understand desired mood (playful, epic, energetic, cute)

⚠️ CRITICAL: The reference logos show the VISUAL STYLE to replicate - focus on HOW they look, not WHAT they say.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: REPLICATE THE GAME LOGO STYLE 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 TYPOGRAPHY & SHAPE (EXACT MATCH):
- Font vibe (Cartoonish, Bubble, Blocky, Handwritten, Graffiti)
- Letter warping (Arched, Fish-eye, Perspective, Wave)
- Weight consistency (Super Bold, Chunky, Bubble-like)
- Edge treatment (Rounded for Casual/Cute vs Angular for Action/RPG)
- Embossing and dimensionality
- Letter spacing and alignment

🔒 MATERIAL & RENDERING (MOST CRITICAL!):
⚠️ This is what makes game logos special!
- Identify material from reference:
  * Glossy Plastic/Candy (shiny, vibrant reflections)
  * Jelly (translucent, soft, wobbly)
  * Wooden (grain texture, natural)
  * Metallic (chrome/gold/silver, sharp reflections)
  * Stone (rough, carved, matte)
  * Cookie/Food (baked texture, appetizing)
- Match rendering: 2D Flat vs 3D Rendered
- Surface quality: Matte / Semi-Gloss / High-Gloss / Translucent

🔒 DECORATION & EFFECTS:
- Outline/Stroke: Thickness, color (white/dark common), double outlines
- Drop Shadow: Offset, blur, opacity
- Inner Glow/Highlights: Rim lighting, specular highlights
- Decorations: Icons (shields, stars), leaves, particles, sparkles
- Background: Solid color, gradient, or simple frame

🔒 COLOR STRATEGY (VIBRANT!):
- High saturation (essential for mobile game logos)
- 2-3 primary colors maximum
- Gradient application style
- Genre-appropriate palette:
  * Puzzle: Bright multi-color
  * RPG: Gold/Silver/Deep Blues
  * Action: High contrast bold colors

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: GENRE-SPECIFIC KEYWORDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apply these based on detected/requested genre:

**Puzzle:** Juicy, Glossy, Candy texture, Bubble font, Splash effect, Pop art,
Vibrant, Playful, Cute, Rounded, Soft shadows, Match-3 style

**RPG/Strategy:** Metallic, Stone texture, Golden rim, Sharp edges, Shield,
Epic, Embossed, Medieval font, Battle-worn, Legendary, Fantasy

**Action/Runner:** Speed lines, Italic font, Lightning, Motion blur, High contrast,
Dynamic, Energy, Bold, Angular, Aggressive, Athletic

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: TEXT HANDLING (IMPORTANT!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ AI has limitations with perfect text spelling.

APPROACH:
1. Describe text as "Text saying '${params.prompt || 'GAME'}'"
2. Focus on VISUAL QUALITIES: "big chunky letters", "embossed 3D text", "glossy finish"
3. Prioritize: Letter SHAPE, TEXTURE, EFFECTS
4. This is a "design concept" - text can be refined in Photoshop later

QUALITY KEYWORDS:
- "game logo", "game title"
- "vector style" (clean edges)
- "3D render", "blender 3d" (for depth)
- "vibrant colors", "high saturation"
- "white background", "isolated on white" (easy extraction)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: LOGO-SPECIFIC REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Clear, bold typography (readable at thumbnail size)
- Strong visual impact (0.1 second attention grabbing)
- Material quality is paramount (this is what makes it "pop")
- Simple clean background (white or solid color)
- NO photorealistic elements, NO landscapes, NO character portraits
- ONLY stylized game title logo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FINAL CHECK BEFORE GENERATING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ✅ Typography style matches reference exactly?
2. ✅ Material/texture replicates reference quality?
3. ✅ Colors are vibrant and saturated (mobile game standard)?
4. ✅ Effects (outline, shadow, glow) match reference?
5. ✅ Clean background for easy extraction?
6. ✅ Bold enough to be readable at small size (app icon)?
7. ✅ This is a DESIGN CONCEPT (text perfection is secondary)?

CRITICAL: This is a MOBILE GAME LOGO. Visual impact, material quality, and vibrancy are everything.
NEVER make it look like a generic text logo or corporate branding. Make it POP like a candy!`;
        }
      } else if (hasReferenceImages && params.sessionType === 'PIXELART_CHARACTER') {
        // 픽셀아트 캐릭터: 그리드 스프라이트 시트로 애니메이션 시퀀스 생성
        const gridLayout = params.pixelArtGrid || '4x4';
        logger.debug('🎮 픽셀아트 캐릭터 그리드:', gridLayout, '(전달값:', params.pixelArtGrid, ')');
        const gridInfo = getPixelArtGridInfo(gridLayout);
        const { rows, cols, totalFrames, cellSize, recommendedPixelSize } = gridInfo;

        // 분석 결과에서 실제 해상도 추출 (fallback: gridInfo.recommendedPixelSize)
        const pixelSize = parseResolutionEstimate(
          params.analysis?.pixelart_specific?.resolution_estimate
        ) || recommendedPixelSize;

        fullPrompt = `🎮 MISSION: Create a PIXEL ART ANIMATION SPRITE SHEET on a 1024x1024 canvas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: UNDERSTAND THE LAYOUT (CRITICAL!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 CANVAS: 1024x1024px (fixed)
🎯 GRID LAYOUT: ${rows} rows × ${cols} columns = ${totalFrames} frames
🎯 CELL SIZE: ${cellSize}x${cellSize}px per frame
🎯 PIXEL ART SIZE: ${pixelSize}x${pixelSize}px (centered in each cell)

📐 GRID STRUCTURE:
${generateGridASCII(rows, cols)}

⚠️ CRITICAL: Each cell contains ONE frame of the animation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: UNDERSTAND THE ANIMATION (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ANIMATION REQUEST: "${params.prompt || 'idle stance'}"

🎬 ANIMATION INTERPRETATION GUIDE:
- "attack" / "공격" = Prepare → Wind up → Strike → Follow through → Return
- "walk" / "걷기" = Lift foot → Move forward → Plant foot → Repeat (cycle)
- "jump" / "점프" = Crouch → Launch → Rise → Peak → Fall → Land
- "idle" / "대기" = Subtle breathing or swaying motion (loopable)
- "run" / "달리기" = Faster walk cycle with more exaggerated motion

📋 FRAME BREAKDOWN:
For ${totalFrames} frames total, divide the animation into natural phases:
- Beginning frames: Preparation/anticipation (20%)
- Middle frames: Main action (50%)
- End frames: Follow-through/recovery (30%)

⚠️ MAKE IT LOOPABLE: First and last frames should connect smoothly!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: REPLICATE PIXEL ART CHARACTER STYLE 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 PIXEL GRID & RESOLUTION (CRITICAL):
- Canvas size: ${pixelSize}x${pixelSize}px per frame
- All pixels on integer grid coordinates
- NO sub-pixel positioning, NO mixels (mixed pixel sizes)
- Consistent pixel size throughout entire sprite
- NO anti-aliasing (pure pixel edges, crisp and sharp)
- NO blur or smoothing filters

🔒 BODY PROPORTIONS (PIXEL-PERFECT COPY):
- Head size in pixels → COPY EXACTLY (e.g., 8x8px, 16x16px)
- Body height in pixels → COPY EXACTLY
- Limb length in pixels → COPY EXACTLY
- If reference is 2-head chibi pixel → Keep 2-head chibi pixel
- Count pixels in reference and use SAME pixel counts

🔒 COLOR PALETTE (EXACT MATCH):
- Use EXACT same colors from reference (NO color interpolation)
- Same palette size (4 colors, 16 colors, 32 colors, etc.)
- NO smooth gradients, NO color blending
- Match saturation, brightness, hue EXACTLY

🔒 LINE & OUTLINE STYLE (MOST IMPORTANT!):
⚠️ CRITICAL: Check reference outline thickness!
- If reference has 1px outlines → Use EXACTLY 1px outlines (NOT 2px, NOT 3px)
- If reference has NO outlines → Use NO outlines
- If reference has colored outlines → Use SAME colored outlines
- Pixel Perfect lines: NO doubles, NO jaggies, NO thick lines
- Same edge treatment as reference
- Clean silhouette for sprite use
- NEVER make outlines thicker than reference!

🔒 SHADING TECHNIQUE (COPY EXACTLY):
- Copy shading method (hue shifting, color banding, flat colors, cell shading)
- Same shadow pixel patterns (avoid old dithering patterns)
- Same highlight placement
- Use modern pixel art shading: hue shifting and color banding preferred
- NO smooth shading, NO anti-aliasing, NO old-school dithering

🔒 FACIAL FEATURES (PIXEL DETAIL):
- Eye size and position (exact pixel count, e.g., 2x2px eyes)
- Hair pixel pattern and shape
- Face outline pixels
- Maintain pixel art simplification level

🔒 ANIMATION CONSISTENCY:
- Character size stays IDENTICAL across all frames
- No morphing or size changes between frames
- Maintain volume and silhouette
- Only pose/position changes, never proportions
- Outline thickness NEVER changes between frames

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: LAYOUT ON 1024x1024 CANVAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📐 PRECISE POSITIONING:
- Divide 1024px canvas into ${rows}×${cols} grid
- Each cell is ${cellSize}×${cellSize}px
- Center ${pixelSize}×${pixelSize}px pixel art in each cell
- Leave padding around each sprite (for clean separation)

🎯 FRAME ORDER:
Read left-to-right, top-to-bottom (like reading text):
Frame 1 at (0,0), Frame 2 at (1,0), ..., Frame ${cols} at (${cols-1},0)
Frame ${cols+1} at (0,1), ...

⚠️ BLACK BACKGROUND: Use solid black (#000000) background for easy cropping.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FINAL CHECKLIST:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ✅ ${totalFrames} frames total (${rows}×${cols} grid)?
2. ✅ Each frame is ${pixelSize}×${pixelSize}px pixel art?
3. ✅ Animation flows naturally across frames?
4. ✅ Character style EXACTLY matches reference?
5. ✅ Outline thickness EXACTLY matches reference (1px = 1px, NOT 2px)?
6. ✅ NO anti-aliasing or smoothing?
7. ✅ Black background for easy separation?

CRITICAL: This is a sprite sheet for game development. Pixel-perfect precision is essential.
⚠️ MOST IMPORTANT: If reference has 1px outlines, NEVER use 2px or thicker outlines!`;
      } else if (hasReferenceImages && params.sessionType === 'PIXELART_BACKGROUND') {
        // 픽셀아트 배경: 그리드 방식 또는 단일 배경
        const gridLayout = params.pixelArtGrid || '1x1'; // 기본 1x1 (단일 배경)
        logger.debug('🌍 픽셀아트 배경 그리드:', gridLayout, '(전달값:', params.pixelArtGrid, ')');
        const gridInfo = getPixelArtGridInfo(gridLayout);
        const { rows, cols, totalFrames, cellSize, recommendedPixelSize } = gridInfo;

        // 분석 결과에서 실제 해상도 추출 (fallback: gridInfo.recommendedPixelSize)
        const pixelSize = parseResolutionEstimate(
          params.analysis?.pixelart_specific?.resolution_estimate
        ) || recommendedPixelSize;

        // aspectRatio에 따른 캔버스 크기 결정
        const aspectRatio = params.aspectRatio || '1:1';
        let canvasWidth = 1024;
        let canvasHeight = 1024;

        if (aspectRatio === '9:16') {
          // 9:16 세로 (예: 576x1024)
          canvasWidth = 576;
          canvasHeight = 1024;
        } else if (aspectRatio === '16:9') {
          // 16:9 가로 (예: 1024x576)
          canvasWidth = 1024;
          canvasHeight = 576;
        } else if (aspectRatio === '3:4') {
          // 3:4 세로 (예: 768x1024)
          canvasWidth = 768;
          canvasHeight = 1024;
        } else if (aspectRatio === '4:3') {
          // 4:3 가로 (예: 1024x768)
          canvasWidth = 1024;
          canvasHeight = 768;
        }
        // 1:1은 기본값 1024x1024

        // 1x1 그리드 (단일 배경) vs 다중 그리드 (바리에이션)
        if (gridLayout === '1x1') {
          // 단일 배경 이미지 생성
          fullPrompt = `🌍 MISSION: Create a SINGLE PIXEL ART BACKGROUND on a ${canvasWidth}x${canvasHeight} canvas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: UNDERSTAND THE CANVAS (CRITICAL!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 CANVAS: ${canvasWidth}x${canvasHeight}px (ASPECT RATIO: ${aspectRatio})
🎯 PIXEL ART SIZE: ${pixelSize}x${Math.floor(pixelSize * (canvasHeight / canvasWidth))}px target resolution
🎯 OUTPUT: ONE complete pixel art background scene

⚠️ CRITICAL ASPECT RATIO REQUIREMENT:
- ALWAYS fill the ENTIRE ${canvasWidth}x${canvasHeight}px canvas
- NO letterboxing (black bars on sides)
- NO pillarboxing (black bars on top/bottom)
- The pixel art background MUST occupy the FULL ${canvasWidth}x${canvasHeight}px canvas
- Respect the ${aspectRatio} aspect ratio throughout

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: UNDERSTAND THE ENVIRONMENT (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENVIRONMENT REQUEST: "${params.prompt || 'pixel art background scene'}"

🌍 ENVIRONMENT INTERPRETATION GUIDE:
- "forest" / "숲" = Trees, foliage, woodland scenery
- "dungeon" / "던전" = Stone walls, torches, enclosed space
- "city" / "도시" = Buildings, streets, urban landscape
- "cave" / "동굴" = Rocky interior, crystals, dark atmosphere
- "castle" / "성" = Fortress, towers, medieval architecture
- "beach" / "해변" = Sand, ocean, coastal scenery

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: REPLICATE PIXEL ART BACKGROUND STYLE 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 PIXEL GRID & RESOLUTION (CRITICAL):
- Canvas size: ${canvasWidth}x${canvasHeight}px (FILL COMPLETELY)
- Target pixel density: ${pixelSize}x${Math.floor(pixelSize * (canvasHeight / canvasWidth))}px equivalent
- All tiles/objects on pixel-perfect grid
- NO sub-pixel positioning
- Consistent pixel size throughout
- NO anti-aliasing (crisp pixel edges, sharp and clean)
- NO blur or smoothing filters
- Perfect pixel grid alignment throughout

🔒 COLOR PALETTE & ATMOSPHERE (EXACT MATCH):
- Use EXACT same color palette from reference (NO interpolation)
- Same palette size (16 colors, 32 colors, 64 colors, etc.)
- Match color temperature and saturation EXACTLY
- Copy atmospheric color usage (fog, lighting, mood)
- NO smooth gradients, NO color blending

🔒 TILE-BASED DESIGN (if applicable):
- Same tile size (8x8, 16x16, 32x32 pixels)
- Consistent tile patterns
- Same repetition strategy
- Tile-based layout if reference uses tiles
- Perfect alignment on pixel grid

🔒 PERSPECTIVE & DEPTH:
- Copy perspective type (top-down, side-view, isometric) EXACTLY
- Same depth layering approach (foreground/background)
- Consistent horizon line treatment
- Maintain pixel art perspective conventions

🔒 DETAIL LEVEL & TEXTURE:
- Match level of pixel detail (simplified vs detailed)
- Same texture density
- Copy pattern complexity
- Maintain consistent level across entire scene

🔒 LIGHTING & SHADING (COPY EXACTLY):
- Copy shading technique (hue shifting, color banding, flat, cell shading)
- Same shadow pixel patterns (avoid old dithering patterns)
- Match highlight placement style
- Use modern pixel art shading: hue shifting and color banding preferred
- NO smooth gradients, NO old-school dithering, use clean pixel art shading methods

🔒 OUTLINE & EDGES (MOST IMPORTANT!):
⚠️ CRITICAL: Check reference edge treatment!
- If reference has outlined tiles → Use EXACTLY same outline thickness (1px, 2px, etc.)
- If reference has soft edges → Use same edge treatment
- If reference has NO outlines → Use NO outlines
- Consistent line weight if present
- Copy edge pixel patterns EXACTLY
- NO anti-aliasing on edges
- NEVER make edges thicker or smoother than reference!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ NEGATIVE PROMPT (AVOID):
${params.negativePrompt || 'smooth gradients, realistic rendering, 3D effects'}
- NO characters, people, humans, figures, portraits, faces, living beings
- NO smooth gradients or realistic rendering
- NO anti-aliasing or blur effects
- NO modern high-resolution rendering
- NO 3D effects or realistic lighting

✅ OUTPUT CHECKLIST:
1. ✅ Filled ENTIRE ${canvasWidth}x${canvasHeight}px canvas?
2. ✅ ${aspectRatio} aspect ratio respected?
3. ✅ Pixel-perfect grid alignment?
4. ✅ Exact color palette match?
5. ✅ Same tile size and patterns?
6. ✅ Correct perspective and depth?
7. ✅ NO anti-aliasing or smoothing?
8. ✅ NO characters or living beings?

CRITICAL: This is a pixel art background. Pixel-perfect precision and style matching are essential.
⚠️ MOST IMPORTANT: Fill the ENTIRE ${canvasWidth}x${canvasHeight}px canvas with NO letterboxing!`;
        } else {
          // 다중 그리드 (바리에이션)
          fullPrompt = `🌍 MISSION: Create PIXEL ART BACKGROUND VARIATIONS on a 1024x1024 canvas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: UNDERSTAND THE LAYOUT (CRITICAL!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 CANVAS: 1024x1024px (fixed)
🎯 GRID LAYOUT: ${rows} rows × ${cols} columns = ${totalFrames} variations
🎯 CELL SIZE: ${cellSize}x${cellSize}px per background
🎯 PIXEL ART SIZE: ${pixelSize}x${pixelSize}px (centered in each cell)

📐 GRID STRUCTURE:
${generateGridASCII(rows, cols)}

⚠️ CRITICAL: Each cell contains ONE variation of the environment.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: UNDERSTAND THE ENVIRONMENT (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENVIRONMENT REQUEST: "${params.prompt || 'outdoor landscape'}"

🌍 ENVIRONMENT INTERPRETATION GUIDE:
- "forest" / "숲" = Trees, foliage, woodland scenery
- "dungeon" / "던전" = Stone walls, torches, enclosed space
- "city" / "도시" = Buildings, streets, urban landscape
- "cave" / "동굴" = Rocky interior, crystals, dark atmosphere
- "castle" / "성" = Fortress, towers, medieval architecture
- "beach" / "해변" = Sand, ocean, coastal scenery

🎨 VARIATIONS (${totalFrames} total):
Create ${totalFrames} different variations of the same environment:
- Different times of day (dawn, noon, dusk, night)
- Different weather (clear, rain, snow, fog)
- Different angles (front view, side view, top-down)
- Different areas (entrance, middle section, exit)

⚠️ MAINTAIN CONSISTENCY: All variations share the same environment type and pixel art style!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: REPLICATE PIXEL ART BACKGROUND STYLE 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 PIXEL GRID & RESOLUTION (CRITICAL):
- Canvas size: ${pixelSize}x${pixelSize}px per background
- All tiles/objects on pixel-perfect grid
- NO sub-pixel positioning
- Consistent pixel size throughout
- NO anti-aliasing (crisp pixel edges, sharp and clean)
- NO blur or smoothing filters
- Perfect pixel grid alignment throughout

🔒 COLOR PALETTE & ATMOSPHERE (EXACT MATCH):
- Use EXACT same color palette from reference (NO interpolation)
- Same palette size (16 colors, 32 colors, 64 colors, etc.)
- Match color temperature and saturation EXACTLY
- Copy atmospheric color usage (fog, lighting, mood)
- NO smooth gradients, NO color blending

🔒 TILE-BASED DESIGN (if applicable):
- Same tile size (8x8, 16x16, 32x32 pixels)
- Consistent tile patterns
- Same repetition strategy
- Tile-based layout if reference uses tiles
- Perfect alignment on pixel grid

🔒 PERSPECTIVE & DEPTH:
- Copy perspective type (top-down, side-view, isometric) EXACTLY
- Same depth layering approach (foreground/background)
- Consistent horizon line treatment
- Maintain pixel art perspective conventions

🔒 DETAIL LEVEL & TEXTURE:
- Match level of pixel detail (simplified vs detailed)
- Same texture density
- Copy pattern complexity
- Maintain consistent level across entire scene

🔒 LIGHTING & SHADING (COPY EXACTLY):
- Copy shading technique (hue shifting, color banding, flat, cell shading)
- Same shadow pixel patterns (avoid old dithering patterns)
- Match highlight placement style
- Use modern pixel art shading: hue shifting and color banding preferred
- NO smooth gradients, NO old-school dithering, use clean pixel art shading methods

🔒 OUTLINE & EDGES (MOST IMPORTANT!):
⚠️ CRITICAL: Check reference edge treatment!
- If reference has outlined tiles → Use EXACTLY same outline thickness (1px, 2px, etc.)
- If reference has soft edges → Use same edge treatment
- If reference has NO outlines → Use NO outlines
- Consistent line weight if present
- Copy edge pixel patterns EXACTLY
- NO anti-aliasing on edges
- NEVER make edges thicker or smoother than reference!

🔒 VARIATION CONSISTENCY:
- Environment type stays IDENTICAL across all variations
- Pixel art style NEVER changes between variations
- Only lighting/weather/angle changes, never the core style
- Maintain pixel-perfect grid alignment
- Outline/edge treatment NEVER changes between variations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: LAYOUT ON 1024x1024 CANVAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📐 PRECISE POSITIONING:
- Divide 1024px canvas into ${rows}×${cols} grid
- Each cell is ${cellSize}×${cellSize}px
- Center ${pixelSize}×${pixelSize}px pixel art in each cell
- Leave padding around each background (for clean separation)

🎯 VARIATION ORDER:
Read left-to-right, top-to-bottom (like reading text):
Variation 1 at (0,0), Variation 2 at (1,0), ..., Variation ${cols} at (${cols-1},0)
Variation ${cols+1} at (0,1), ...

⚠️ BLACK BACKGROUND: Use solid black (#000000) background for easy cropping.

🚨 CRITICAL ASPECT RATIO REQUIREMENT:
- ALWAYS fill the ENTIRE ${pixelSize}x${pixelSize}px area within each cell
- NO letterboxing (black bars on top/bottom)
- NO pillarboxing (black bars on left/right)
- The pixel art MUST occupy the FULL ${pixelSize}x${pixelSize}px canvas
- If target aspect ratio is 9:16 (vertical), the background MUST be vertically oriented and fill the full height
- If target aspect ratio is 16:9 (horizontal), the background MUST be horizontally oriented and fill the full width
- NEVER leave empty black space at top, bottom, left, or right edges
- Extend or crop the environment to match the exact aspect ratio requested

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: ENVIRONMENTAL REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- NO characters or creatures (background only, pure environment)
- Focus on environment and scenery
- Suitable for game background use
- Each variation should be unique yet cohesive
- Maintain pixel art aesthetic throughout

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FINAL CHECKLIST:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ✅ ${totalFrames} variations total (${rows}×${cols} grid)?
2. ✅ Each variation is ${pixelSize}×${pixelSize}px pixel art?
3. ✅ All variations share the same environment and style?
4. ✅ Background style EXACTLY matches reference?
5. ✅ Edge/outline treatment EXACTLY matches reference?
6. ✅ NO anti-aliasing or smoothing?
7. ✅ Black background for easy separation?
8. ✅ NO characters or creatures in the backgrounds?

CRITICAL: These are background variations for game development. Pixel-perfect precision is essential.
⚠️ MOST IMPORTANT: Edge treatment must EXACTLY match reference (thin edges = thin edges, NO thickening)!`;
        }
      } else if (hasReferenceImages && params.sessionType === 'PIXELART_ICON') {
        // 픽셀아트 아이콘: 그리드 방식으로 여러 아이콘 바리에이션 생성
        const gridLayout = params.pixelArtGrid || '4x4'; // 기본 4x4
        logger.debug('💎 픽셀아트 아이콘 그리드:', gridLayout, '(전달값:', params.pixelArtGrid, ')');
        const gridInfo = getPixelArtGridInfo(gridLayout);
        const { rows, cols, totalFrames, cellSize, recommendedPixelSize } = gridInfo;

        // 분석 결과에서 실제 해상도 추출 (fallback: gridInfo.recommendedPixelSize)
        const pixelSize = parseResolutionEstimate(
          params.analysis?.pixelart_specific?.resolution_estimate
        ) || recommendedPixelSize;

        fullPrompt = `💎 MISSION: Create PIXEL ART ICON VARIATIONS on a 1024x1024 canvas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: UNDERSTAND THE LAYOUT (CRITICAL!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 CANVAS: 1024x1024px (fixed)
🎯 GRID LAYOUT: ${rows} rows × ${cols} columns = ${totalFrames} icons
🎯 CELL SIZE: ${cellSize}x${cellSize}px per icon
🎯 PIXEL ART SIZE: ${pixelSize}x${pixelSize}px (centered in each cell)

📐 GRID STRUCTURE:
${generateGridASCII(rows, cols)}

⚠️ CRITICAL: Each cell contains ONE icon variation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: UNDERSTAND THE ICON TYPE (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ICON REQUEST: "${params.prompt || 'game item icons'}"

💎 ICON INTERPRETATION GUIDE:
- "potion" / "물약" = Bottle/flask with liquid, health/mana restoration item
- "coin" / "동전" = Currency, circular metal object, gold/silver
- "gem" / "보석" = Crystal, jewel, shiny precious stone
- "weapon" / "무기" = Sword, axe, bow, dagger, or other combat tools
- "food" / "음식" = Apple, bread, meat, consumable items
- "key" / "열쇠" = Unlock item, metallic, distinctive shape
- "scroll" / "두루마리" = Parchment, magic spell, rolled paper

🎨 ICON VARIATIONS (${totalFrames} total):
Create ${totalFrames} different variations of the same icon type:
- Different colors (red potion, blue potion, green potion)
- Different sizes or levels (small gem, medium gem, large gem)
- Different states (empty bottle, half-full, full)
- Different rarities (common, rare, legendary)
- Different subtypes (health potion, mana potion, stamina potion)

⚠️ MAINTAIN CONSISTENCY: All icons share the same style and basic form!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: REPLICATE PIXEL ART ICON STYLE 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 PIXEL GRID & RESOLUTION (CRITICAL):
- Canvas size: ${pixelSize}x${pixelSize}px per icon
- All pixels on perfect integer grid
- NO sub-pixel positioning
- Consistent pixel size throughout
- NO anti-aliasing (pure pixel edges, crisp and sharp)
- NO blur or smoothing filters
- Perfect pixel grid alignment

🔒 ICON FORM & STRUCTURE (COPY EXACTLY):
- Overall shape language from reference (rounded, angular, organic)
- Same proportion and scale approach
- Clear silhouette for readability at small sizes
- Size ratio of details to main object EXACTLY matches reference

🔒 OUTLINE & EDGE STYLE (MOST IMPORTANT!):
⚠️ CRITICAL: Check reference outline style!
- If reference has 1px black outlines → Use EXACTLY 1px black outlines (NOT 2px!)
- If reference has colored outlines → Use SAME colored outlines
- If reference has NO outlines → Use NO outlines
- Pixel Perfect lines: NO doubles, NO jaggies
- Same edge treatment as reference
- Clear icon readability
- NEVER make outlines thicker than reference!

🔒 COLOR PALETTE (EXACT MATCH):
- Use EXACT same colors from reference (NO color interpolation)
- Same palette size (4 colors, 8 colors, 16 colors, etc.)
- Match saturation, brightness, hue EXACTLY
- NO smooth gradients, NO color blending
- Use color variations for different icon types (e.g., red/blue/green potions)

🔒 SHADING TECHNIQUE (COPY EXACTLY):
- Copy shading method (hue shifting, color banding, flat colors, cell shading)
- Same highlight placement and style
- Same shadow pixel patterns (avoid old dithering patterns)
- Use modern pixel art shading: hue shifting and color banding preferred
- NO smooth shading, NO anti-aliasing, NO old-school dithering

🔒 MATERIAL REPRESENTATION (MATCH REFERENCE):
- How glass/liquid appears (transparency, shine)
- How metal looks (reflective, matte, colored)
- How gems/crystals are rendered (facets, glow)
- Surface texture style (smooth, rough, pixelated)

🔒 BACKGROUND & FRAMING (COPY EXACTLY):
- Background treatment from reference (solid color, gradient, transparent)
- Border/frame style if present in reference
- Centered composition
- Consistent negative space handling

🔒 VARIATION CONSISTENCY:
- Icon style stays IDENTICAL across all variations
- Only colors/details change, never the core pixel art style
- Outline thickness NEVER changes between variations
- Pixel grid alignment maintained across all icons

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: LAYOUT ON 1024x1024 CANVAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📐 PRECISE POSITIONING:
- Divide 1024px canvas into ${rows}×${cols} grid
- Each cell is ${cellSize}×${cellSize}px
- Center ${pixelSize}×${pixelSize}px pixel art in each cell
- Leave padding around each icon (for clean separation)

🎯 ICON ORDER:
Read left-to-right, top-to-bottom (like reading text):
Icon 1 at (0,0), Icon 2 at (1,0), ..., Icon ${cols} at (${cols-1},0)
Icon ${cols+1} at (0,1), ...

⚠️ BLACK BACKGROUND: Use solid black (#000000) background for easy cropping.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: ICON-SPECIFIC REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Clear, recognizable silhouette at small sizes
- Readable as game UI icon
- Focus on single main object per icon
- Consistent icon clarity across all variations
- Suitable for game inventory, shop, or UI use

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FINAL CHECKLIST:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ✅ ${totalFrames} icons total (${rows}×${cols} grid)?
2. ✅ Each icon is ${pixelSize}×${pixelSize}px pixel art?
3. ✅ All icons share the same style and form?
4. ✅ Icon style EXACTLY matches reference?
5. ✅ Outline thickness EXACTLY matches reference (1px = 1px, NOT 2px)?
6. ✅ NO anti-aliasing or smoothing?
7. ✅ Black background for easy separation?
8. ✅ Clear and readable at small sizes?

CRITICAL: These are game UI icons. Pixel-perfect precision and readability are essential.
⚠️ MOST IMPORTANT: If reference has 1px outlines, NEVER use 2px or thicker outlines!`;
      } else if (hasReferenceImages && params.sessionType === 'CHARACTER') {
        // 캐릭터 세션: 포즈 변경 최우선 + 캐릭터 외형/비율 완벽 복사
        // Grid 지원 추가
        if (params.pixelArtGrid && params.pixelArtGrid !== '1x1') {
          const gridLayout = params.pixelArtGrid;
          logger.debug('👤 캐릭터 그리드:', gridLayout, '(전달값:', params.pixelArtGrid, ')');
          const gridInfo = getPixelArtGridInfo(gridLayout);
          const { rows, cols, totalFrames, cellSize } = gridInfo;
          const characterSize = cellSize; // 각 셀 전체를 사용

          fullPrompt = `👤 MISSION: Create MULTIPLE CHARACTER POSE VARIATIONS in a grid layout on a 1024x1024 canvas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: UNDERSTAND THE LAYOUT (CRITICAL!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 CANVAS: 1024x1024px (fixed)
🎯 GRID LAYOUT: ${rows} rows × ${cols} columns = ${totalFrames} poses
🎯 CELL SIZE: ${cellSize}x${cellSize}px per character
🎯 CHARACTER SIZE: ${characterSize}x${characterSize}px (fills each cell)

📐 GRID STRUCTURE:
${generateGridASCII(rows, cols)}

⚠️ CRITICAL: Each cell contains ONE complete character pose.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: UNDERSTAND THE POSE REQUEST (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

POSE REQUEST: "${params.prompt || 'various character poses'}"

🎯 INTERPRET THE POSE REQUEST:
- "standing" / "서있는" = Natural upright stance, arms relaxed
- "sitting" / "앉은" = Legs bent, bottom on ground or chair
- "running" / "달리는" = Dynamic motion, one leg forward
- "jumping" / "점프" = Airborne, legs bent or extended
- "attacking" / "공격" = Combat pose, weapon or fist extended
- "idle" / "대기" = Relaxed stance, slight movement

🎨 POSE VARIATIONS (${totalFrames} total):
Create ${totalFrames} different character poses:
- Different actions (standing, walking, running, jumping, sitting)
- Different expressions (happy, sad, angry, surprised, neutral)
- Different angles (front, side, back, 3/4 view)
- Different arm/leg positions
- Animation frames (walk cycle, run cycle, etc.)

⚠️ CRITICAL: The reference images show the CHARACTER APPEARANCE to copy - their POSE is just an example!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: COPY CHARACTER APPEARANCE 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

While creating NEW poses, copy these features EXACTLY:

🔒 BODY PROPORTIONS (NEVER CHANGE THESE):
- Head-to-body ratio: Count heads in reference (e.g., 2-head, 3-head, 8-head) → USE EXACT SAME RATIO
- Leg length: Measure legs vs torso in reference → COPY EXACT RATIO
- If legs are SHORT in reference → Keep them SHORT in ALL poses
- If legs are LONG in reference → Keep them LONG in ALL poses
- Arm length, torso height, limb thickness → ALL identical to reference
- Overall "chibi" or "realistic" style → MUST match reference

🔒 HAIR:
- Hairstyle, bangs/fringe, length, color
- DO NOT omit bangs if present in reference
- Hair should move naturally with pose changes

🔒 FACE:
- Eye style, nose, mouth, face shape
- Facial expression can change per pose

🔒 CLOTHING:
- Outfit design, colors, accessories
- Clothing should flow naturally with pose

🔒 ART STYLE:
- Line quality, shading, coloring technique
- Style MUST stay identical across all poses

🔒 POSE CONSISTENCY:
- Character appearance stays IDENTICAL across all poses
- Only pose/expression changes, never proportions or design
- Maintain consistent character volume and silhouette
- NEVER change body proportions between poses

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: LAYOUT ON 1024x1024 CANVAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📐 PRECISE POSITIONING:
- Divide 1024px canvas into ${rows}×${cols} grid
- Each cell is ${cellSize}×${cellSize}px
- Each character fills its ${characterSize}×${characterSize}px cell completely
- Center character in each cell with white background
- Full body visible (head to feet)

🎯 CHARACTER ORDER:
Read left-to-right, top-to-bottom (like reading text):
Pose 1 at (0,0), Pose 2 at (1,0), ..., Pose ${cols} at (${cols-1},0)
Pose ${cols+1} at (0,1), ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: CHARACTER-SPECIFIC REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Full body visible in every pose (no cropping)
- White or transparent background
- Clear silhouette for each pose
- Consistent character design across all cells
- Suitable for character reference sheets

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FINAL CHECK BEFORE GENERATING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ✅ ${totalFrames} character poses total (${rows}×${cols} grid)?
2. ✅ Each character fills its ${characterSize}×${characterSize}px cell?
3. ✅ All characters share the EXACT SAME appearance/proportions?
4. ✅ Body proportions EXACTLY match reference (leg length, head ratio)?
5. ✅ Full body visible in every pose?
6. ✅ Consistent quality across all poses?

CRITICAL: These are character pose variations. The CHARACTER must stay identical, only the POSE changes.
NEVER "improve" or "normalize" body proportions. COPY them EXACTLY across all poses.
If reference shows SHORT legs → ALL poses MUST have SHORT legs.
If reference shows LONG legs → ALL poses MUST have LONG legs.`;
        } else {
          // 단일 포즈 변경 (기존 프롬프트)
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
        }
      } else if (hasReferenceImages && params.sessionType === 'STYLE') {
        // 스타일 세션: 스타일 일관성 최우선
        // Grid 지원 추가
        if (params.pixelArtGrid && params.pixelArtGrid !== '1x1') {
          const gridLayout = params.pixelArtGrid;
          logger.debug('✨ 스타일 그리드:', gridLayout, '(전달값:', params.pixelArtGrid, ')');
          const gridInfo = getPixelArtGridInfo(gridLayout);
          const { rows, cols, totalFrames, cellSize } = gridInfo;
          const artworkSize = cellSize; // 각 셀 전체를 사용

          fullPrompt = `✨ MISSION: Create MULTIPLE STYLE VARIATIONS in a grid layout on a 1024x1024 canvas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: UNDERSTAND THE LAYOUT (CRITICAL!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 CANVAS: 1024x1024px (fixed)
🎯 GRID LAYOUT: ${rows} rows × ${cols} columns = ${totalFrames} artworks
🎯 CELL SIZE: ${cellSize}x${cellSize}px per artwork
🎯 ARTWORK SIZE: ${artworkSize}x${artworkSize}px (fills each cell)

📐 GRID STRUCTURE:
${generateGridASCII(rows, cols)}

⚠️ CRITICAL: Each cell contains ONE complete artwork.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: UNDERSTAND THE CONTENT REQUEST (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTENT REQUEST: "${params.prompt || 'various artistic compositions'}"

🎨 CONTENT VARIATIONS (${totalFrames} total):
Create ${totalFrames} different variations of the content:
- Different compositions (landscape, portrait, close-up, wide shot)
- Different subjects (people, objects, nature, abstract)
- Different moods (happy, dramatic, peaceful, energetic)
- Different perspectives (eye-level, bird's eye, worm's eye)
- Different focal points (center, rule of thirds, asymmetric)

⚠️ CRITICAL: The reference images show the VISUAL STYLE to copy - create NEW content with that style!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: REPLICATE THE VISUAL STYLE 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a STYLE CLONING AI. Your job is to PERFECTLY COPY the visual style shown in the reference images.

While creating NEW content, COPY these style elements EXACTLY:

🔒 ART STYLE & TECHNIQUE:
- Drawing/painting technique (watercolor, oil, digital, pencil, etc.)
- Artistic approach (realistic, impressionistic, abstract, stylized)
- Level of realism/stylization
- Brushwork or line quality
- Artist's signature style

🔒 COLOR & PALETTE:
- Exact color palette from references
- Color saturation, brightness, contrast levels
- Color relationships and harmonies
- Color temperature (warm/cool tones)
- Color application technique

🔒 LINES & EDGES:
- Line weight, thickness, variation
- Line quality (smooth, rough, sketchy, clean)
- Edge treatment (hard, soft, blurred, sharp)
- Line style consistency
- Outline presence and style

🔒 SHADING & LIGHTING:
- Shading technique (cell-shaded, soft, gradient, flat)
- Light source direction and intensity
- Shadow style and density
- Highlight placement and intensity
- Overall lighting mood

🔒 TEXTURE & SURFACE:
- Material rendering style
- Texture detail level
- Surface treatment (smooth, rough, textured)
- Texture techniques and patterns
- Surface finish (matte, glossy, mixed)

🔒 COMPOSITION & LAYOUT:
- Compositional principles from reference
- Balance and symmetry approach
- Depth and space handling
- Focal point strategy
- Visual flow and hierarchy

🔒 OVERALL AESTHETIC:
- Visual "feel" and atmosphere
- Mood and emotional tone
- Artistic signature and identity
- Visual consistency and coherence

🔒 VARIATION CONSISTENCY:
- Art style stays IDENTICAL across all variations
- Only content/composition changes, never the core visual style
- Maintain consistent quality and detail level
- All artworks feel like they're by the same artist

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: LAYOUT ON 1024x1024 CANVAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📐 PRECISE POSITIONING:
- Divide 1024px canvas into ${rows}×${cols} grid
- Each cell is ${cellSize}×${cellSize}px
- Each artwork fills its ${artworkSize}×${artworkSize}px cell completely
- NO padding or spacing (artworks fill cells edge-to-edge)

🎯 ARTWORK ORDER:
Read left-to-right, top-to-bottom (like reading text):
Artwork 1 at (0,0), Artwork 2 at (1,0), ..., Artwork ${cols} at (${cols-1},0)
Artwork ${cols+1} at (0,1), ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: STYLE-SPECIFIC REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Each artwork is a complete composition
- Style consistency is MANDATORY across all cells
- Content can vary, but style NEVER changes
- Quality level must be consistent
- All artworks should look like portfolio pieces

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FINAL CHECK BEFORE GENERATING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ✅ ${totalFrames} artworks total (${rows}×${cols} grid)?
2. ✅ Each artwork fills its ${artworkSize}×${artworkSize}px cell?
3. ✅ All artworks share the same visual style?
4. ✅ Art style EXACTLY matches reference?
5. ✅ Content varies but style is consistent?
6. ✅ Consistent quality across all artworks?

CRITICAL: These are style variations. The VISUAL STYLE must stay identical, only the CONTENT changes.
NEVER add your own style interpretation. CLONE the reference style EXACTLY.`;
        } else {
          // 단일 작품 생성 (기존 프롬프트)
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
        }
      } else if (hasReferenceImages) {
        // 기타 세션 타입 (참조 이미지 있지만 위 조건에 해당 안 됨)
        fullPrompt = `${params.prompt}`;
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
