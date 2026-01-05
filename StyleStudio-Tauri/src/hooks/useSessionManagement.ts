import { useState, useEffect } from 'react';
import { Session, GenerationHistoryEntry, KoreanAnalysisCache } from '../types/session';
import { ImageAnalysisResult } from '../types/analysis';
import {
  loadApiKey,
  saveApiKey,
  loadSessions,
  exportSessionToFile,
  importSessionFromFile,
} from '../lib/storage';
import {
  updateSession,
  updateSessionInList,
  addSessionToList,
  removeSessionFromList,
  persistSessions,
} from '../utils/sessionHelpers';
import { logger } from '../lib/logger';

interface UseSessionManagementReturn {
  apiKey: string;
  setApiKey: (key: string) => void;
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  currentSession: Session | null;
  setCurrentSession: React.Dispatch<React.SetStateAction<Session | null>>;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  initializeApp: () => Promise<void>;
  handleSaveApiKey: (newApiKey: string) => Promise<void>;
  handleSelectSession: (session: Session) => void;
  handleDeleteSession: (sessionId: string) => Promise<void>;
  handleExportSession: (session: Session) => Promise<void>;
  handleImportSession: () => Promise<void>;
  handleReorderSessions: (reorderedSessions: Session[]) => Promise<void>;
  handleHistoryAdd: (entry: GenerationHistoryEntry) => void;
  handleHistoryUpdate: (entryId: string, updates: Partial<GenerationHistoryEntry>) => void;
  handleHistoryDelete: (entryId: string) => void;
  saveSessionWithoutTranslation: (updatedAnalysis: ImageAnalysisResult) => Promise<void>;
  updateKoreanCache: (updates: Partial<KoreanAnalysisCache>) => void;
}

/**
 * 세션 관리 Hook
 */
