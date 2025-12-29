import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ImageUpload } from './components/ImageUpload';
import { AnalysisPanel } from './components/AnalysisPanel';
import { ImageGeneratorPanel } from './components/ImageGeneratorPanel';
import { SettingsModal } from './components/SettingsModal';
import { SaveSessionModal } from './components/SaveSessionModal';
import { useGeminiAnalyzer } from './hooks/useGeminiAnalyzer';
import {
  loadApiKey,
  saveApiKey,
  saveSessions,
  loadSessions,
  exportSessionToFile,
  importSessionFromFile,
} from './lib/storage';
import { ImageAnalysisResult } from './types/analysis';
import { Session, SessionType } from './types/session';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showSaveSession, setShowSaveSession] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [progressMessage, setProgressMessage] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentView, setCurrentView] = useState<'analysis' | 'generator'>('analysis');

  const { analyzeImages } = useGeminiAnalyzer();

  // 앱 시작 시 API 키 및 세션 로드
  useEffect(() => {
    const initialize = async () => {
      try {
        const savedApiKey = await loadApiKey();
        if (savedApiKey) {
          setApiKey(savedApiKey);
          console.log('✅ API 키 로드 완료');
        } else {
          // API 키가 없으면 설정 모달 표시
          setShowSettings(true);
          console.log('⚠️ API 키 없음 - 설정 모달 표시');
        }

        // 세션 로드
        const savedSessions = await loadSessions();
        setSessions(savedSessions);
        console.log('✅ 세션 로드 완료:', savedSessions.length, '개');
      } catch (error) {
        console.error('초기화 오류:', error);
        setShowSettings(true);
      }
    };

    initialize();
  }, []);

  const handleImageSelect = (imageData: string) => {
    console.log('🖼️ 이미지 추가:', imageData.substring(0, 50) + '...');
    setUploadedImages((prev) => [...prev, imageData]);

    // 세션이 없을 때만 분석 결과 초기화
    // 세션이 있으면 기존 분석 결과를 유지하고 나중에 "분석 강화" 실행
    if (!currentSession) {
      setAnalysisResult(null);
      console.log('   - 분석 결과 초기화 (새 세션)');
    } else {
      console.log('   - 기존 분석 유지 (세션 있음, 나중에 분석 강화 가능)');
    }
  };

  const handleRemoveImage = (index: number) => {
    console.log('🗑️ 이미지 제거:', index);
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
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

    setIsAnalyzing(true);
    setProgressMessage('분석 준비 중...');

    // 분석 강화 모드 감지: currentSession이 있고 기존 analysisResult가 있으면 강화 모드
    const isRefinementMode = currentSession && analysisResult;

    if (isRefinementMode) {
      console.log('🔄 분석 강화 모드 활성화');
      console.log('   - 기존 분석 결과:', analysisResult);
      console.log('   - 현재 이미지 개수:', uploadedImages.length);
    }

    // 모든 이미지를 Gemini에 전송하여 공통 스타일 분석 (또는 분석 강화)
    await analyzeImages(
      apiKey,
      uploadedImages,
      {
        onProgress: (message) => {
          setProgressMessage(message);
          console.log('📊 진행 상황:', message);
        },
        onComplete: (result) => {
          setAnalysisResult(result);
          setIsAnalyzing(false);
          setProgressMessage('');
          console.log('✅ 분석 완료:', result);

          if (isRefinementMode) {
            console.log('✨ 분석 강화 완료!');
          }
        },
        onError: (error) => {
          setIsAnalyzing(false);
          setProgressMessage('');
          console.error('❌ 분석 오류:', error);
          alert('분석 오류: ' + error.message);
        },
      },
      isRefinementMode ? { previousAnalysis: analysisResult } : undefined
    );
  };

  const handleSettingsClick = () => {
    setShowSettings(true);
  };

  const handleSaveApiKey = async (newApiKey: string) => {
    try {
      await saveApiKey(newApiKey);
      setApiKey(newApiKey);
      console.log('✅ API 키 저장 완료');
    } catch (error) {
      console.error('API 키 저장 오류:', error);
      alert('API 키 저장 실패: ' + (error as Error).message);
    }
  };

  const handleSaveSessionClick = () => {
    console.log('💾 세션 저장 버튼 클릭됨');
    console.log('   - 분석 결과:', analysisResult);
    console.log('   - 업로드된 이미지 개수:', uploadedImages.length);

    if (!analysisResult || uploadedImages.length === 0) {
      alert('분석 결과가 없습니다');
      return;
    }

    setShowSaveSession(true);
  };

  const handleSaveSession = async (sessionName: string, sessionType: SessionType) => {
    console.log('📝 세션 저장 시작');
    console.log('   - 세션 이름:', sessionName);
    console.log('   - 세션 타입:', sessionType);
    console.log('   - 이미지 개수:', uploadedImages.length);
    console.log('   - 현재 세션:', currentSession?.id);

    if (!analysisResult || uploadedImages.length === 0) {
      alert('분석 결과가 없습니다');
      return;
    }

    let updatedSessions: Session[];
    let sessionToSave: Session;

    // 기존 세션 업데이트 or 새 세션 생성
    if (currentSession) {
      // 기존 세션 업데이트
      console.log('🔄 기존 세션 업데이트 모드');
      sessionToSave = {
        ...currentSession,
        name: sessionName,
        type: sessionType,
        updatedAt: new Date().toISOString(),
        referenceImages: uploadedImages,
        analysis: analysisResult,
        imageCount: uploadedImages.length,
      };

      // 세션 목록에서 기존 세션을 찾아서 교체
      updatedSessions = sessions.map((s) => (s.id === currentSession.id ? sessionToSave : s));
      console.log('   - 기존 세션 업데이트됨:', sessionToSave.id);
    } else {
      // 새 세션 생성
      console.log('✨ 새 세션 생성 모드');
      sessionToSave = {
        id: Date.now().toString(),
        name: sessionName,
        type: sessionType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        referenceImages: uploadedImages,
        analysis: analysisResult,
        imageCount: uploadedImages.length,
      };

      // 세션 목록에 추가
      updatedSessions = [...sessions, sessionToSave];
      console.log('   - 새 세션 생성됨:', sessionToSave.id);
    }

    console.log('📦 저장할 세션:', sessionToSave);
    setSessions(updatedSessions);
    console.log('📋 업데이트된 세션 목록:', updatedSessions.length, '개');

    // Tauri Store에 저장
    try {
      await saveSessions(updatedSessions);
      alert(
        `세션 "${sessionName}"이(가) ${currentSession ? '업데이트' : '저장'}되었습니다!\n참조 이미지: ${uploadedImages.length}개`
      );
      console.log('✅ 세션 저장 완료:', sessionToSave);

      // 세션을 현재 세션으로 설정
      setCurrentSession(sessionToSave);
    } catch (error) {
      console.error('❌ 세션 저장 오류:', error);
      alert('세션 저장 실패: ' + (error as Error).message);
    }
  };

  const handleSelectSession = (session: Session) => {
    // 세션 선택 시 이미지와 분석 결과 로드
    setCurrentSession(session);
    setUploadedImages(session.referenceImages);
    setAnalysisResult(session.analysis);
    console.log('✅ 세션 로드:', session.name);
    console.log('   - 참조 이미지 개수:', session.referenceImages.length);
  };

  const handleDeleteSession = async (sessionId: string) => {
    const updatedSessions = sessions.filter((s) => s.id !== sessionId);
    setSessions(updatedSessions);

    // 현재 세션이 삭제되는 경우 초기화
    if (currentSession?.id === sessionId) {
      setCurrentSession(null);
      setUploadedImages([]);
      setAnalysisResult(null);
    }

    try {
      await saveSessions(updatedSessions);
      console.log('✅ 세션 삭제 완료');
    } catch (error) {
      console.error('세션 삭제 오류:', error);
      alert('세션 삭제 실패: ' + (error as Error).message);
    }
  };

  const handleReset = () => {
    console.log('🔄 이미지 리셋');
    setCurrentSession(null);
    setUploadedImages([]);
    setAnalysisResult(null);
    setCurrentView('analysis');
  };

  const handleGenerateImage = () => {
    console.log('🎨 이미지 생성 화면으로 전환');
    setCurrentView('generator');
  };

  const handleBackToAnalysis = () => {
    console.log('📊 분석 화면으로 복귀');
    setCurrentView('analysis');
  };

  const handleExportSession = async (session: Session) => {
    try {
      console.log('💾 세션 내보내기:', session.name);
      await exportSessionToFile(session);
      alert(`세션 "${session.name}"이(가) 파일로 저장되었습니다!`);
    } catch (error) {
      console.error('❌ 세션 내보내기 오류:', error);
      alert('세션 저장 실패: ' + (error as Error).message);
    }
  };

  const handleImportSession = async () => {
    try {
      console.log('📂 세션 가져오기 시작');
      const importedSession = await importSessionFromFile();

      if (!importedSession) {
        console.log('❌ 세션 가져오기 취소됨');
        return;
      }

      console.log('✅ 세션 가져오기 성공:', importedSession.name);

      // 중복 ID 확인 및 처리
      const isDuplicate = sessions.some((s) => s.id === importedSession.id);
      if (isDuplicate) {
        // 새 ID 생성
        importedSession.id = Date.now().toString();
        console.log('⚠️ 중복 ID 감지, 새 ID 생성:', importedSession.id);
      }

      // 세션 목록에 추가
      const updatedSessions = [...sessions, importedSession];
      setSessions(updatedSessions);

      // Tauri Store에 저장
      await saveSessions(updatedSessions);

      alert(
        `세션 "${importedSession.name}"을(를) 불러왔습니다!\n참조 이미지: ${importedSession.imageCount}개`
      );

      // 불러온 세션을 현재 세션으로 설정
      setCurrentSession(importedSession);
      setUploadedImages(importedSession.referenceImages);
      setAnalysisResult(importedSession.analysis);
    } catch (error) {
      console.error('❌ 세션 가져오기 오류:', error);
      alert('세션 불러오기 실패: ' + (error as Error).message);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Header onSettingsClick={handleSettingsClick} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          sessions={sessions}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onExportSession={handleExportSession}
          onNewImage={handleReset}
          onImportSession={handleImportSession}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          {uploadedImages.length > 0 ? (
            currentView === 'analysis' ? (
              <AnalysisPanel
                images={uploadedImages}
                isAnalyzing={isAnalyzing}
                analysisResult={analysisResult}
                onAnalyze={handleAnalyze}
                onSaveSession={handleSaveSessionClick}
                onReset={handleReset}
                onAddImage={handleImageSelect}
                onRemoveImage={handleRemoveImage}
                onGenerateImage={analysisResult ? handleGenerateImage : undefined}
                currentSession={currentSession}
              />
            ) : (
              analysisResult && (
                <ImageGeneratorPanel
                  apiKey={apiKey}
                  analysis={analysisResult}
                  referenceImages={uploadedImages}
                  sessionType={currentSession?.type || 'STYLE'}
                  onSettingsClick={handleSettingsClick}
                  onBack={handleBackToAnalysis}
                />
              )
            )
          ) : (
            <ImageUpload onImageSelect={handleImageSelect} />
          )}
        </main>
      </div>

      {/* 설정 모달 */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentApiKey={apiKey}
        onSave={handleSaveApiKey}
      />

      {/* 세션 저장 모달 */}
      <SaveSessionModal
        isOpen={showSaveSession}
        onClose={() => setShowSaveSession(false)}
        onSave={handleSaveSession}
        currentSession={currentSession}
      />
    </div>
  );
}

export default App;
