import { useState, useCallback } from 'react';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Sidebar } from './components/common/Sidebar';
import { ImageUpload } from './components/generator/ImageUpload';
import { AnalysisPanel } from './components/analysis/AnalysisPanel';
import { ImageGeneratorPanel } from './components/generator/ImageGeneratorPanel';
import { SettingsModal } from './components/common/SettingsModal';
import { SaveSessionModal } from './components/common/SaveSessionModal';
import { NewSessionModal } from './components/common/NewSessionModal';
import { useGeminiAnalyzer } from './hooks/api/useGeminiAnalyzer';
import { useAutoSave } from './hooks/useAutoSave';
import { useWindowState } from './hooks/useWindowState';
import { ProgressIndicator } from './components/common/ProgressIndicator';
import { ImageAnalysisResult } from './types/analysis';
import { Session, SessionType } from './types/session';
import { useImageHandling } from './hooks/useImageHandling';
import { useSessionManagement } from './hooks/useSessionManagement';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useTranslation } from './hooks/useTranslation';
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

  // 커스텀 훅 사용
  const { uploadedImages, setUploadedImages, handleImageSelect, handleRemoveImage, showLimitWarning, setShowLimitWarning } =
    useImageHandling();

  // 창 크기 및 위치 저장/복원
  useWindowState();

  const {
    apiKey,
    sessions,
    setSessions,
    currentSession,
    setCurrentSession,
    showSettings,
    setShowSettings,
    handleSaveApiKey,
    handleDeleteSession,
    handleExportSession,
    handleImportSession,
    handleReorderSessions,
    handleHistoryAdd,
    handleHistoryUpdate,
    handleHistoryDelete,
    handleDocumentAdd,
    handleDocumentDelete,
    saveSessionWithoutTranslation,
    updateKoreanCache,
  } = useSessionManagement();
  const { analyzeImages } = useGeminiAnalyzer();
  const {
    translateAnalysisResult,
    hasChangesToTranslate,
    translateAndUpdateCache,
  } = useTranslation();
  
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

  const handleCustomPromptChange = (customPrompt: string) => {
    if (analysisResult) {
      const updated = {
        ...analysisResult,
        user_custom_prompt: customPrompt,
      };
      setAnalysisResult(updated);
    }
  };

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
          alert('분석 오류: ' + error.message);
        },
      },
      currentSession?.type, // sessionType 전달
      isRefinementMode ? { previousAnalysis: analysisResult } : undefined
    );
  };

  const handleAnalyze = async () => {
    if (!apiKey) {
      alert('API 키를 먼저 설정해주세요');
      setShowSettings(true);
      return;
    }

    if (uploadedImages.length === 0) {
      alert('이미지를 먼저 업로드해주세요');
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
        alert('신규 이미지가 없습니다. 이미지를 추가한 후 다시 분석해주세요.');
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

  const handleSettingsClick = () => {
    setShowSettings(true);
  };

  const handleSaveSessionClick = () => {
    if (!analysisResult || uploadedImages.length === 0) {
      alert('분석 결과가 없습니다');
      return;
    }
    setShowSaveSession(true);
  };

  const handleSelectSession = (session: Session) => {
    setCurrentSession(session);
    setUploadedImages(session.referenceImages);
    setAnalysisResult(session.analysis);
  };

  const handleReset = () => {
    // 신규 세션 모달 표시
    setShowNewSession(true);
  };

  const handleNewSession = (name: string, type: SessionType) => {
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
    const updatedSessions = addSessionToList(sessions, newSession);
    setSessions(updatedSessions);
    setCurrentSession(newSession);
    persistSessions(updatedSessions);

    // 상태 초기화
    setUploadedImages([]);
    setAnalysisResult(null);
    setCurrentView('analysis');
  };

  const handleGenerateImage = async () => {
    if (!analysisResult) {
      alert('분석 결과가 없습니다');
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
      alert('번역 또는 저장 중 오류가 발생했습니다.');
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
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onExportSession={handleExportSession}
          onNewImage={handleReset}
          onImportSession={handleImportSession}
          onSettingsClick={handleSettingsClick}
          onReorderSessions={handleReorderSessions}
          disabled={currentView === 'generator'}
        />
      </div>

      <main className={`flex flex-col overflow-hidden transition-all duration-500 ease-in-out ${
        currentView === 'generator' ? 'ml-0 w-full' : 'ml-64 flex-1'
      }`}>
        {uploadedImages.length > 0 ? (
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
                onAutoSavePathChange={async (path) => {
                  if (currentSession) {
                    const updatedSession = updateSession(currentSession, { autoSavePath: path });
                    const updatedSessions = updateSessionInList(sessions, currentSession.id, updatedSession);
                    setSessions(updatedSessions);
                    setCurrentSession(updatedSession);
                    await persistSessions(updatedSessions);
                  }
                }}
              />
            )
          )
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
      </div>
    </ErrorBoundary>
  );
}

export default App;
