import { SessionType } from '../../types/session';
import { ReferenceDocument } from '../../types/referenceDocument';
import { PixelArtGridLayout, getPixelArtGridInfo } from '../../types/pixelart';
import { ImageAnalysisResult } from '../../types/analysis';

/**
 * 해상도 문자열에서 숫자 추출
 */
function parseResolutionEstimate(resolutionStr?: string): number {
  if (!resolutionStr) return 128;
  const match = resolutionStr.match(/(\d+)x(\d+)/);
  if (!match) return 128;
  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);
  const maxDimension = Math.max(width, height);
  return Math.max(16, Math.min(512, maxDimension));
}

/**
 * 세션 타입에 따른 프롬프트 생성 파라미터
 */
export interface PromptGenerationParams {
  basePrompt: string;
  hasReferenceImages: boolean;
  sessionType?: SessionType;
  pixelArtGrid?: PixelArtGridLayout;
  analysis?: ImageAnalysisResult;
  referenceDocuments?: ReferenceDocument[];
}

/**
 * 세션 타입별 프롬프트 생성 함수 맵
 */
type PromptGeneratorFunction = (params: PromptGenerationParams) => string;

const promptGenerators: Record<SessionType, PromptGeneratorFunction> = {
  CHARACTER: generateCharacterPrompt,
  BACKGROUND: generateBackgroundPrompt,
  ICON: generateIconPrompt,
  STYLE: generateStylePrompt,
  UI: generateUIPrompt,
  LOGO: generateLogoPrompt,
  PIXELART_CHARACTER: generatePixelArtCharacterPrompt,
  PIXELART_BACKGROUND: generatePixelArtBackgroundPrompt,
  PIXELART_ICON: generatePixelArtIconPrompt,
};

/**
 * 메인 프롬프트 빌더 함수
 */
export function buildPromptForSession(params: PromptGenerationParams): string {
  if (!params.hasReferenceImages || !params.sessionType) {
    return params.basePrompt;
  }

  const generator = promptGenerators[params.sessionType];
  if (!generator) {
    return params.basePrompt;
  }

  return generator(params);
}

/**
 * CHARACTER 세션 프롬프트 생성
 */
function generateCharacterPrompt(params: PromptGenerationParams): string {
  const { basePrompt, pixelArtGrid } = params;

  // Grid 지원 추가
  if (pixelArtGrid && pixelArtGrid !== '1x1') {
    const gridInfo = getPixelArtGridInfo(pixelArtGrid);
    const gridLayout = `${gridInfo.rows}x${gridInfo.cols}`;
    const frameCount = gridInfo.rows * gridInfo.cols;
    return `🎯 POSE VARIATIONS GRID (${frameCount} cells in ${gridLayout} layout)

🎨 STYLE CONSISTENCY REQUIREMENTS:
✓ Use EXACTLY the same character design from the reference images
✓ Match: face shape, eye style, hair style/color, outfit, body proportions
✓ Keep all distinctive features (accessories, patterns, colors) identical
✓ Same art style and rendering technique across all poses

🖼️ BACKGROUND: Pure white background (#FFFFFF) for all cells. No gradients, no patterns, no other colors.

⛔ CRITICAL - NO GRID LINES: Do NOT draw any lines, borders, dividers, or separators between cells. Each cell must seamlessly blend with adjacent white backgrounds. The grid layout is purely conceptual for arranging poses - there should be NO visible grid structure in the final image.

🤸 POSE VARIATIONS (${frameCount} different poses):
${basePrompt || 'Various action poses and expressions'}

CRITICAL: Each cell shows the SAME character in a different pose/angle.
Do NOT change the character's appearance, colors, or outfit between cells.

Generate the ${gridLayout} grid of character pose variations now.`;
  }

  // 단일 포즈 (1x1)
  return `Maintain the exact same character design (face, hair, outfit, proportions, colors) from the reference images.

BACKGROUND: Pure white background (#FFFFFF). No gradients, no patterns, no other colors.

New pose: ${basePrompt}

Keep all distinctive features identical. Only change the pose/expression.`;
}

/**
 * BACKGROUND 세션 프롬프트 생성
 */
