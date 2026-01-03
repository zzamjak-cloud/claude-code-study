import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ImageUpload } from './components/ImageUpload';
import { AnalysisPanel } from './components/AnalysisPanel';
import { ImageGeneratorPanel } from './components/ImageGeneratorPanel';
import { SettingsModal } from './components/SettingsModal';
import { SaveSessionModal } from './components/SaveSessionModal';
import { useGeminiAnalyzer } from './hooks/useGeminiAnalyzer';
import { useGeminiTranslator } from './hooks/useGeminiTranslator';
import { useAutoSave } from './hooks/useAutoSave';
import { ProgressIndicator } from './components/ProgressIndicator';
import { buildUnifiedPrompt } from './lib/promptBuilder';
import {
  loadApiKey,
  saveApiKey,
  saveSessions,
  loadSessions,
  exportSessionToFile,
  importSessionFromFile,
} from './lib/storage';
import { ImageAnalysisResult } from './types/analysis';
import { Session, SessionType, GenerationHistoryEntry, KoreanAnalysisCache } from './types/session';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { readFile } from '@tauri-apps/plugin-fs';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showSaveSession, setShowSaveSession] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentView, setCurrentView] = useState<'analysis' | 'generator'>('analysis');

  const { analyzeImages } = useGeminiAnalyzer();
  const { translateBatchToKorean, translateToEnglish } = useGeminiTranslator();
  const lastDropTimeRef = useRef(0);

  // 자동 저장 Hook
  const { progress, triggerManualSave } = useAutoSave({
    currentSession,
    analysisResult,
    apiKey,
    uploadedImages,
    onSessionUpdate: (session) => {
      setCurrentSession(session);
      // 세션 목록 업데이트
      const updatedSessions = currentSession
        ? sessions.map((s) => (s.id === session.id ? session : s))
        : [...sessions, session];
      setSessions(updatedSessions);
      // localStorage에 저장
      saveSessions(updatedSessions);
    },
    autoSaveEnabled: true,
    autoSaveDelay: 1000, // 1초 디바운스
  });

  // 분석 결과를 한국어로 번역 (한 번만 실행)
  const translateAnalysisResult = async (
    analysis: ImageAnalysisResult
  ): Promise<KoreanAnalysisCache> => {
    console.log('🌐 분석 결과 번역 시작...');

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
        customPromptEnglish: customPromptEnglish, // 이미지 생성 시 사용할 영어 번역
      };

      console.log('✅ 번역 완료 (한국어 표시용 + 영어 이미지 생성용)');
      return koreanCache;
    } catch (error) {
      console.error('❌ 번역 오류:', error);
      // 번역 실패 시 빈 캐시 반환
      return {};
    }
  };

  // Tauri 이미지 로드 함수
  const loadTauriImage = async (filePath: string): Promise<string | null> => {
    try {
      console.log('📁 Tauri 파일 읽기:', filePath);
      const fileData = await readFile(filePath);

      // Uint8Array를 base64로 변환
      const base64 = btoa(
        Array.from(new Uint8Array(fileData))
          .map((b) => String.fromCharCode(b))
          .join('')
      );

      // 확장자에서 MIME 타입 추정
      const ext = filePath.split('.').pop()?.toLowerCase();
      const mimeType = ext === 'png' ? 'image/png' :
                      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                      ext === 'gif' ? 'image/gif' :
                      ext === 'webp' ? 'image/webp' : 'image/png';

      const dataUrl = `data:${mimeType};base64,${base64}`;
      console.log('✅ Tauri 파일 변환 완료');
      return dataUrl;
    } catch (error) {
      console.error('❌ Tauri 파일 읽기 오류:', error);
      return null;
    }
  };

  // 전역 드래그 앤 드롭 리스너
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupGlobalDropListener = async () => {
      try {
        const appWindow = getCurrentWindow();

        unlisten = await appWindow.onDragDropEvent(async (event) => {
          if (event.payload.type === 'drop') {
            // 중복 이벤트 방지: 500ms 이내 재호출 무시
            const now = Date.now();
            if (now - lastDropTimeRef.current < 500) {
              console.log('⏳ [App] 중복 드롭 이벤트 무시');
              return;
            }
            lastDropTimeRef.current = now;

            const filePaths = event.payload.paths;
            console.log('📦 [App] 전역 드롭 이벤트:', filePaths?.length, '개 파일');

            if (filePaths && filePaths.length > 0) {
              // 이미지 파일만 필터링
              const imageFiles = filePaths.filter((filePath: string) => {
                const ext = filePath.split('.').pop()?.toLowerCase();
                return ext && ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
              });

              // 순차적으로 이미지 로드 및 추가
              for (const filePath of imageFiles) {
                const imageData = await loadTauriImage(filePath);
                if (imageData) {
                  setUploadedImages((prev) => [...prev, imageData]);
                  console.log('✅ [App] 이미지 추가됨');
                }
              }
            }
          }
        });

        console.log('✅ [App] 전역 드래그 앤 드롭 리스너 등록 완료');
      } catch (error) {
        console.error('❌ [App] 전역 드롭 리스너 등록 실패:', error);
      }
    };

    setupGlobalDropListener();

    return () => {
      if (unlisten) {
        unlisten();
        console.log('🧹 [App] 전역 드롭 리스너 정리 완료');
      }
    };
  }, []);

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

    // 기존 분석 결과가 있으면 유지 (분석 강화 가능)
    // 분석 결과가 없는 경우에만 초기 상태 유지
    if (analysisResult) {
      console.log('   - 기존 분석 유지 (분석 강화 가능)');
    } else {
      console.log('   - 분석 필요 (새 이미지)');
    }
  };

  const handleCustomPromptChange = (customPrompt: string) => {
    console.log('✏️ 사용자 맞춤 프롬프트 변경:', customPrompt);
    if (analysisResult) {
      setAnalysisResult({
        ...analysisResult,
        user_custom_prompt: customPrompt,
      });
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

    // 분석 강화 모드 감지: currentSession이 있고 기존 analysisResult가 있으면 강화 모드
    const isRefinementMode = currentSession && analysisResult;

    if (isRefinementMode) {
      console.log('🔄 분석 강화 모드 활성화');
      console.log('   - 기존 분석 결과:', analysisResult);
      console.log('   - 현재 이미지 개수:', uploadedImages.length);
      console.log('   - 세션 이미지 개수:', currentSession.imageCount);

      // 신규 이미지 확인
      const hasNewImages = uploadedImages.length > currentSession.imageCount;

      if (!hasNewImages) {
        alert('신규 이미지가 없습니다. 이미지를 추가한 후 다시 분석해주세요.');
        return;
      }

      // 신규 이미지가 있으면 확인 창 표시
      const confirmed = window.confirm(
        '기존 내용들이 변경될 수도 있습니다. 그래도 진행하시겠습니까?'
      );

      if (!confirmed) {
        console.log('❌ 사용자가 분석 강화를 취소함');
        return;
      }

      console.log('✅ 사용자가 분석 강화를 승인함');
    }

    setIsAnalyzing(true);

    // 모든 이미지를 Gemini에 전송하여 공통 스타일 분석 (또는 분석 강화)
    await analyzeImages(
      apiKey,
      uploadedImages,
      {
        onProgress: (message) => {
          console.log('📊 진행 상황:', message);
        },
        onComplete: (result) => {
          setAnalysisResult(result);
          setIsAnalyzing(false);
          console.log('✅ 분석 완료:', result);

          if (isRefinementMode) {
            console.log('✨ 분석 강화 완료!');
          }
        },
        onError: (error) => {
          setIsAnalyzing(false);
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

    // 번역 캐시 확인 및 생성
    let koreanCache: KoreanAnalysisCache | undefined;

    if (currentSession?.koreanAnalysis) {
      // 기존 번역 캐시 재사용
      console.log('♻️ 기존 번역 캐시 재사용');
      koreanCache = currentSession.koreanAnalysis;
    } else {
      // 새로 번역 실행
      console.log('🌐 번역 실행 중...');
      koreanCache = await translateAnalysisResult(analysisResult);
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
        koreanAnalysis: koreanCache,
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
        koreanAnalysis: koreanCache,
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

  const handleGenerateImage = async () => {
    console.log('🎨 이미지 생성 화면으로 전환');

    // 세션이 없으면 자동으로 저장 먼저 수행
    if (!currentSession) {
      console.log('⚠️ 세션이 없습니다. 자동 저장을 먼저 수행합니다...');
      await triggerManualSave();
    }

    setCurrentView('generator');
  };

  const handleHistoryAdd = (entry: GenerationHistoryEntry) => {
    console.log('📜 히스토리 추가:', entry.id);

    // 현재 세션이 있으면 히스토리에 추가
    if (currentSession) {
      const updatedSession: Session = {
        ...currentSession,
        generationHistory: [...(currentSession.generationHistory || []), entry],
        updatedAt: new Date().toISOString(),
      };

      setCurrentSession(updatedSession);

      // 세션 목록 업데이트
      const updatedSessions = sessions.map((s) =>
        s.id === updatedSession.id ? updatedSession : s
      );
      setSessions(updatedSessions);

      // 저장
      saveSessions(updatedSessions);
      console.log('✅ 세션 히스토리 업데이트 완료');
    }
  };

  const handleHistoryDelete = (entryId: string) => {
    console.log('🗑️ 히스토리 삭제:', entryId);

    // 현재 세션이 있으면 히스토리에서 삭제
    if (currentSession) {
      const updatedSession: Session = {
        ...currentSession,
        generationHistory: (currentSession.generationHistory || []).filter(
          (entry) => entry.id !== entryId
        ),
        updatedAt: new Date().toISOString(),
      };

      setCurrentSession(updatedSession);

      // 세션 목록 업데이트
      const updatedSessions = sessions.map((s) =>
        s.id === updatedSession.id ? updatedSession : s
      );
      setSessions(updatedSessions);

      // 저장
      saveSessions(updatedSessions);
      console.log('✅ 히스토리 삭제 완료');
    }
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

  const handleReorderSessions = async (reorderedSessions: Session[]) => {
    console.log('🔄 세션 순서 변경');
    setSessions(reorderedSessions);

    // Tauri Store에 저장
    try {
      await saveSessions(reorderedSessions);
      console.log('✅ 세션 순서 저장 완료');
    } catch (error) {
      console.error('❌ 세션 순서 저장 오류:', error);
    }
  };

  return (
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
                apiKey={apiKey}
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
                    // 카드 저장 버튼 클릭시 번역 + 세션 자동 저장
                    triggerManualSave(updated);
                  }
                }}
                onCharacterUpdate={(character) => {
                  if (analysisResult) {
                    const updated = { ...analysisResult, character };
                    setAnalysisResult(updated);
                    // 카드 저장 버튼 클릭시 번역 + 세션 자동 저장
                    triggerManualSave(updated);
                  }
                }}
                onCompositionUpdate={(composition) => {
                  if (analysisResult) {
                    const updated = { ...analysisResult, composition };
                    setAnalysisResult(updated);
                    // 카드 저장 버튼 클릭시 번역 + 세션 자동 저장
                    triggerManualSave(updated);
                  }
                }}
                onNegativePromptUpdate={(negativePrompt) => {
                  if (analysisResult) {
                    const updated = { ...analysisResult, negative_prompt: negativePrompt };
                    setAnalysisResult(updated);
                    // 카드 저장 버튼 클릭시 번역 + 세션 자동 저장
                    triggerManualSave(updated);
                  }
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

        {/* 진행 상태 표시 */}
        <ProgressIndicator {...progress} />
      </div>
  );
}

export default App;
