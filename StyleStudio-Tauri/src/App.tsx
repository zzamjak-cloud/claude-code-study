import { useState, useCallback } from 'react';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Sidebar } from './components/common/Sidebar';
import { ImageUpload } from './components/generator/ImageUpload';
import { AnalysisPanel } from './components/analysis/AnalysisPanel';
import { ImageGeneratorPanel } from './components/generator/ImageGeneratorPanel';
import { SettingsModal } from './components/common/SettingsModal';
import { SaveSessionModal } from './components/common/SaveSessionModal';
import { useGeminiAnalyzer } from './hooks/api/useGeminiAnalyzer';
import { useAutoSave } from './hooks/useAutoSave';
import { ProgressIndicator } from './components/common/ProgressIndicator';
import { ImageAnalysisResult } from './types/analysis';
import { Session } from './types/session';
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [currentView, setCurrentView] = useState<'analysis' | 'generator'>('analysis');

  // 커스텀 훅 사용
  const { uploadedImages, setUploadedImages, handleImageSelect, handleRemoveImage } =
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
    handleDeleteSession,
    handleExportSession,
    handleImportSession,
    handleReorderSessions,
    handleHistoryAdd,
    handleHistoryDelete,
    saveSessionWithoutTranslation,
    updateKoreanCache,
  } = useSessionManagement();
  const { analyzeImages } = useGeminiAnalyzer();
  const {
    translateAnalysisResult,
    hasChangesToTranslate,
    translateAndUpdateCache,
    translateCustomPrompt,
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

    const isRefinementMode = currentSession && analysisResult;

    if (isRefinementMode) {
      const hasNewImages = uploadedImages.length > currentSession.imageCount;

      if (!hasNewImages) {
        alert('신규 이미지가 없습니다. 이미지를 추가한 후 다시 분석해주세요.');
        return;
      }

      const confirmed = window.confirm(
        '기존 내용들이 변경될 수도 있습니다. 그래도 진행하시겠습니까?'
      );

      if (!confirmed) {
        return;
      }
    }

    setIsAnalyzing(true);

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

          if (!isRefinementMode) {
            try {
              const koreanCache = await translateAnalysisResult(apiKey, result);

              if (result.user_custom_prompt) {
                koreanCache.customPromptEnglish = await translateCustomPrompt(
                  apiKey,
                  result.user_custom_prompt
                );
              }

              const newSession = createNewSession(result, uploadedImages, koreanCache);
              const updatedSessions = addSessionToList(sessions, newSession);
              setSessions(updatedSessions);
              setCurrentSession(newSession);
              await persistSessions(updatedSessions);
            } catch (error) {
              logger.error('❌ [신규 분석] 번역 오류:', error);
            }
          }
        },
        onError: (error) => {
          setIsAnalyzing(false);
          logger.error('❌ 분석 오류:', error);
          alert('분석 오류: ' + error.message);
        },
      },
      isRefinementMode ? { previousAnalysis: analysisResult } : undefined
    );
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
    setCurrentSession(null);
    setUploadedImages([]);
    setAnalysisResult(null);
    setCurrentView('analysis');
  };

  const handleGenerateImage = async () => {
    if (!analysisResult) {
      alert('분석 결과가 없습니다');
      return;
    }

    try {
      let koreanCache = currentSession?.koreanAnalysis;

      if (currentSession && hasChangesToTranslate(analysisResult, currentSession)) {
        const { updatedAnalysis, updatedKoreanCache } = await translateAndUpdateCache(
          apiKey,
          analysisResult,
          currentSession
        );
        setAnalysisResult(updatedAnalysis);
        koreanCache = updatedKoreanCache;
      } else if (!currentSession) {
        koreanCache = await translateAnalysisResult(apiKey, analysisResult);
      }

      if (koreanCache && analysisResult.user_custom_prompt) {
        koreanCache.customPromptEnglish = await translateCustomPrompt(
          apiKey,
          analysisResult.user_custom_prompt
        );
      }

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

      setCurrentView('generator');
    } catch (error) {
      logger.error('❌ [이미지 생성] 번역/저장 오류:', error);
      alert('번역 또는 저장 중 오류가 발생했습니다.');
    }
  };

  const handleBackToAnalysis = () => {
    setCurrentView('analysis');
  };

  return (
    <ErrorBoundary>
      <div className="h-screen flex bg-gray-100">
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
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {uploadedImages.length > 0 ? (
          currentView === 'analysis' ? (
            <AnalysisPanel
              images={uploadedImages}
              isAnalyzing={isAnalyzing}
              analysisResult={analysisResult}
              koreanAnalysis={currentSession?.koreanAnalysis}
              onAnalyze={handleAnalyze}
              onSaveSession={handleSaveSessionClick}
              onReset={handleReset}
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
                customPromptEnglish={currentSession?.koreanAnalysis?.customPromptEnglish}
                generationHistory={currentSession?.generationHistory}
                onHistoryAdd={handleHistoryAdd}
                onHistoryDelete={handleHistoryDelete}
                onBack={handleBackToAnalysis}
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

      <ProgressIndicator {...progress} />
      {saveProgress.stage !== 'idle' && <ProgressIndicator {...saveProgress} />}
      </div>
    </ErrorBoundary>
  );
}

export default App;
