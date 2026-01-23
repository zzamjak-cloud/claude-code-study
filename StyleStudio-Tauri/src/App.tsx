import { useState, useCallback, useEffect } from 'react';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Sidebar } from './components/common/Sidebar';
import { EmptyState } from './components/common/EmptyState';
import { ImageUpload } from './components/generator/ImageUpload';
import { AnalysisPanel } from './components/analysis/AnalysisPanel';
import { ImageGeneratorPanel } from './components/generator/ImageGeneratorPanel';
import { SettingsModal } from './components/common/SettingsModal';
import { SaveSessionModal } from './components/common/SaveSessionModal';
import { NewSessionModal } from './components/common/NewSessionModal';
import { useGeminiAnalyzer } from './hooks/api/useGeminiAnalyzer';
import { useAutoSave } from './hooks/useAutoSave';
import { ProgressIndicator } from './components/common/ProgressIndicator';
import { ImageAnalysisResult } from './types/analysis';
import { Session, SessionType } from './types/session';
import { useImageHandling } from './hooks/useImageHandling';
import { useSessionManagement } from './hooks/useSessionManagement';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useTranslation } from './hooks/useTranslation';
import { useFolderManagement } from './hooks/useFolderManagement';
import {
  createNewSession,
  updateSession,
  updateSessionInList,
  addSessionToList,
  persistSessions,
} from './utils/sessionHelpers';
import { logger } from './lib/logger';

