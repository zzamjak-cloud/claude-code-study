import { useState } from 'react';
import { ImageAnalysisResult } from '../types/analysis';
import { Session, KoreanAnalysisCache } from '../types/session';
import { detectChangedSections } from '../lib/analysisComparator';
import { useGeminiTranslator } from './useGeminiTranslator';
import { buildUnifiedPrompt } from '../lib/promptBuilder';

// Props 인터페이스
interface UseAutoSaveProps {
  currentSession: Session | null;
  analysisResult: ImageAnalysisResult | null;
  apiKey: string;
  uploadedImages: string[];
  onSessionUpdate: (session: Session) => void;
  autoSaveEnabled?: boolean; // 기본값: true
  autoSaveDelay?: number; // 기본값: 1000ms (디바운스)
}

// Return 인터페이스
interface UseAutoSaveReturn {
  isSaving: boolean;
  progress: {
    stage: 'idle' | 'translating' | 'saving' | 'complete';
    message: string;
    percentage: number;
    estimatedSecondsLeft: number;
  };
  triggerManualSave: (updatedAnalysis?: ImageAnalysisResult) => Promise<void>;
}

// 진행 상태 인터페이스
interface TranslationProgress {
  current: number;
  total: number;
}

/**
 * 선택적 번역 함수 (변경된 섹션만 번역)
 * Hook 외부 함수로 정의하여 translator 함수들을 파라미터로 받음
 */
async function translateChangedSections(
  changedSections: ('style' | 'character' | 'composition' | 'prompts')[],
  newAnalysis: ImageAnalysisResult,
  oldKoreanCache: KoreanAnalysisCache | undefined,
  translateBatchToKorean: (apiKey: string, texts: string[]) => Promise<string[]>,
  translateToEnglish: (apiKey: string, text: string) => Promise<string>,
  containsKorean: (text: string) => boolean,
  apiKey: string,
  onProgress?: (progress: TranslationProgress) => void
): Promise<KoreanAnalysisCache> {
  // 변경되지 않은 섹션은 기존 캐시 재사용
  const mergedCache: KoreanAnalysisCache = {
    style: oldKoreanCache?.style,
    character: oldKoreanCache?.character,
    composition: oldKoreanCache?.composition,
    positivePrompt: oldKoreanCache?.positivePrompt,
    negativePrompt: oldKoreanCache?.negativePrompt,
    customPromptEnglish: oldKoreanCache?.customPromptEnglish,
  };

  // 변경된 섹션의 필드만 수집
  const textsToTranslate: string[] = [];
  const fieldMap: Array<{ section: string; field: string; index: number }> = [];

  console.log('📋 [선택적 번역] 변경된 섹션:', changedSections);

  changedSections.forEach((section) => {
    if (section === 'style') {
      console.log('   - Style 섹션 필드 수집 중...');
      Object.entries(newAnalysis.style).forEach(([field, value]) => {
        fieldMap.push({ section: 'style', field, index: textsToTranslate.length });
        textsToTranslate.push(value);
      });
    }
    if (section === 'character') {
      console.log('   - Character 섹션 필드 수집 중...');
      Object.entries(newAnalysis.character).forEach(([field, value]) => {
        fieldMap.push({ section: 'character', field, index: textsToTranslate.length });
        textsToTranslate.push(value);
      });
    }
    if (section === 'composition') {
      console.log('   - Composition 섹션 필드 수집 중...');
      Object.entries(newAnalysis.composition).forEach(([field, value]) => {
        fieldMap.push({ section: 'composition', field, index: textsToTranslate.length });
        textsToTranslate.push(value);
      });
    }
    if (section === 'prompts') {
      console.log('   - Prompts 섹션 필드 수집 중...');
      // negative_prompt만 번역 (positivePrompt는 style/character/composition에서 자동 생성됨)
      fieldMap.push({ section: 'prompts', field: 'negative', index: textsToTranslate.length });
      textsToTranslate.push(newAnalysis.negative_prompt);
    }
  });

  // 변경된 필드가 없으면 캐시 그대로 반환
  if (textsToTranslate.length === 0) {
    console.log('✅ [선택적 번역] 변경 사항 없음 - 기존 캐시 반환');
    return mergedCache;
  }

  console.log(`🌐 [선택적 번역] ${textsToTranslate.length}개 필드 번역 시작`);
  onProgress?.({ current: 0, total: textsToTranslate.length });

  // 배치 번역 (1번의 API 호출)
  const translations = await translateBatchToKorean(apiKey, textsToTranslate);

  onProgress?.({ current: textsToTranslate.length, total: textsToTranslate.length });

  // 번역 결과를 적절한 섹션에 병합
  fieldMap.forEach(({ section, field, index }) => {
    const translation = translations[index];

    if (section === 'style') {
      mergedCache.style = mergedCache.style || { ...newAnalysis.style };
      (mergedCache.style as any)[field] = translation;
    } else if (section === 'character') {
      mergedCache.character = mergedCache.character || { ...newAnalysis.character };
      (mergedCache.character as any)[field] = translation;
    } else if (section === 'composition') {
      mergedCache.composition = mergedCache.composition || { ...newAnalysis.composition };
      (mergedCache.composition as any)[field] = translation;
    } else if (section === 'prompts') {
      if (field === 'positive') {
        mergedCache.positivePrompt = translation;
      } else if (field === 'negative') {
        mergedCache.negativePrompt = translation;
      }
    }
  });

  // style, character, composition 중 하나라도 변경되면 positivePrompt 재생성 및 번역
  const needsPositivePromptUpdate = changedSections.some((section) =>
    ['style', 'character', 'composition'].includes(section)
  );

  if (needsPositivePromptUpdate) {
    console.log('🔄 [선택적 번역] positivePrompt 재생성 중...');
    const { positivePrompt } = buildUnifiedPrompt(newAnalysis);
    const [translatedPositive] = await translateBatchToKorean(apiKey, [positivePrompt]);
    mergedCache.positivePrompt = translatedPositive;
  }

  // user_custom_prompt 번역 (병렬 처리 가능하지만 간단하게 순차 처리)
  if (newAnalysis.user_custom_prompt && containsKorean(newAnalysis.user_custom_prompt)) {
    console.log('🌐 [선택적 번역] 사용자 맞춤 프롬프트 영어 번역 중...');
    mergedCache.customPromptEnglish = await translateToEnglish(
      apiKey,
      newAnalysis.user_custom_prompt
    );
  }

  console.log('✅ [선택적 번역] 완료');
  return mergedCache;
}

