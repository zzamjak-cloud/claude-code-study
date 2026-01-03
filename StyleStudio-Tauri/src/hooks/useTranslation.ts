import { useGeminiTranslator } from './api/useGeminiTranslator';
import { ImageAnalysisResult } from '../types/analysis';
import { Session, KoreanAnalysisCache } from '../types/session';
import { buildUnifiedPrompt } from '../lib/promptBuilder';
import { logger } from '../lib/logger';

interface TranslationProgress {
  stage: string;
  message: string;
  percentage: number;
}

/**
 * 분석 결과를 한국어로 번역 (전체 번역)
 */
export function useTranslation() {
  const { translateBatchToKorean, translateBatchToEnglish, translateToEnglish, containsKorean } =
    useGeminiTranslator();

  /**
   * 전체 분석 결과를 한국어로 번역
   */
  const translateAnalysisResult = async (
    apiKey: string,
    analysis: ImageAnalysisResult
  ): Promise<KoreanAnalysisCache> => {
    try {
      // 모든 필드를 하나의 배열로 모아서 한 번에 번역 (영어→한국어)
      const allTexts = [
        // Style (5개)
        analysis.style.art_style,
        analysis.style.technique,
        analysis.style.color_palette,
        analysis.style.lighting,
        analysis.style.mood,
        // Character (11개)
        analysis.character.gender,
        analysis.character.age_group,
        analysis.character.hair,
        analysis.character.eyes,
        analysis.character.face,
        analysis.character.outfit,
        analysis.character.accessories,
        analysis.character.body_proportions,
        analysis.character.limb_proportions,
        analysis.character.torso_shape,
        analysis.character.hand_style,
        // Composition (4개)
        analysis.composition.pose,
        analysis.composition.angle,
        analysis.composition.background,
        analysis.composition.depth_of_field,
        // Prompts (2개)
        buildUnifiedPrompt(analysis).positivePrompt,
        analysis.negative_prompt,
      ];

      // 한 번의 API 호출로 모든 필드 번역 (영어→한국어)
      const translations = await translateBatchToKorean(apiKey, allTexts);

      // 사용자 맞춤 프롬프트를 영어로 번역 (한국어→영어, 이미지 생성용)
      const customPromptEnglish = analysis.user_custom_prompt
        ? await translateToEnglish(apiKey, analysis.user_custom_prompt)
        : '';

      const koreanCache: KoreanAnalysisCache = {
        style: {
          art_style: translations[0],
          technique: translations[1],
          color_palette: translations[2],
          lighting: translations[3],
          mood: translations[4],
        },
        character: {
          gender: translations[5],
          age_group: translations[6],
          hair: translations[7],
          eyes: translations[8],
          face: translations[9],
          outfit: translations[10],
          accessories: translations[11],
          body_proportions: translations[12],
          limb_proportions: translations[13],
          torso_shape: translations[14],
          hand_style: translations[15],
        },
        composition: {
          pose: translations[16],
          angle: translations[17],
          background: translations[18],
          depth_of_field: translations[19],
        },
        positivePrompt: translations[20],
        negativePrompt: translations[21],
        customPromptEnglish: customPromptEnglish,
      };

      return koreanCache;
    } catch (error) {
      logger.error('❌ 번역 오류:', error);
      // 번역 실패 시 빈 캐시 반환
      return {};
    }
  };

  /**
   * 변경된 내용이 있는지 확인
   */
  const hasChangesToTranslate = (
    analysisResult: ImageAnalysisResult | null,
    currentSession: Session | null
  ): boolean => {
    if (!analysisResult || !currentSession?.koreanAnalysis) {
      return false;
    }

    const oldAnalysis = currentSession.analysis;

    // style 변경 확인
    const styleChanged =
      JSON.stringify(oldAnalysis.style) !== JSON.stringify(analysisResult.style);

    // character 변경 확인
    const characterChanged =
      JSON.stringify(oldAnalysis.character) !== JSON.stringify(analysisResult.character);

    // composition 변경 확인
    const compositionChanged =
      JSON.stringify(oldAnalysis.composition) !== JSON.stringify(analysisResult.composition);

    // negative_prompt 변경 확인
    const negativeChanged = oldAnalysis.negative_prompt !== analysisResult.negative_prompt;

    return styleChanged || characterChanged || compositionChanged || negativeChanged;
  };

  /**
   * 변경된 내용 번역 및 캐싱 갱신
   */
  const translateAndUpdateCache = async (
    apiKey: string,
    analysisResult: ImageAnalysisResult,
    currentSession: Session,
    onProgress?: (progress: TranslationProgress) => void
  ) => {
    if (!apiKey || !currentSession) {
      throw new Error('API 키 또는 세션이 없습니다');
    }

    try {
      const oldAnalysis = currentSession.analysis;
      let updatedAnalysis = analysisResult;
      const updatedKoreanCache: KoreanAnalysisCache = {
        ...(currentSession.koreanAnalysis || {}),
      };

      // 1단계: 모든 변경된 섹션의 한글 텍스트 수집
      const styleKoreanTexts: Array<{ text: string; field: string; index: number }> = [];
      const characterKoreanTexts: Array<{ text: string; field: string; index: number }> = [];
      const compositionKoreanTexts: Array<{ text: string; field: string; index: number }> = [];
      let negativeKoreanText: string | null = null;

      // style 변경 시 - 한글 텍스트만 수집
      if (JSON.stringify(oldAnalysis.style) !== JSON.stringify(analysisResult.style)) {
        const styleTexts = [
          { value: analysisResult.style.art_style, field: 'art_style' },
          { value: analysisResult.style.technique, field: 'technique' },
          { value: analysisResult.style.color_palette, field: 'color_palette' },
          { value: analysisResult.style.lighting, field: 'lighting' },
          { value: analysisResult.style.mood, field: 'mood' },
        ];
        styleTexts.forEach((item, idx) => {
          if (containsKorean(item.value)) {
            styleKoreanTexts.push({ text: item.value, field: item.field, index: idx });
          }
        });
      }

      // character 변경 시 - 한글 텍스트만 수집
      if (JSON.stringify(oldAnalysis.character) !== JSON.stringify(analysisResult.character)) {
        const characterTexts = [
          { value: analysisResult.character.gender, field: 'gender' },
          { value: analysisResult.character.age_group, field: 'age_group' },
          { value: analysisResult.character.hair, field: 'hair' },
          { value: analysisResult.character.eyes, field: 'eyes' },
          { value: analysisResult.character.face, field: 'face' },
          { value: analysisResult.character.outfit, field: 'outfit' },
          { value: analysisResult.character.accessories, field: 'accessories' },
          { value: analysisResult.character.body_proportions, field: 'body_proportions' },
          { value: analysisResult.character.limb_proportions, field: 'limb_proportions' },
          { value: analysisResult.character.torso_shape, field: 'torso_shape' },
          { value: analysisResult.character.hand_style, field: 'hand_style' },
        ];
        characterTexts.forEach((item, idx) => {
          if (containsKorean(item.value)) {
            characterKoreanTexts.push({ text: item.value, field: item.field, index: idx });
          }
        });
      }

      // composition 변경 시 - 한글 텍스트만 수집
      if (
        JSON.stringify(oldAnalysis.composition) !== JSON.stringify(analysisResult.composition)
      ) {
        const compositionTexts = [
          { value: analysisResult.composition.pose, field: 'pose' },
          { value: analysisResult.composition.angle, field: 'angle' },
          { value: analysisResult.composition.background, field: 'background' },
          { value: analysisResult.composition.depth_of_field, field: 'depth_of_field' },
        ];
        compositionTexts.forEach((item, idx) => {
          if (containsKorean(item.value)) {
            compositionKoreanTexts.push({ text: item.value, field: item.field, index: idx });
          }
        });
      }

      // negative_prompt 변경 시 - 한글인 경우만 수집
      if (oldAnalysis.negative_prompt !== analysisResult.negative_prompt) {
        if (containsKorean(analysisResult.negative_prompt)) {
          negativeKoreanText = analysisResult.negative_prompt;
        }
      }

      // 2단계: 모든 한글 텍스트를 하나로 모아서 배치 번역 (한글→영어만)
      const allKoreanTextsToTranslate: string[] = [];

      styleKoreanTexts.forEach((item) => {
        allKoreanTextsToTranslate.push(item.text);
      });

      characterKoreanTexts.forEach((item) => {
        allKoreanTextsToTranslate.push(item.text);
      });

      compositionKoreanTexts.forEach((item) => {
        allKoreanTextsToTranslate.push(item.text);
      });

      if (negativeKoreanText) {
        allKoreanTextsToTranslate.push(negativeKoreanText);
      }

      // 3단계: 배치 번역 실행 (한글→영어만)
      if (allKoreanTextsToTranslate.length > 0) {
        onProgress?.({ stage: 'translating', message: '변경된 내용 번역 중...', percentage: 10 });

        const translatedEnglish = await translateBatchToEnglish(apiKey, allKoreanTextsToTranslate);

        // 4단계: 번역 결과를 각 섹션에 적용
        let translationIdx = 0;

        // Style 처리
        if (styleKoreanTexts.length > 0) {
          const styleTexts = [
            analysisResult.style.art_style,
            analysisResult.style.technique,
            analysisResult.style.color_palette,
            analysisResult.style.lighting,
            analysisResult.style.mood,
          ];
          const finalEnglishTexts = [...styleTexts];
          const finalKoreanTexts = [...styleTexts];

          styleKoreanTexts.forEach((item) => {
            finalEnglishTexts[item.index] = translatedEnglish[translationIdx];
            finalKoreanTexts[item.index] = item.text;
            translationIdx++;
          });

          updatedAnalysis = {
            ...updatedAnalysis,
            style: {
              art_style: finalEnglishTexts[0],
              technique: finalEnglishTexts[1],
              color_palette: finalEnglishTexts[2],
              lighting: finalEnglishTexts[3],
              mood: finalEnglishTexts[4],
            },
          };
          updatedKoreanCache.style = {
            art_style: finalKoreanTexts[0],
            technique: finalKoreanTexts[1],
            color_palette: finalKoreanTexts[2],
            lighting: finalKoreanTexts[3],
            mood: finalKoreanTexts[4],
          };
        }

        // Character 처리
        if (characterKoreanTexts.length > 0) {
          const characterTexts = [
            analysisResult.character.gender,
            analysisResult.character.age_group,
            analysisResult.character.hair,
            analysisResult.character.eyes,
            analysisResult.character.face,
            analysisResult.character.outfit,
            analysisResult.character.accessories,
            analysisResult.character.body_proportions,
            analysisResult.character.limb_proportions,
            analysisResult.character.torso_shape,
            analysisResult.character.hand_style,
          ];
          const finalEnglishTexts = [...characterTexts];
          const finalKoreanTexts = [...characterTexts];

          characterKoreanTexts.forEach((item) => {
            finalEnglishTexts[item.index] = translatedEnglish[translationIdx];
            finalKoreanTexts[item.index] = item.text;
            translationIdx++;
          });

          updatedAnalysis = {
            ...updatedAnalysis,
            character: {
              gender: finalEnglishTexts[0],
              age_group: finalEnglishTexts[1],
              hair: finalEnglishTexts[2],
              eyes: finalEnglishTexts[3],
              face: finalEnglishTexts[4],
              outfit: finalEnglishTexts[5],
              accessories: finalEnglishTexts[6],
              body_proportions: finalEnglishTexts[7],
              limb_proportions: finalEnglishTexts[8],
              torso_shape: finalEnglishTexts[9],
              hand_style: finalEnglishTexts[10],
            },
          };
          updatedKoreanCache.character = {
            gender: finalKoreanTexts[0],
            age_group: finalKoreanTexts[1],
            hair: finalKoreanTexts[2],
            eyes: finalKoreanTexts[3],
            face: finalKoreanTexts[4],
            outfit: finalKoreanTexts[5],
            accessories: finalKoreanTexts[6],
            body_proportions: finalKoreanTexts[7],
            limb_proportions: finalKoreanTexts[8],
            torso_shape: finalKoreanTexts[9],
            hand_style: finalKoreanTexts[10],
          };
        }

        // Composition 처리
        if (compositionKoreanTexts.length > 0) {
          const compositionTexts = [
            analysisResult.composition.pose,
            analysisResult.composition.angle,
            analysisResult.composition.background,
            analysisResult.composition.depth_of_field,
          ];
          const finalEnglishTexts = [...compositionTexts];
          const finalKoreanTexts = [...compositionTexts];

          compositionKoreanTexts.forEach((item) => {
            finalEnglishTexts[item.index] = translatedEnglish[translationIdx];
            finalKoreanTexts[item.index] = item.text;
            translationIdx++;
          });

          updatedAnalysis = {
            ...updatedAnalysis,
            composition: {
              pose: finalEnglishTexts[0],
              angle: finalEnglishTexts[1],
              background: finalEnglishTexts[2],
              depth_of_field: finalEnglishTexts[3],
            },
          };
          updatedKoreanCache.composition = {
            pose: finalKoreanTexts[0],
            angle: finalKoreanTexts[1],
            background: finalKoreanTexts[2],
            depth_of_field: finalKoreanTexts[3],
          };
        }

        // Negative Prompt 처리 (한글인 경우만)
        if (negativeKoreanText) {
          updatedAnalysis = {
            ...updatedAnalysis,
            negative_prompt: translatedEnglish[translationIdx],
          };
          updatedKoreanCache.negativePrompt = negativeKoreanText;
          translationIdx++;
        } else if (oldAnalysis.negative_prompt !== analysisResult.negative_prompt) {
          // 영어인 경우 그대로 사용
          updatedAnalysis = {
            ...updatedAnalysis,
            negative_prompt: analysisResult.negative_prompt,
          };
          updatedKoreanCache.negativePrompt = analysisResult.negative_prompt;
        }
      } else {
        // 한글이 없는 경우 영어 그대로 사용
        if (oldAnalysis.negative_prompt !== analysisResult.negative_prompt) {
          updatedAnalysis = {
            ...updatedAnalysis,
            negative_prompt: analysisResult.negative_prompt,
          };
          updatedKoreanCache.negativePrompt = analysisResult.negative_prompt;
        }
      }

      return { updatedAnalysis, updatedKoreanCache };
    } catch (error) {
      logger.error('❌ [자동 번역] 번역 오류:', error);
      throw error;
    }
  };

  /**
   * 사용자 맞춤 프롬프트 번역
   */
  const translateCustomPrompt = async (
    apiKey: string,
    customPrompt: string
  ): Promise<string> => {
    if (!customPrompt) return '';
    if (containsKorean(customPrompt)) {
      return await translateToEnglish(apiKey, customPrompt);
    }
    return customPrompt;
  };

  return {
    translateAnalysisResult,
    hasChangesToTranslate,
    translateAndUpdateCache,
    translateCustomPrompt,
    containsKorean,
  };
}

