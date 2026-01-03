import { useState } from 'react';
import { Session, SessionType } from '../types/session';
import { ImageAnalysisResult } from '../types/analysis';
import {
  createNewSession,
  updateSession,
  updateSessionInList,
  addSessionToList,
  persistSessions,
} from '../utils/sessionHelpers';
import { useTranslation } from './useTranslation';
import { logger } from '../lib/logger';

interface SaveProgress {
  stage: 'idle' | 'translating' | 'saving' | 'complete';
  message: string;
  percentage: number;
  estimatedSecondsLeft: number;
}

interface UseSessionPersistenceProps {
  apiKey: string;
  currentSession: Session | null;
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  setCurrentSession: React.Dispatch<React.SetStateAction<Session | null>>;
  analysisResult: ImageAnalysisResult | null;
  uploadedImages: string[];
}

interface UseSessionPersistenceReturn {
  saveProgress: SaveProgress;
  saveSession: (sessionName: string, sessionType: SessionType) => Promise<void>;
}

/**
 * 세션 저장 및 지속성 관리 Hook
 * 번역과 세션 저장을 함께 처리
 */
export function useSessionPersistence(
  props: UseSessionPersistenceProps
): UseSessionPersistenceReturn {
  const [saveProgress, setSaveProgress] = useState<SaveProgress>({
    stage: 'idle',
    message: '',
    percentage: 0,
    estimatedSecondsLeft: 0,
  });

  const { translateAnalysisResult, hasChangesToTranslate, translateAndUpdateCache, translateCustomPrompt } =
    useTranslation();

  /**
   * 세션 저장 (번역 포함)
   */
  const saveSession = async (sessionName: string, sessionType: SessionType) => {
    if (!props.analysisResult || props.uploadedImages.length === 0) {
      alert('분석 결과가 없습니다');
      return;
    }

    setSaveProgress({
      stage: 'idle',
      message: '',
      percentage: 0,
      estimatedSecondsLeft: 0,
    });

    try {
      let koreanCache = props.currentSession?.koreanAnalysis;

      if (props.currentSession) {
        // 기존 세션 업데이트: 변경된 내용만 번역
        if (hasChangesToTranslate(props.analysisResult, props.currentSession)) {
          setSaveProgress({
            stage: 'translating',
            message: '변경된 내용 번역 중...',
            percentage: 0,
            estimatedSecondsLeft: 0,
          });
          const { updatedKoreanCache } = await translateAndUpdateCache(
            props.apiKey,
            props.analysisResult,
            props.currentSession,
            (progress) => {
              setSaveProgress({
                stage: progress.stage as 'translating' | 'saving' | 'complete',
                message: progress.message,
                percentage: progress.percentage,
                estimatedSecondsLeft: 0,
              });
            }
          );
          koreanCache = updatedKoreanCache;
        }

        // 사용자 맞춤 프롬프트 번역
        if (koreanCache && props.analysisResult.user_custom_prompt) {
          setSaveProgress({
            stage: 'translating',
            message: '사용자 맞춤 프롬프트 번역 중...',
            percentage: 85,
            estimatedSecondsLeft: 0,
          });
          koreanCache.customPromptEnglish = await translateCustomPrompt(
            props.apiKey,
            props.analysisResult.user_custom_prompt
          );
        }
      } else {
        // 새 세션 생성: 전체 번역
        setSaveProgress({
          stage: 'translating',
          message: '전체 번역 중...',
          percentage: 0,
          estimatedSecondsLeft: 0,
        });
        koreanCache = await translateAnalysisResult(props.apiKey, props.analysisResult);

        setSaveProgress({
          stage: 'translating',
          message: '사용자 맞춤 프롬프트 번역 중...',
          percentage: 90,
          estimatedSecondsLeft: 0,
        });

        if (props.analysisResult.user_custom_prompt) {
          koreanCache.customPromptEnglish = await translateCustomPrompt(
            props.apiKey,
            props.analysisResult.user_custom_prompt
          );
        }
      }

      setSaveProgress({
        stage: 'saving',
        message: '세션 저장 중...',
        percentage: 95,
        estimatedSecondsLeft: 0,
      });

      let sessionToSave: Session;
      let updatedSessions: Session[];

      if (props.currentSession) {
        // 기존 세션 업데이트
        sessionToSave = updateSession(props.currentSession, {
          name: sessionName,
          type: sessionType,
          referenceImages: props.uploadedImages,
          analysis: props.analysisResult,
          koreanAnalysis: koreanCache || props.currentSession.koreanAnalysis,
          imageCount: props.uploadedImages.length,
        });
        updatedSessions = updateSessionInList(props.sessions, props.currentSession.id, sessionToSave);
      } else {
        // 새 세션 생성
        sessionToSave = createNewSession(
          props.analysisResult,
          props.uploadedImages,
          koreanCache,
          sessionType
        );
        sessionToSave.name = sessionName;
        sessionToSave.type = sessionType;
        updatedSessions = addSessionToList(props.sessions, sessionToSave);
      }

      props.setSessions(updatedSessions);
      await persistSessions(updatedSessions);

      setSaveProgress({
        stage: 'complete',
        message: '저장 완료!',
        percentage: 100,
        estimatedSecondsLeft: 0,
      });

      alert(
        `세션 "${sessionName}"이(가) ${props.currentSession ? '업데이트' : '저장'}되었습니다!\n참조 이미지: ${props.uploadedImages.length}개`
      );

      props.setCurrentSession(sessionToSave);

      setTimeout(() => {
        setSaveProgress({
          stage: 'idle',
          message: '',
          percentage: 0,
          estimatedSecondsLeft: 0,
        });
      }, 2000);
    } catch (error) {
      logger.error('❌ 세션 저장 오류:', error);
      setSaveProgress({
        stage: 'idle',
        message: '',
        percentage: 0,
        estimatedSecondsLeft: 0,
      });
      alert('세션 저장 실패: ' + (error as Error).message);
    }
  };

  return {
    saveProgress,
    saveSession,
  };
}