/**
 * 자동 저장 Hook
 * 분석 결과 변경 감지 → 선택적 번역 → 자동 저장
 */
export function useAutoSave(props: UseAutoSaveProps): UseAutoSaveReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState({
    stage: 'idle' as 'idle' | 'translating' | 'saving' | 'complete',
    message: '',
    percentage: 0,
    estimatedSecondsLeft: 0,
  });

  const { translateBatchToKorean, translateToEnglish, containsKorean } = useGeminiTranslator();

  // 수동 저장 실행 (카드 저장 버튼 클릭시 호출)
  const triggerSave = async (updatedAnalysis?: ImageAnalysisResult) => {
    // 파라미터로 받은 분석 결과 또는 현재 분석 결과 사용
    const analysisToSave = updatedAnalysis || props.analysisResult;

    if (isSaving || !analysisToSave || !props.apiKey) {
      return;
    }

    setIsSaving(true);
    setProgress({
      stage: 'translating',
      message: '번역 중',
      percentage: 0,
      estimatedSecondsLeft: 0,
    });

    try {
      // 변경 감지
      const changedSections = detectChangedSections(
        props.currentSession?.analysis || null,
        analysisToSave
      );

      // 변경된 섹션이 없으면 저장 스킵
      if (changedSections.length === 0) {
        console.log('⏭️ [자동 저장] 변경 사항 없음 - 저장 스킵');
        setProgress({
          stage: 'idle',
          message: '',
          percentage: 0,
          estimatedSecondsLeft: 0,
        });
        setIsSaving(false);
        return;
      }

      // 선택적 번역
      const updatedKoreanAnalysis = await translateChangedSections(
        changedSections,
        analysisToSave,
        props.currentSession?.koreanAnalysis,
        translateBatchToKorean,
        translateToEnglish,
        containsKorean,
        props.apiKey,
        (translationProgress) => {
          const percentage = (translationProgress.current / translationProgress.total) * 70; // 70%까지 번역
          setProgress({
            stage: 'translating',
            message: '번역 중',
            percentage,
            estimatedSecondsLeft: 0,
          });
        }
      );

      setProgress({
        stage: 'saving',
        message: '저장 중',
        percentage: 80,
        estimatedSecondsLeft: 0,
      });

      // 세션 생성 또는 업데이트
      const now = new Date().toISOString();
      const sessionToSave: Session = props.currentSession
        ? {
            // 기존 세션 업데이트
            ...props.currentSession,
            updatedAt: now,
            analysis: analysisToSave,
            koreanAnalysis: updatedKoreanAnalysis,
            referenceImages: props.uploadedImages,
            imageCount: props.uploadedImages.length,
          }
        : {
            // 새 세션 생성
            id: Date.now().toString(),
            name: `세션 ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
            type: 'STYLE',
            createdAt: now,
            updatedAt: now,
            referenceImages: props.uploadedImages,
            analysis: analysisToSave,
            koreanAnalysis: updatedKoreanAnalysis,
            imageCount: props.uploadedImages.length,
          };

      // 상위 컴포넌트에 세션 업데이트 알림
      props.onSessionUpdate(sessionToSave);

      setProgress({
        stage: 'complete',
        message: '저장 완료!',
        percentage: 100,
        estimatedSecondsLeft: 0,
      });

      console.log('✅ [자동 저장] 완료:', sessionToSave.name);

      // 2초 후 완료 메시지 숨김
      setTimeout(() => {
        setProgress({
          stage: 'idle',
          message: '',
          percentage: 0,
          estimatedSecondsLeft: 0,
        });
      }, 2000);
    } catch (error) {
      console.error('❌ [자동 저장] 오류:', error);
      setProgress({
        stage: 'idle',
        message: '',
        percentage: 0,
        estimatedSecondsLeft: 0,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    progress,
    triggerManualSave: triggerSave,
  };
}
