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
    analysis: ImageAnalysisResult,
    onProgress?: (progress: TranslationProgress) => void
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

      // UI 특화 분석 필드 추가 (4개)
      if (analysis.ui_specific) {
        allTexts.push(
          analysis.ui_specific.platform_type,
          analysis.ui_specific.visual_style,
          analysis.ui_specific.key_elements,
          analysis.ui_specific.color_theme
        );
      }

      // LOGO 특화 분석 필드 추가 (15개)
      if (analysis.logo_specific) {
        allTexts.push(
          analysis.logo_specific.typography_style,
          analysis.logo_specific.text_warping,
          analysis.logo_specific.text_weight,
          analysis.logo_specific.edge_treatment,
          analysis.logo_specific.material_type,
          analysis.logo_specific.rendering_style,
          analysis.logo_specific.surface_quality,
          analysis.logo_specific.outline_style,
          analysis.logo_specific.drop_shadow,
          analysis.logo_specific.inner_effects,
          analysis.logo_specific.decorative_elements,
          analysis.logo_specific.color_vibrancy,
          analysis.logo_specific.color_count,
          analysis.logo_specific.gradient_usage,
          analysis.logo_specific.genre_hint
        );
      }

      // 한 번의 API 호출로 모든 필드 번역 (영어→한국어)
      onProgress?.({ stage: 'translating', message: '전체 번역 중...', percentage: 0 });
      const translations = await translateBatchToKorean(apiKey, allTexts);
      onProgress?.({ stage: 'translating', message: '번역 완료', percentage: 90 });

      // 사용자 맞춤 프롬프트를 영어로 번역 (한국어→영어, 이미지 생성용)
      let customPromptEnglish = '';
      if (analysis.user_custom_prompt) {
        if (containsKorean(analysis.user_custom_prompt)) {
          onProgress?.({ stage: 'translating', message: '사용자 맞춤 프롬프트 번역 중...', percentage: 95 });
          customPromptEnglish = await translateToEnglish(apiKey, analysis.user_custom_prompt);
        }
        // 이미 영어인 경우 번역하지 않음 (이미지 생성 시 직접 사용)
      }
      
      onProgress?.({ stage: 'complete', message: '번역 완료!', percentage: 100 });

      let translationIndex = 22; // UI와 LOGO 필드는 22번 인덱스부터 시작

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
        customPromptEnglish: customPromptEnglish || undefined,
      };

      // UI 특화 분석 번역 결과 추가
      if (analysis.ui_specific) {
        koreanCache.uiAnalysis = {
          platform_type: translations[translationIndex++],
          visual_style: translations[translationIndex++],
          key_elements: translations[translationIndex++],
          color_theme: translations[translationIndex++],
        };
      }

      // LOGO 특화 분석 번역 결과 추가
      if (analysis.logo_specific) {
        koreanCache.logoAnalysis = {
          typography_style: translations[translationIndex++],
          text_warping: translations[translationIndex++],
          text_weight: translations[translationIndex++],
          edge_treatment: translations[translationIndex++],
          material_type: translations[translationIndex++],
          rendering_style: translations[translationIndex++],
          surface_quality: translations[translationIndex++],
          outline_style: translations[translationIndex++],
          drop_shadow: translations[translationIndex++],
          inner_effects: translations[translationIndex++],
          decorative_elements: translations[translationIndex++],
          color_vibrancy: translations[translationIndex++],
          color_count: translations[translationIndex++],
          gradient_usage: translations[translationIndex++],
          genre_hint: translations[translationIndex++],
        };
      }

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

    // user_custom_prompt 변경 확인
    const customPromptChanged = oldAnalysis.user_custom_prompt !== analysisResult.user_custom_prompt;

    // ui_specific 변경 확인
    const uiChanged =
      JSON.stringify(oldAnalysis.ui_specific) !== JSON.stringify(analysisResult.ui_specific);

    // logo_specific 변경 확인
    const logoChanged =
      JSON.stringify(oldAnalysis.logo_specific) !== JSON.stringify(analysisResult.logo_specific);

    return styleChanged || characterChanged || compositionChanged || negativeChanged || customPromptChanged || uiChanged || logoChanged;
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
      const uiKoreanTexts: Array<{ text: string; field: string; index: number }> = [];
      const logoKoreanTexts: Array<{ text: string; field: string; index: number }> = [];
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

      // user_custom_prompt 변경 시 - 한글인 경우만 수집
      let customPromptKoreanText: string | null = null;
      if (oldAnalysis.user_custom_prompt !== analysisResult.user_custom_prompt) {
        if (analysisResult.user_custom_prompt && containsKorean(analysisResult.user_custom_prompt)) {
          customPromptKoreanText = analysisResult.user_custom_prompt;
        }
      }

      // UI 특화 분석 변경 시 - 한글 텍스트만 수집
      if (
        analysisResult.ui_specific &&
        JSON.stringify(oldAnalysis.ui_specific) !== JSON.stringify(analysisResult.ui_specific)
      ) {
        const uiTexts = [
          { value: analysisResult.ui_specific.platform_type, field: 'platform_type' },
          { value: analysisResult.ui_specific.visual_style, field: 'visual_style' },
          { value: analysisResult.ui_specific.key_elements, field: 'key_elements' },
          { value: analysisResult.ui_specific.color_theme, field: 'color_theme' },
        ];
        uiTexts.forEach((item, idx) => {
          if (containsKorean(item.value)) {
            uiKoreanTexts.push({ text: item.value, field: item.field, index: idx });
          }
        });
      }

      // LOGO 특화 분석 변경 시 - 한글 텍스트만 수집
      if (
        analysisResult.logo_specific &&
        JSON.stringify(oldAnalysis.logo_specific) !== JSON.stringify(analysisResult.logo_specific)
      ) {
        const logoTexts = [
          { value: analysisResult.logo_specific.typography_style, field: 'typography_style' },
          { value: analysisResult.logo_specific.text_warping, field: 'text_warping' },
          { value: analysisResult.logo_specific.text_weight, field: 'text_weight' },
          { value: analysisResult.logo_specific.edge_treatment, field: 'edge_treatment' },
          { value: analysisResult.logo_specific.material_type, field: 'material_type' },
          { value: analysisResult.logo_specific.rendering_style, field: 'rendering_style' },
          { value: analysisResult.logo_specific.surface_quality, field: 'surface_quality' },
          { value: analysisResult.logo_specific.outline_style, field: 'outline_style' },
          { value: analysisResult.logo_specific.drop_shadow, field: 'drop_shadow' },
          { value: analysisResult.logo_specific.inner_effects, field: 'inner_effects' },
          { value: analysisResult.logo_specific.decorative_elements, field: 'decorative_elements' },
          { value: analysisResult.logo_specific.color_vibrancy, field: 'color_vibrancy' },
          { value: analysisResult.logo_specific.color_count, field: 'color_count' },
          { value: analysisResult.logo_specific.gradient_usage, field: 'gradient_usage' },
          { value: analysisResult.logo_specific.genre_hint, field: 'genre_hint' },
        ];
        logoTexts.forEach((item, idx) => {
          if (containsKorean(item.value)) {
            logoKoreanTexts.push({ text: item.value, field: item.field, index: idx });
          }
        });
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

      if (customPromptKoreanText) {
        allKoreanTextsToTranslate.push(customPromptKoreanText);
      }

      uiKoreanTexts.forEach((item) => {
        allKoreanTextsToTranslate.push(item.text);
      });

      logoKoreanTexts.forEach((item) => {
        allKoreanTextsToTranslate.push(item.text);
      });

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

        // UI 특화 분석 처리
        if (uiKoreanTexts.length > 0 && analysisResult.ui_specific) {
          const uiTexts = [
            analysisResult.ui_specific.platform_type,
            analysisResult.ui_specific.visual_style,
            analysisResult.ui_specific.key_elements,
            analysisResult.ui_specific.color_theme,
          ];
          const finalEnglishTexts = [...uiTexts];
          const finalKoreanTexts = [...uiTexts];

          uiKoreanTexts.forEach((item) => {
            finalEnglishTexts[item.index] = translatedEnglish[translationIdx];
            finalKoreanTexts[item.index] = item.text;
            translationIdx++;
          });

          updatedAnalysis = {
            ...updatedAnalysis,
            ui_specific: {
              platform_type: finalEnglishTexts[0],
              visual_style: finalEnglishTexts[1],
              key_elements: finalEnglishTexts[2],
              color_theme: finalEnglishTexts[3],
            },
          };
          updatedKoreanCache.uiAnalysis = {
            platform_type: finalKoreanTexts[0],
            visual_style: finalKoreanTexts[1],
            key_elements: finalKoreanTexts[2],
            color_theme: finalKoreanTexts[3],
          };
        }

        // LOGO 특화 분석 처리
        if (logoKoreanTexts.length > 0 && analysisResult.logo_specific) {
          const logoTexts = [
            analysisResult.logo_specific.typography_style,
            analysisResult.logo_specific.text_warping,
            analysisResult.logo_specific.text_weight,
            analysisResult.logo_specific.edge_treatment,
            analysisResult.logo_specific.material_type,
            analysisResult.logo_specific.rendering_style,
            analysisResult.logo_specific.surface_quality,
            analysisResult.logo_specific.outline_style,
            analysisResult.logo_specific.drop_shadow,
            analysisResult.logo_specific.inner_effects,
            analysisResult.logo_specific.decorative_elements,
            analysisResult.logo_specific.color_vibrancy,
            analysisResult.logo_specific.color_count,
            analysisResult.logo_specific.gradient_usage,
            analysisResult.logo_specific.genre_hint,
          ];
          const finalEnglishTexts = [...logoTexts];
          const finalKoreanTexts = [...logoTexts];

          logoKoreanTexts.forEach((item) => {
            finalEnglishTexts[item.index] = translatedEnglish[translationIdx];
            finalKoreanTexts[item.index] = item.text;
            translationIdx++;
          });

          updatedAnalysis = {
            ...updatedAnalysis,
            logo_specific: {
              typography_style: finalEnglishTexts[0],
              text_warping: finalEnglishTexts[1],
              text_weight: finalEnglishTexts[2],
              edge_treatment: finalEnglishTexts[3],
              material_type: finalEnglishTexts[4],
              rendering_style: finalEnglishTexts[5],
              surface_quality: finalEnglishTexts[6],
              outline_style: finalEnglishTexts[7],
              drop_shadow: finalEnglishTexts[8],
              inner_effects: finalEnglishTexts[9],
              decorative_elements: finalEnglishTexts[10],
              color_vibrancy: finalEnglishTexts[11],
              color_count: finalEnglishTexts[12],
              gradient_usage: finalEnglishTexts[13],
              genre_hint: finalEnglishTexts[14],
            },
          };
          updatedKoreanCache.logoAnalysis = {
            typography_style: finalKoreanTexts[0],
            text_warping: finalKoreanTexts[1],
            text_weight: finalKoreanTexts[2],
            edge_treatment: finalKoreanTexts[3],
            material_type: finalKoreanTexts[4],
            rendering_style: finalKoreanTexts[5],
            surface_quality: finalKoreanTexts[6],
            outline_style: finalKoreanTexts[7],
            drop_shadow: finalKoreanTexts[8],
            inner_effects: finalKoreanTexts[9],
            decorative_elements: finalKoreanTexts[10],
            color_vibrancy: finalKoreanTexts[11],
            color_count: finalKoreanTexts[12],
            gradient_usage: finalKoreanTexts[13],
            genre_hint: finalKoreanTexts[14],
          };
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