function generateBackgroundPrompt(params: PromptGenerationParams): string {
  const { basePrompt, pixelArtGrid } = params;

  if (pixelArtGrid && pixelArtGrid !== '1x1') {
    const gridInfo = getPixelArtGridInfo(pixelArtGrid);
    const gridLayout = `${gridInfo.rows}x${gridInfo.cols}`;
    const frameCount = gridInfo.rows * gridInfo.cols;
    return `🎯 BACKGROUND VARIATIONS GRID (${frameCount} cells in ${gridLayout} layout)

🎨 STYLE CONSISTENCY:
✓ Match the art style from reference images
✓ Keep the same color palette and rendering technique
✓ Maintain consistent atmosphere and mood
✓ Use similar composition principles

⛔ CRITICAL - NO GRID LINES: Do NOT draw any lines, borders, dividers, or separators between cells. The grid layout is purely conceptual - there should be NO visible grid structure in the final image.

🌄 SCENE VARIATIONS (${frameCount} different environments):
${basePrompt || 'Various background environments'}

Generate ${frameCount} background variations in a ${gridLayout} grid.`;
  }

  return `Create a background matching the art style of the reference images.

Scene: ${basePrompt}

Match the color palette, rendering technique, and atmosphere.`;
}

/**
 * ICON 세션 프롬프트 생성
 */
function generateIconPrompt(params: PromptGenerationParams): string {
  const { basePrompt, pixelArtGrid } = params;

  if (pixelArtGrid && pixelArtGrid !== '1x1') {
    const gridInfo = getPixelArtGridInfo(pixelArtGrid);
    const gridLayout = `${gridInfo.rows}x${gridInfo.cols}`;
    const frameCount = gridInfo.rows * gridInfo.cols;
    return `🎯 ICON SET (${frameCount} icons in ${gridLayout} grid)

🎨 STYLE CONSISTENCY:
✓ Match icon style from reference images
✓ Keep same rendering technique
✓ Consistent color palette
✓ Similar complexity level
✓ Centered composition

🖼️ BACKGROUND: Pure white background (#FFFFFF) for all cells. No gradients, no patterns, no other colors.

⛔ CRITICAL - NO GRID LINES: Do NOT draw any lines, borders, dividers, or separators between cells. Each cell must seamlessly blend with adjacent white backgrounds. The grid layout is purely conceptual - there should be NO visible grid structure in the final image.

🎲 ICON VARIATIONS (${frameCount} different icons):
${basePrompt || 'Various game icons'}

Generate ${frameCount} icons in consistent style.`;
  }

  return `Create an icon matching the style from reference images.

BACKGROUND: Pure white background (#FFFFFF). No gradients, no patterns, no other colors.

Icon: ${basePrompt}

Match the rendering technique, color palette, and composition.`;
}

/**
 * STYLE 세션 프롬프트 생성
 */
function generateStylePrompt(params: PromptGenerationParams): string {
  const { basePrompt, pixelArtGrid } = params;

  if (pixelArtGrid && pixelArtGrid !== '1x1') {
    const gridInfo = getPixelArtGridInfo(pixelArtGrid);
    const gridLayout = `${gridInfo.rows}x${gridInfo.cols}`;
    const frameCount = gridInfo.rows * gridInfo.cols;
    return `🎯 STYLE VARIATIONS GRID (${frameCount} cells in ${gridLayout} layout)

🎨 STYLE CONSISTENCY:
✓ Match art style from reference images
✓ Keep rendering technique consistent
✓ Use similar color palette
✓ Maintain consistent quality level

⛔ CRITICAL - NO GRID LINES: Do NOT draw any lines, borders, dividers, or separators between cells. The grid layout is purely conceptual - there should be NO visible grid structure in the final image.

✨ CONTENT VARIATIONS (${frameCount} different images):
${basePrompt || 'Various artistic compositions'}

Generate ${frameCount} images in consistent style.`;
  }

  return `Create an image matching the art style from reference images.

Content: ${basePrompt}

Match the rendering technique, color palette, and overall aesthetic.`;
}

/**
 * UI 세션 프롬프트 생성
 */