export function useSessionManagement(): UseSessionManagementReturn {
  const [apiKey, setApiKeyState] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // 앱 시작 시 API 키 및 세션 로드
  const initializeApp = async () => {
    try {
      const savedApiKey = await loadApiKey();
      if (savedApiKey) {
        setApiKeyState(savedApiKey);
      } else {
        setShowSettings(true);
      }

      const savedSessions = await loadSessions();
      setSessions(savedSessions);
    } catch (error) {
      logger.error('초기화 오류:', error);
      setShowSettings(true);
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

  const setApiKey = (key: string) => {
    setApiKeyState(key);
  };

  const handleSaveApiKey = async (newApiKey: string) => {
    try {
      await saveApiKey(newApiKey);
      setApiKeyState(newApiKey);
    } catch (error) {
      logger.error('API 키 저장 오류:', error);
      alert('API 키 저장 실패: ' + (error as Error).message);
    }
  };

  const handleSelectSession = (session: Session) => {
    setCurrentSession(session);
    // 세션 선택 시 이미지와 분석 결과도 함께 로드해야 함
    // 이 부분은 App.tsx에서 처리 (uploadedImages, analysisResult는 App.tsx의 상태)
  };

  const handleDeleteSession = async (sessionId: string) => {
    const updatedSessions = removeSessionFromList(sessions, sessionId);
    setSessions(updatedSessions);

    // 현재 세션이 삭제되는 경우 초기화
    if (currentSession?.id === sessionId) {
      setCurrentSession(null);
    }

    try {
      await persistSessions(updatedSessions);
    } catch (error) {
      logger.error('세션 삭제 오류:', error);
      alert('세션 삭제 실패: ' + (error as Error).message);
    }
  };

  const handleExportSession = async (session: Session) => {
    try {
      await exportSessionToFile(session);
      alert(`세션 "${session.name}"이(가) 파일로 저장되었습니다!`);
    } catch (error) {
      logger.error('❌ 세션 내보내기 오류:', error);
      alert('세션 저장 실패: ' + (error as Error).message);
    }
  };

  const handleImportSession = async () => {
    try {
      const importedSession = await importSessionFromFile();

      if (!importedSession) {
        return;
      }

      // 중복 ID 확인 및 처리
      const isDuplicate = sessions.some((s) => s.id === importedSession.id);
      if (isDuplicate) {
        importedSession.id = Date.now().toString();
      }

      const updatedSessions = addSessionToList(sessions, importedSession);
      setSessions(updatedSessions);
      await persistSessions(updatedSessions);

      alert(
        `세션 "${importedSession.name}"을(를) 불러왔습니다!\n참조 이미지: ${importedSession.imageCount}개`
      );

      setCurrentSession(importedSession);
    } catch (error) {
      logger.error('❌ 세션 가져오기 오류:', error);
      alert('세션 불러오기 실패: ' + (error as Error).message);
    }
  };

  const handleReorderSessions = async (reorderedSessions: Session[]) => {
    setSessions(reorderedSessions);
    try {
      await persistSessions(reorderedSessions);
    } catch (error) {
      logger.error('❌ 세션 순서 저장 오류:', error);
    }
  };

  const handleHistoryAdd = (entry: GenerationHistoryEntry) => {
    if (currentSession) {
      const updatedSession = updateSession(currentSession, {
        generationHistory: [...(currentSession.generationHistory || []), entry],
      });

      setCurrentSession(updatedSession);
      const updatedSessions = updateSessionInList(sessions, currentSession.id, updatedSession);
      setSessions(updatedSessions);
      persistSessions(updatedSessions);
    }
  };

  const handleHistoryUpdate = (entryId: string, updates: Partial<GenerationHistoryEntry>) => {
    if (currentSession) {
      const updatedSession = updateSession(currentSession, {
        generationHistory: (currentSession.generationHistory || []).map((entry) =>
          entry.id === entryId ? { ...entry, ...updates } : entry
        ),
      });

      setCurrentSession(updatedSession);
      const updatedSessions = updateSessionInList(sessions, currentSession.id, updatedSession);
      setSessions(updatedSessions);
      persistSessions(updatedSessions);
    }
  };

  const handleHistoryDelete = (entryId: string) => {
    if (currentSession) {
      const updatedSession = updateSession(currentSession, {
        generationHistory: (currentSession.generationHistory || []).filter(
          (entry) => entry.id !== entryId
        ),
      });

      setCurrentSession(updatedSession);
      const updatedSessions = updateSessionInList(sessions, currentSession.id, updatedSession);
      setSessions(updatedSessions);
      persistSessions(updatedSessions);
    }
  };

  const saveSessionWithoutTranslation = async (updatedAnalysis: ImageAnalysisResult) => {
    if (!currentSession || !apiKey) return;

    try {
      const updatedSession = updateSession(currentSession, {
        analysis: updatedAnalysis,
      });

      const updatedSessions = updateSessionInList(sessions, currentSession.id, updatedSession);
      setSessions(updatedSessions);
      setCurrentSession(updatedSession);
      await persistSessions(updatedSessions);
    } catch (error) {
      logger.error('❌ [프롬프트 수정] 세션 저장 오류:', error);
    }
  };

  const updateKoreanCache = (updates: Partial<KoreanAnalysisCache>) => {
    if (!currentSession) return;

    const updatedKoreanAnalysis: KoreanAnalysisCache = {
      ...(currentSession.koreanAnalysis || {}),
      ...updates,
    };

    const updatedSession = updateSession(currentSession, {
      koreanAnalysis: updatedKoreanAnalysis,
    });

    const updatedSessions = updateSessionInList(sessions, currentSession.id, updatedSession);
    setSessions(updatedSessions);
    setCurrentSession(updatedSession);
    persistSessions(updatedSessions);
  };

  return {
    apiKey,
    setApiKey,
    sessions,
    setSessions,
    currentSession,
    setCurrentSession,
    showSettings,
    setShowSettings,
    initializeApp,
    handleSaveApiKey,
    handleSelectSession,
    handleDeleteSession,
    handleExportSession,
    handleImportSession,
    handleReorderSessions,
    handleHistoryAdd,
    handleHistoryUpdate,
    handleHistoryDelete,
    saveSessionWithoutTranslation,
    updateKoreanCache,
  };
}

