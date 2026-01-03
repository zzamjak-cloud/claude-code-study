import { useState } from 'react';
import { ImageAnalysisResult } from '../types/analysis';
import { Session, KoreanAnalysisCache } from '../types/session';
import { detectChangedSections } from '../lib/analysisComparator';
import { logger } from '../lib/logger';

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


/**
 * 선택적 번역 함수 (변경된 섹션만 번역)
 * 현재는 번역을 수행하지 않고 기존 캐시를 반환 (번역은 세션 저장 시에만 수행)
 */
async function translateChangedSections(
  changedSections: ('style' | 'character' | 'composition' | 'prompts')[],
  oldKoreanCache: KoreanAnalysisCache | undefined
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

  logger.debug('📋 [선택적 번역] 변경된 섹션:', changedSections);

  // style, character, composition, prompts는 세션 저장 시에만 번역하므로 자동 저장에서는 번역하지 않음
  // 변경 감지만 하고 기존 캐시 반환

  logger.debug('✅ [선택적 번역] 변경 사항 없음 - 기존 캐시 반환');
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
        logger.debug('⏭️ [자동 저장] 변경 사항 없음 - 저장 스킵');
        setProgress({
          stage: 'idle',
          message: '',
          percentage: 0,
          estimatedSecondsLeft: 0,
        });
        setIsSaving(false);
        return;
      }

      // 선택적 번역 (현재는 번역하지 않고 기존 캐시 반환)
      const updatedKoreanAnalysis = await translateChangedSections(
        changedSections,
        props.currentSession?.koreanAnalysis
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

      logger.debug('✅ [자동 저장] 완료:', sessionToSave.name);

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
      logger.error('❌ [자동 저장] 오류:', error);
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