function generateUIPrompt(params: PromptGenerationParams): string {
  const { basePrompt, pixelArtGrid, referenceDocuments } = params;

  let documentContext = '';
  if (referenceDocuments && referenceDocuments.length > 0) {
    documentContext = '\n\n📄 REFERENCE DOCUMENTS:\n';
    referenceDocuments.forEach((doc, idx) => {
      documentContext += `\n[Document ${idx + 1}] ${doc.fileName}:\n${doc.content}\n`;
    });
  }

  if (pixelArtGrid && pixelArtGrid !== '1x1') {
    const gridInfo = getPixelArtGridInfo(pixelArtGrid);
    const gridLayout = `${gridInfo.rows}x${gridInfo.cols}`;
    const frameCount = gridInfo.rows * gridInfo.cols;
    return `🎯 UI SCREEN SET (${frameCount} screens in ${gridLayout} grid)

🎨 UI STYLE CONSISTENCY:
✓ Match UI style from reference images
✓ Consistent design system (buttons, colors, fonts)
✓ Similar layout principles
✓ Cohesive visual hierarchy

⛔ CRITICAL - NO GRID LINES: Do NOT draw any lines, borders, dividers, or separators between cells. The grid layout is purely conceptual - there should be NO visible grid structure in the final image.${documentContext}

📱 SCREEN VARIATIONS (${frameCount} different UI screens):
${basePrompt || 'Various UI screens'}

Generate ${frameCount} UI screens in consistent style.`;
  }

  return `Create a UI screen matching the design style from reference images.${documentContext}

Screen: ${basePrompt}

Match the design system, layout principles, and visual hierarchy.`;
}

/**
 * LOGO 세션 프롬프트 생성
 */
function generateLogoPrompt(params: PromptGenerationParams): string {
  const { basePrompt, pixelArtGrid } = params;

  if (pixelArtGrid && pixelArtGrid !== '1x1') {
    const gridInfo = getPixelArtGridInfo(pixelArtGrid);
    const gridLayout = `${gridInfo.rows}x${gridInfo.cols}`;
    const frameCount = gridInfo.rows * gridInfo.cols;
    return `🎯 LOGO VARIATIONS GRID (${frameCount} logos in ${gridLayout} layout)

🎨 STYLE CONSISTENCY:
✓ Match logo style from reference images
✓ Keep typography approach similar
✓ Consistent treatment (3D, outline, effects)
✓ Similar material/texture style
✓ Coherent color vibrancy

🖼️ BACKGROUND: Pure white background (#FFFFFF) for all cells. No gradients, no patterns, no other colors.

⛔ CRITICAL - NO GRID LINES: Do NOT draw any lines, borders, dividers, or separators between cells. Each cell must seamlessly blend with adjacent white backgrounds. The grid layout is purely conceptual - there should be NO visible grid structure in the final image.

🔤 LOGO VARIATIONS (${frameCount} different versions):
${basePrompt || 'Logo title variations'}

⚠️ AI TEXT LIMITATION: The AI may not spell text perfectly. Focus on design aesthetics.

Generate ${frameCount} logo variations in consistent style.`;
  }

  return `Create a logo matching the style from reference images.

BACKGROUND: Pure white background (#FFFFFF). No gradients, no patterns, no other colors.

Logo: ${basePrompt}

⚠️ AI TEXT LIMITATION: The AI may not spell text perfectly. Focus on design aesthetics.

Match the typography style, treatment, and visual effects.`;
}

/**
 * PIXELART_CHARACTER 세션 프롬프트 생성
 */
function generatePixelArtCharacterPrompt(params: PromptGenerationParams): string {
  const { basePrompt, pixelArtGrid, analysis } = params;

  const resolution = parseResolutionEstimate(analysis?.pixelart_specific?.resolution_estimate);

  if (pixelArtGrid && pixelArtGrid !== '1x1') {
    const gridInfo = getPixelArtGridInfo(pixelArtGrid);
    const gridLayout = `${gridInfo.rows}x${gridInfo.cols}`;
    const frameCount = gridInfo.rows * gridInfo.cols;
    return `🎯 PIXEL ART SPRITE SHEET (${frameCount} frames in ${gridLayout} grid)

🎮 PIXEL ART REQUIREMENTS:
✓ Resolution: ${resolution}x${resolution}px per cell
✓ Match pixel art style from reference
✓ Consistent character design across all frames
✓ Same color palette (limited colors)
✓ Crisp pixel edges (no anti-aliasing)

🖼️ BACKGROUND: Pure white background (#FFFFFF) for all cells. No gradients, no patterns, no checkered pattern, no transparency.

⛔ CRITICAL - NO GRID LINES: Do NOT draw any lines, borders, dividers, or separators between cells. Each cell must seamlessly blend with adjacent white backgrounds. The grid layout is purely conceptual - there should be NO visible grid structure in the final image.

🤸 ANIMATION SEQUENCE (${frameCount} frames):
${basePrompt || 'Character animation frames'}

Generate ${frameCount} pixel art frames in ${gridLayout} grid.`;
  }

  return `Create a pixel art character matching the style from reference images.

Animation: ${basePrompt}

Resolution: ${resolution}x${resolution}px
Match the pixel art style, color palette, and character design.

BACKGROUND: Pure white background (#FFFFFF) only. No gradients, no patterns, no checkered pattern, no transparency.`;
}