function App() {
  const [showSaveSession, setShowSaveSession] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [currentView, setCurrentView] = useState<'analysis' | 'generator'>('analysis');
  const [generateProgress, setGenerateProgress] = useState({
    stage: 'idle' as 'idle' | 'translating' | 'saving' | 'complete',
    message: '',
    percentage: 0,
    estimatedSecondsLeft: 0,
  });
  const [initialTranslationProgress, setInitialTranslationProgress] = useState({
    stage: 'idle' as 'idle' | 'translating' | 'saving' | 'complete',
    message: '',
    percentage: 0,
    estimatedSecondsLeft: 0,
  });
  const [refineConfirm, setRefineConfirm] = useState(false);
  const [damagedSessionsWarning, setDamagedSessionsWarning] = useState<string | null>(null);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const [infoDialog, setInfoDialog] = useState<{ title: string; message: string } | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // 커스텀 훅 사용
  const { uploadedImages, setUploadedImages, handleImageSelect, handleRemoveImage, showLimitWarning, setShowLimitWarning } =
    useImageHandling();

  const {
    apiKey,
    sessions,
    setSessions,
    currentSession,
    setCurrentSession,
    showSettings,
    setShowSettings,
    handleSaveApiKey,
    handleSelectSession,
    handleDeleteSession,
    handleExportSession,
    handleImportSession,
    handleReorderSessions,
    handleHistoryAdd,
    handleHistoryUpdate,
    handleHistoryDelete,
    handleDocumentAdd,
    handleDocumentDelete,
    handleAutoSavePathChange,
    saveSessionWithoutTranslation,
    updateKoreanCache,
  } = useSessionManagement();
  const { analyzeImages } = useGeminiAnalyzer();
  const {
    translateAnalysisResult,
    hasChangesToTranslate,
    translateAndUpdateCache,
  } = useTranslation();

  // 폴더 관리 Hook
  const {
    folders,
    currentFolderId,
    folderPath,
    initializeFolders,
    getCurrentFolderSessions,
    getCurrentFolderSubfolders,
    createFolder,
    renameFolder,
    deleteFolder,
    navigateToFolder,
    navigateBack,
    moveSessionToFolder,
    moveFolderToFolder,
    reorderFolders,
    getCurrentFolderIdForNewSession,
  } = useFolderManagement();

  // 폴더 데이터 초기화
  useEffect(() => {
    initializeFolders();
  }, []);

  // 현재 폴더의 세션과 하위 폴더
  const currentFolderSessions = getCurrentFolderSessions(sessions);
  const currentFolderSubfolders = getCurrentFolderSubfolders();

  // 폴더 진입 시 첫 번째 세션 자동 선택
  useEffect(() => {
    // 현재 폴더의 세션 중 첫 번째 세션 선택
    if (currentFolderSessions.length > 0) {
      // 현재 선택된 세션이 현재 폴더에 없으면 첫 번째 세션 선택
      const currentSessionInFolder = currentFolderSessions.find(s => s.id === currentSession?.id);
      if (!currentSessionInFolder) {
        setCurrentSession(currentFolderSessions[0]);
        logger.debug('📂 폴더 진입: 첫 번째 세션 선택:', currentFolderSessions[0].name);
      }
    } else {
      // 폴더에 세션이 없으면 현재 세션 해제 (초기 화면 표시)
      if (currentSession && currentFolderId !== null) {
        // 현재 세션이 다른 폴더에 있을 수 있으므로 null로 설정하지 않음
        // 빈 폴더일 때만 초기 화면 표시
        logger.debug('📂 빈 폴더 진입');
      }
    }
  }, [currentFolderId]);

  // 세션 저장 및 지속성 관리
  const { saveProgress, saveSession } = useSessionPersistence({
    apiKey,
    currentSession,
    sessions,
    setSessions,
    setCurrentSession,
    analysisResult,
    uploadedImages,
  });

  // 자동 저장 Hook
  const handleSessionUpdate = useCallback(
    (session: Session) => {
      setCurrentSession(session);
      const updatedSessions = currentSession
        ? updateSessionInList(sessions, session.id, session)
        : addSessionToList(sessions, session);
      setSessions(updatedSessions);
      persistSessions(updatedSessions);
    },
    [currentSession, sessions]
  );

  const { progress } = useAutoSave({
    currentSession,
    analysisResult,
    apiKey,
    uploadedImages,
    onSessionUpdate: handleSessionUpdate,
    autoSaveEnabled: true,
    autoSaveDelay: 1000,
  });

  // 1. 앱 시작 시 첫 번째 세션 자동 선택 및 손상된 세션 확인
  useEffect(() => {
    // currentSession이 없을 때만 실행 (무한 루프 방지)
    if (sessions.length > 0 && !currentSession) {
      const firstSession = sessions[0];
      setCurrentSession(firstSession);
      logger.info('✅ 첫 번째 세션 자동 선택:', firstSession.name);

      // 손상된 세션 확인 (참조 이미지가 없는데 imageCount가 있는 경우)
      const damagedSessions = sessions.filter(
        (s) => s.imageCount > 0 && s.referenceImages.length === 0
      );

      if (damagedSessions.length > 0) {
        logger.warn(`⚠️ 손상된 세션 발견: ${damagedSessions.length}개`);
        logger.warn('   세션 목록:', damagedSessions.map((s) => s.name).join(', '));

        // 사용자에게 경고 (한 번만 표시)
        setTimeout(() => {
          setDamagedSessionsWarning(
            `참조 이미지가 손상된 세션이 ${damagedSessions.length}개 발견되었습니다.\n\n` +
              `손상된 세션:\n${damagedSessions.map((s) => `- ${s.name}`).join('\n')}\n\n` +
              `원인:\n` +
              `- IndexedDB 데이터가 삭제되었거나\n` +
              `- 다른 PC에서 export한 파일을 import했을 때\n\n` +
              `해결 방법:\n` +
              `1. 원본 PC에서 최신 버전으로 세션을 다시 export하세요\n` +
              `2. 또는 해당 세션의 참조 이미지를 다시 업로드하고 분석하세요`
          );
        }, 1000);
      }
    }
  }, [sessions]); // sessions가 로드될 때만 실행 (currentSession 의존성 제거)

  // 2. currentSession 변경 시 uploadedImages와 analysisResult 복원
  useEffect(() => {
    if (currentSession) {
      setUploadedImages(currentSession.referenceImages);
      setAnalysisResult(currentSession.analysis);
      logger.info('✅ 세션 데이터 복원:', currentSession.name);
      logger.debug('   - 참조 이미지:', currentSession.referenceImages.length, '개');
      logger.debug('   - 분석 결과:', currentSession.analysis ? '존재' : '없음');

      // 참조 이미지 검증
      if (currentSession.referenceImages.length === 0 && currentSession.imageCount > 0) {
        logger.warn('⚠️ 참조 이미지가 손상되었습니다. ImageKeys:', currentSession.imageKeys);
      }
    } else {
      // 세션이 없으면 초기화
      setUploadedImages([]);
      setAnalysisResult(null);
      logger.info('✅ 세션 데이터 초기화');
    }
  }, [currentSession]); // currentSession이 변경될 때 실행

  const handleCustomPromptChange = useCallback((customPrompt: string) => {
    if (analysisResult) {
      const updated = {
        ...analysisResult,
        user_custom_prompt: customPrompt,
      };
      setAnalysisResult(updated);
    }
  }, [analysisResult]);

  // 실제 분석 수행 함수
  const performAnalysis = async () => {
    setIsAnalyzing(true);

    // 빈 세션인지 확인 (모든 필드가 빈 문자열인 경우)
    const isEmptySession = currentSession &&
      currentSession.analysis &&
      currentSession.analysis.style.art_style === '' &&
      currentSession.analysis.style.technique === '' &&
      currentSession.analysis.character.gender === '' &&
      currentSession.analysis.character.age_group === '' &&
      currentSession.analysis.composition.pose === '' &&
      currentSession.analysis.composition.angle === '' &&
      currentSession.analysis.negative_prompt === '';

    const isRefinementMode = currentSession && analysisResult && !isEmptySession;

    await analyzeImages(
      apiKey,
      uploadedImages,
      {
        onProgress: (message) => {
          logger.debug('📊 진행 상황:', message);
        },
        onComplete: async (result) => {
          setAnalysisResult(result);
          setIsAnalyzing(false);

          // 빈 세션이거나 신규 분석인 경우 또는 분석 강화인 경우 - 모두 번역 수행
          try {
            setInitialTranslationProgress({
              stage: 'translating',
              message: '번역 준비 중...',
              percentage: 0,
              estimatedSecondsLeft: 0,
            });

            const koreanCache = await translateAnalysisResult(
              apiKey,
              result,
              (progress) => {
                setInitialTranslationProgress({
                  stage: progress.stage as 'translating' | 'saving' | 'complete',
                  message: progress.message,
                  percentage: progress.percentage,
                  estimatedSecondsLeft: 0,
                });
              }
            );

            if (isEmptySession && currentSession) {
              // 빈 세션인 경우 기존 세션 업데이트
              const updatedSession = updateSession(currentSession, {
                analysis: result,
                referenceImages: uploadedImages,
                koreanAnalysis: koreanCache,
                imageCount: uploadedImages.length,
              });
              const updatedSessions = updateSessionInList(sessions, currentSession.id, updatedSession);
              setSessions(updatedSessions);
              setCurrentSession(updatedSession);
              await persistSessions(updatedSessions);
            } else if (isRefinementMode && currentSession) {
              // 분석 강화 모드 - 기존 세션 업데이트
              const updatedSession = updateSession(currentSession, {
                analysis: result,
                referenceImages: uploadedImages,
                koreanAnalysis: koreanCache,
                imageCount: uploadedImages.length,
              });
              const updatedSessions = updateSessionInList(sessions, currentSession.id, updatedSession);
              setSessions(updatedSessions);
              setCurrentSession(updatedSession);
              await persistSessions(updatedSessions);
            } else {
              // 신규 세션 생성
              const newSession = createNewSession(result, uploadedImages, koreanCache);
              const updatedSessions = addSessionToList(sessions, newSession);
              setSessions(updatedSessions);
              setCurrentSession(newSession);
              await persistSessions(updatedSessions);
            }

            setInitialTranslationProgress({
              stage: 'complete',
              message: '완료!',
              percentage: 100,
              estimatedSecondsLeft: 0,
            });

            setTimeout(() => {
              setInitialTranslationProgress({
                stage: 'idle',
                message: '',
                percentage: 0,
                estimatedSecondsLeft: 0,
              });
            }, 2000);
          } catch (error) {
            logger.error('❌ [분석 후] 번역 오류:', error);
            setInitialTranslationProgress({
              stage: 'idle',
              message: '',
              percentage: 0,
              estimatedSecondsLeft: 0,
            });
          }
        },
        onError: (error) => {
          setIsAnalyzing(false);
          logger.error('❌ 분석 오류:', error);
          setErrorDialog({
            title: '분석 오류',
            message: error.message
          });
        },
      },
      currentSession?.type, // sessionType 전달
      isRefinementMode ? { previousAnalysis: analysisResult } : undefined
    );
  };

  const handleAnalyze = async () => {
    if (!apiKey) {
      setInfoDialog({
        title: 'API 키 필요',
        message: 'API 키를 먼저 설정해주세요'
      });
      setShowSettings(true);
      return;
    }

    if (uploadedImages.length === 0) {
      setInfoDialog({
        title: '이미지 업로드 필요',
        message: '이미지를 먼저 업로드해주세요'
      });
      return;
    }

    // 빈 세션인지 확인 (모든 필드가 빈 문자열인 경우)
    const isEmptySession = currentSession &&
      currentSession.analysis &&
      currentSession.analysis.style.art_style === '' &&
      currentSession.analysis.style.technique === '' &&
      currentSession.analysis.character.gender === '' &&
      currentSession.analysis.character.age_group === '' &&
      currentSession.analysis.composition.pose === '' &&
      currentSession.analysis.composition.angle === '' &&
      currentSession.analysis.negative_prompt === '';

    const isRefinementMode = currentSession && analysisResult && !isEmptySession;

    if (isRefinementMode) {
      const hasNewImages = uploadedImages.length > currentSession.imageCount;

      if (!hasNewImages) {
        setInfoDialog({
          title: '신규 이미지 필요',
          message: '신규 이미지가 없습니다. 이미지를 추가한 후 다시 분석해주세요.'
        });
        return;
      }

      // 커스텀 다이얼로그 표시
      setRefineConfirm(true);
      return;
    }

    // 즉시 분석 수행
    await performAnalysis();
  };

  // 분석 강화 확인 핸들러
  const confirmRefine = async () => {
    setRefineConfirm(false);
    await performAnalysis();
  };

  const cancelRefine = () => {
    setRefineConfirm(false);
  };

  const handleSettingsClick = useCallback(() => {
    setShowSettings(true);
  }, [setShowSettings]);

  // 세션 이름 변경 핸들러
  const handleRenameSession = useCallback(async (sessionId: string, newName: string) => {
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) return;

    const updatedSession = { ...sessions[sessionIndex], name: newName, updatedAt: new Date().toISOString() };
    const updatedSessions = [...sessions];
    updatedSessions[sessionIndex] = updatedSession;

    setSessions(updatedSessions);
    if (currentSession?.id === sessionId) {
      setCurrentSession(updatedSession);
    }
    await persistSessions(updatedSessions);
    logger.info('✅ 세션 이름 변경:', newName);
  }, [sessions, currentSession, setSessions, setCurrentSession]);

  // 세션 선택 핸들러 (폴더 선택 해제)
  const handleSelectSessionWithFolderDeselect = useCallback((session: Session) => {
    setSelectedFolderId(null);
    handleSelectSession(session);
  }, [handleSelectSession]);

  // 폴더 선택 핸들러
  const handleSelectFolder = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId);
  }, []);

  // 폴더 진입 핸들러 (폴더 선택 해제)
  const handleNavigateToFolder = useCallback((folderId: string | null) => {
    setSelectedFolderId(null);
    navigateToFolder(folderId);
  }, [navigateToFolder]);

  // 폴더 뒤로가기 핸들러 (폴더 선택 해제)
  const handleNavigateBack = useCallback(() => {
    setSelectedFolderId(null);
    navigateBack();
  }, [navigateBack]);

  const handleSaveSessionClick = useCallback(() => {
    if (!analysisResult || uploadedImages.length === 0) {
      setInfoDialog({
        title: '분석 결과 없음',
        message: '분석 결과가 없습니다'
      });
      return;
    }
    setShowSaveSession(true);
  }, [analysisResult, uploadedImages]);

  const handleReset = useCallback(() => {
    // 신규 세션 모달 표시
    setShowNewSession(true);
  }, []);

  const handleNewSession = useCallback(async (name: string, type: SessionType) => {
    // 빈 분석 결과 생성 (임시 세션용)
    const emptyAnalysis: ImageAnalysisResult = {
      style: {
        art_style: '',
        technique: '',
        color_palette: '',
        lighting: '',
        mood: '',
      },
      character: {
        gender: '',
        age_group: '',
        hair: '',
        eyes: '',
        face: '',
        outfit: '',
        accessories: '',
        body_proportions: '',
        limb_proportions: '',
        torso_shape: '',
        hand_style: '',
      },
      composition: {
        pose: '',
        angle: '',
        background: '',
        depth_of_field: '',
      },
      negative_prompt: '',
    };

    // 빈 세션 생성
    const newSession = createNewSession(emptyAnalysis, [], undefined, type);
    // 세션 이름 설정
    newSession.name = name;
    // 현재 폴더 ID 설정
    newSession.folderId = getCurrentFolderIdForNewSession();

    const updatedSessions = addSessionToList(sessions, newSession);
    setSessions(updatedSessions);
    setCurrentSession(newSession);
    persistSessions(updatedSessions);

    // 세션-폴더 매핑 저장
    if (newSession.folderId !== null) {
      await moveSessionToFolder(newSession.id, newSession.folderId);
    }

    // 상태 초기화
    setUploadedImages([]);
    setAnalysisResult(null);
    setCurrentView('analysis');
  }, [sessions, setSessions, setCurrentSession, setUploadedImages, getCurrentFolderIdForNewSession, moveSessionToFolder]);

  const handleGenerateImage = async () => {
    if (!analysisResult) {
      setInfoDialog({
        title: '분석 결과 없음',
        message: '분석 결과가 없습니다'
      });
      return;
    }

    setGenerateProgress({
      stage: 'idle',
      message: '',
      percentage: 0,
      estimatedSecondsLeft: 0,
    });

    try {
      let koreanCache = currentSession?.koreanAnalysis;

      // 변경된 내용이 있으면 번역
      if (currentSession && hasChangesToTranslate(analysisResult, currentSession)) {
        setGenerateProgress({
          stage: 'translating',
          message: '변경된 내용 번역 중...',
          percentage: 0,
          estimatedSecondsLeft: 0,
        });
        const { updatedAnalysis, updatedKoreanCache } = await translateAndUpdateCache(
          apiKey,
          analysisResult,
          currentSession,
          (progress) => {
            setGenerateProgress({
              stage: progress.stage as 'translating' | 'saving' | 'complete',
              message: progress.message,
              percentage: progress.percentage,
              estimatedSecondsLeft: 0,
            });
          }
        );
        setAnalysisResult(updatedAnalysis);
        koreanCache = updatedKoreanCache;
      } else if (!currentSession) {
        // 새 세션인 경우 전체 번역
        setGenerateProgress({
          stage: 'translating',
          message: '전체 번역 중...',
          percentage: 0,
          estimatedSecondsLeft: 0,
        });
        koreanCache = await translateAnalysisResult(apiKey, analysisResult);
      }

      // 사용자 맞춤 프롬프트는 이미 세션 저장 시 번역되어 캐시에 저장됨
      // 이미지 생성 화면 이동 시에는 추가 번역 불필요

      // 세션 저장
      setGenerateProgress({
        stage: 'saving',
        message: '세션 저장 중...',
        percentage: 95,
        estimatedSecondsLeft: 0,
      });

      if (!currentSession) {
        const newSession = createNewSession(analysisResult, uploadedImages, koreanCache);
        const updatedSessions = addSessionToList(sessions, newSession);
        setSessions(updatedSessions);
        setCurrentSession(newSession);
        await persistSessions(updatedSessions);
      } else if (currentSession) {
        const updatedSession = updateSession(currentSession, {
          analysis: analysisResult,
          koreanAnalysis: koreanCache,
        });
        const updatedSessions = updateSessionInList(sessions, currentSession.id, updatedSession);
        setSessions(updatedSessions);
        setCurrentSession(updatedSession);
        await persistSessions(updatedSessions);
      }

      setGenerateProgress({
        stage: 'complete',
        message: '완료!',
        percentage: 100,
        estimatedSecondsLeft: 0,
      });

      // 잠시 후 화면 이동
      setTimeout(() => {
        setCurrentView('generator');
        setGenerateProgress({
          stage: 'idle',
          message: '',
          percentage: 0,
          estimatedSecondsLeft: 0,
        });
      }, 500);
    } catch (error) {
      logger.error('❌ [이미지 생성] 번역/저장 오류:', error);
      setGenerateProgress({
        stage: 'idle',
        message: '',
        percentage: 0,
        estimatedSecondsLeft: 0,
      });
      setErrorDialog({
        title: '오류 발생',
        message: '번역 또는 저장 중 오류가 발생했습니다.'
      });
    }
  };

  const handleBackToAnalysis = () => {
    setCurrentView('analysis');
  };

  return (
    <ErrorBoundary>
      <div className="h-screen flex bg-gray-100 overflow-hidden relative">
      {/* 사이드바 - 이미지 생성 화면에서는 왼쪽으로 슬라이드 아웃 */}
      <div
        className={`absolute top-0 left-0 h-full z-10 transition-transform duration-500 ease-in-out ${
          currentView === 'generator' ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSession?.id}
          onSelectSession={handleSelectSessionWithFolderDeselect}
          onDeleteSession={handleDeleteSession}
          onExportSession={handleExportSession}
          onRenameSession={handleRenameSession}
          onNewImage={handleReset}
          onImportSession={handleImportSession}
          onSettingsClick={handleSettingsClick}
          onReorderSessions={handleReorderSessions}
          disabled={currentView === 'generator'}
          // 폴더 관련 props
          folders={folders}
          currentFolderId={currentFolderId}
          folderPath={folderPath}
          currentFolderSessions={currentFolderSessions}
          currentFolderSubfolders={currentFolderSubfolders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={handleSelectFolder}
          onNavigateToFolder={handleNavigateToFolder}
          onNavigateBack={handleNavigateBack}
          onCreateFolder={async (name) => { await createFolder(name); }}
          onRenameFolder={renameFolder}
          onDeleteFolder={async (folderId, deleteContents) => {
            await deleteFolder(folderId, deleteContents, sessions, handleDeleteSession);
          }}
          onMoveSessionToFolder={moveSessionToFolder}
          onMoveFolderToFolder={moveFolderToFolder}
          onReorderFolders={reorderFolders}
        />
      </div>

      <main className={`flex flex-col overflow-hidden transition-all duration-500 ease-in-out ${
        currentView === 'generator' ? 'ml-0 w-full' : 'ml-72 flex-1'
      }`}>
        {selectedFolderId ? (
          // 폴더 선택 시 도움말 표시
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="max-w-md p-8 bg-white rounded-2xl shadow-lg border border-gray-200">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">📁 폴더 기능</h2>
                <p className="text-gray-600 text-sm">폴더를 사용하여 세션을 체계적으로 관리하세요</p>
              </div>
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg">⌨️</span>
                  <div>
                    <p className="font-semibold text-gray-800">Enter 키</p>
                    <p className="text-gray-600">선택한 폴더 이름 편집</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg">🖱️</span>
                  <div>
                    <p className="font-semibold text-gray-800">더블 클릭</p>
                    <p className="text-gray-600">폴더 안으로 이동</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg">📁</span>
                  <div>
                    <p className="font-semibold text-gray-800">폴더 중첩</p>
                    <p className="text-gray-600">폴더 안에 하위 폴더 생성 가능</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg">✋</span>
                  <div>
                    <p className="font-semibold text-gray-800">드래그 & 드롭</p>
                    <p className="text-gray-600">세션을 폴더로 드래그하여 이동</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 text-center">
                  💡 세션을 선택하면 이미지 분석 화면으로 돌아갑니다
                </p>
              </div>
            </div>
          </div>
        ) : uploadedImages.length > 0 ? (
          currentView === 'analysis' ? (
            <AnalysisPanel
              images={uploadedImages}
              isAnalyzing={isAnalyzing}
              analysisResult={analysisResult}
              koreanAnalysis={currentSession?.koreanAnalysis}
              onAnalyze={handleAnalyze}
              onSaveSession={handleSaveSessionClick}
              onAddImage={handleImageSelect}
              onRemoveImage={handleRemoveImage}
              onGenerateImage={analysisResult ? handleGenerateImage : undefined}
              currentSession={currentSession}
              onCustomPromptChange={handleCustomPromptChange}
              onStyleUpdate={(style) => {
                if (analysisResult) {
                  const updated = { ...analysisResult, style };
                  setAnalysisResult(updated);
                  saveSessionWithoutTranslation(updated);
                }
              }}
              onCharacterUpdate={(character) => {
                if (analysisResult) {
                  const updated = { ...analysisResult, character };
                  setAnalysisResult(updated);
                  saveSessionWithoutTranslation(updated);
                }
              }}
              onCompositionUpdate={(composition) => {
                if (analysisResult) {
                  const updated = { ...analysisResult, composition };
                  setAnalysisResult(updated);
                  saveSessionWithoutTranslation(updated);
                }
              }}
              onNegativePromptUpdate={(negativePrompt) => {
                if (analysisResult) {
                  const updated = { ...analysisResult, negative_prompt: negativePrompt };
                  setAnalysisResult(updated);
                  saveSessionWithoutTranslation(updated);
                }
              }}
              onStyleKoreanUpdate={(koreanStyle) => {
                updateKoreanCache({ style: koreanStyle });
              }}
              onCharacterKoreanUpdate={(koreanCharacter) => {
                updateKoreanCache({ character: koreanCharacter });
              }}
              onCompositionKoreanUpdate={(koreanComposition) => {
                updateKoreanCache({ composition: koreanComposition });
              }}
              onNegativePromptKoreanUpdate={(koreanNegativePrompt) => {
                updateKoreanCache({ negativePrompt: koreanNegativePrompt });
              }}
              onUIAnalysisUpdate={(uiAnalysis) => {
                if (analysisResult) {
                  const updated = { ...analysisResult, ui_specific: uiAnalysis };
                  setAnalysisResult(updated);
                  saveSessionWithoutTranslation(updated);
                }
              }}
              onUIAnalysisKoreanUpdate={(koreanUIAnalysis) => {
                updateKoreanCache({ uiAnalysis: koreanUIAnalysis });
              }}
              onLogoAnalysisUpdate={(logoAnalysis) => {
                if (analysisResult) {
                  const updated = { ...analysisResult, logo_specific: logoAnalysis };
                  setAnalysisResult(updated);
                  saveSessionWithoutTranslation(updated);
                }
              }}
              onLogoAnalysisKoreanUpdate={(koreanLogoAnalysis) => {
                updateKoreanCache({ logoAnalysis: koreanLogoAnalysis });
              }}
            />
          ) : (
            analysisResult && (
              <ImageGeneratorPanel
                apiKey={apiKey}
                analysis={analysisResult}
                referenceImages={uploadedImages}
                sessionType={currentSession?.type || 'STYLE'}
                koreanAnalysis={currentSession?.koreanAnalysis}
                generationHistory={currentSession?.generationHistory}
                onHistoryAdd={handleHistoryAdd}
                onHistoryUpdate={handleHistoryUpdate}
                onHistoryDelete={handleHistoryDelete}
                onBack={handleBackToAnalysis}
                autoSavePath={currentSession?.autoSavePath}
                referenceDocuments={currentSession?.referenceDocuments}
                onDocumentAdd={handleDocumentAdd}
                onDocumentDelete={handleDocumentDelete}
                onAutoSavePathChange={handleAutoSavePathChange}
              />
            )
          )
        ) : !currentSession ? (
          <EmptyState onNewSession={handleReset} />
        ) : (
          <ImageUpload onImageSelect={handleImageSelect} />
        )}
      </main>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentApiKey={apiKey}
        onSave={handleSaveApiKey}
      />

      <SaveSessionModal
        isOpen={showSaveSession}
        onClose={() => setShowSaveSession(false)}
        onSave={saveSession}
        currentSession={currentSession}
      />

      <NewSessionModal
        isOpen={showNewSession}
        onClose={() => setShowNewSession(false)}
        onCreate={handleNewSession}
      />

      <ProgressIndicator {...progress} />
      {saveProgress.stage !== 'idle' && <ProgressIndicator {...saveProgress} />}
      {generateProgress.stage !== 'idle' && <ProgressIndicator {...generateProgress} />}
      {initialTranslationProgress.stage !== 'idle' && <ProgressIndicator {...initialTranslationProgress} />}

      {/* 분석 강화 확인 다이얼로그 */}
      {refineConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              cancelRefine();
            }
          }}
        >
          <div
            className="bg-white border border-gray-200 rounded-lg shadow-xl max-w-sm w-full p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2 text-gray-800">분석 강화 확인</h3>
            <p className="text-gray-600 mb-6">
              기존 분석 내용이 변경될 수 있습니다.
              <br />
              그래도 진행하시겠습니까?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelRefine}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors font-medium text-gray-700"
              >
                취소
              </button>
              <button
                onClick={confirmRefine}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-colors font-medium text-white"
              >
                분석하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 개수 제한 경고 다이얼로그 */}
      {showLimitWarning && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLimitWarning(false);
            }
          }}
        >
          <div
            className="bg-white border border-gray-200 rounded-lg shadow-xl max-w-md w-full p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2 text-red-600">이미지 개수 제한</h3>
            <p className="text-gray-600 mb-4">
              참조 이미지는 최대 14개까지 등록할 수 있습니다.
            </p>
            <p className="text-gray-600 mb-6">
              기존 이미지를 제거한 후 새로운 이미지를 등록해 주세요.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLimitWarning(false)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-colors font-medium text-white"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 손상된 세션 경고 다이얼로그 */}
      {damagedSessionsWarning && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDamagedSessionsWarning(null);
            }
          }}
        >
          <div
            className="bg-white border border-gray-200 rounded-lg shadow-xl max-w-lg w-full p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 text-yellow-600">⚠️ 세션 손상 경고</h3>
            <pre className="text-gray-700 mb-6 whitespace-pre-wrap text-sm">{damagedSessionsWarning}</pre>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDamagedSessionsWarning(null)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-colors font-medium text-white"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 에러 다이얼로그 */}
      {errorDialog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setErrorDialog(null);
            }
          }}
        >
          <div
            className="bg-white border border-gray-200 rounded-lg shadow-xl max-w-md w-full p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 text-red-600">❌ {errorDialog.title}</h3>
            <p className="text-gray-700 mb-6 whitespace-pre-wrap">{errorDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setErrorDialog(null)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-colors font-medium text-white"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 정보 다이얼로그 */}
      {infoDialog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setInfoDialog(null);
            }
          }}
        >
          <div
            className="bg-white border border-gray-200 rounded-lg shadow-xl max-w-md w-full p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 text-blue-600">ℹ️ {infoDialog.title}</h3>
            <p className="text-gray-700 mb-6 whitespace-pre-wrap">{infoDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setInfoDialog(null)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-colors font-medium text-white"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