/**
 * PIXELART_BACKGROUND 세션 프롬프트 생성
 */
function generatePixelArtBackgroundPrompt(params: PromptGenerationParams): string {
  const { basePrompt, pixelArtGrid, analysis } = params;

  const resolution = parseResolutionEstimate(analysis?.pixelart_specific?.resolution_estimate);

  if (pixelArtGrid && pixelArtGrid !== '1x1') {
    const gridInfo = getPixelArtGridInfo(pixelArtGrid);
    const gridLayout = `${gridInfo.rows}x${gridInfo.cols}`;
    const frameCount = gridInfo.rows * gridInfo.cols;
    return `🎯 PIXEL ART BACKGROUND SET (${frameCount} scenes in ${gridLayout} grid)

🎮 PIXEL ART REQUIREMENTS:
✓ Resolution: ${resolution}x${resolution}px per cell
✓ Match pixel art style from reference
✓ Consistent art style across scenes
✓ Same color palette approach
✓ Crisp pixel edges (no anti-aliasing)

⛔ CRITICAL - NO GRID LINES: Do NOT draw any lines, borders, dividers, or separators between cells. The grid layout is purely conceptual - there should be NO visible grid structure in the final image.

🌄 SCENE VARIATIONS (${frameCount} backgrounds):
${basePrompt || 'Background scene variations'}

Generate ${frameCount} pixel art backgrounds in ${gridLayout} grid.`;
  }

  return `Create a pixel art background matching the style from reference images.

Scene: ${basePrompt}

Resolution: ${resolution}x${resolution}px
Match the pixel art style and color palette.`;
}

/**
 * PIXELART_ICON 세션 프롬프트 생성
 */
function generatePixelArtIconPrompt(params: PromptGenerationParams): string {
  const { basePrompt, pixelArtGrid, analysis } = params;

  const resolution = parseResolutionEstimate(analysis?.pixelart_specific?.resolution_estimate);

  if (pixelArtGrid && pixelArtGrid !== '1x1') {
    const gridInfo = getPixelArtGridInfo(pixelArtGrid);
    const gridLayout = `${gridInfo.rows}x${gridInfo.cols}`;
    const frameCount = gridInfo.rows * gridInfo.cols;
    return `🎯 PIXEL ART ICON SET (${frameCount} icons in ${gridLayout} grid)

🎮 PIXEL ART REQUIREMENTS:
✓ Resolution: ${resolution}x${resolution}px per cell
✓ Match pixel art style from reference
✓ Consistent icon style
✓ Same color palette
✓ Crisp pixel edges (no anti-aliasing)
✓ Centered composition

🖼️ BACKGROUND: Pure white background (#FFFFFF) for all cells. No gradients, no patterns, no checkered pattern, no transparency.

⛔ CRITICAL - NO GRID LINES: Do NOT draw any lines, borders, dividers, or separators between cells. Each cell must seamlessly blend with adjacent white backgrounds. The grid layout is purely conceptual - there should be NO visible grid structure in the final image.

🎲 ICON VARIATIONS (${frameCount} items):
${basePrompt || 'Game item icons'}

Generate ${frameCount} pixel art icons in ${gridLayout} grid.`;
  }

  return `Create a pixel art icon matching the style from reference images.

Icon: ${basePrompt}

Resolution: ${resolution}x${resolution}px
Match the pixel art style and color palette.

BACKGROUND: Pure white background (#FFFFFF) only. No gradients, no patterns, no checkered pattern, no transparency.`;
}
