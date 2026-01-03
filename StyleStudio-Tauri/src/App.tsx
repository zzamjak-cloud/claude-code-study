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
  const [saveProgress, setSaveProgress] = useState({
    stage: 'idle' as 'idle' | 'translating' | 'saving' | 'complete',
    message: '',
    percentage: 0,
    estimatedSecondsLeft: 0,
  });

  const { analyzeImages } = useGeminiAnalyzer();
  const { translateBatchToKorean, translateBatchToEnglish, translateToEnglish, containsKorean } = useGeminiTranslator();
  const lastDropTimeRef = useRef(0);

  // 자동 저장 Hook
  const { progress } = useAutoSave({
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
      const updated = {
        ...analysisResult,
        user_custom_prompt: customPrompt,
      };
      setAnalysisResult(updated);
      // 자동 저장 제거 - 세션 저장 버튼 또는 이미지 생성 화면 이동 시에만 저장
    }
  };

  // 번역 없이 세션 저장 (프롬프트 수정 시 사용)
  const saveSessionWithoutTranslation = async (updatedAnalysis: ImageAnalysisResult) => {
    if (!currentSession || !apiKey) return;

    try {
      const updatedSession: Session = {
        ...currentSession,
        analysis: updatedAnalysis,
        updatedAt: new Date().toISOString(),
        // koreanAnalysis는 그대로 유지 (번역 없이)
      };

      const updatedSessions = sessions.map((s) =>
        s.id === currentSession.id ? updatedSession : s
      );
      setSessions(updatedSessions);
      setCurrentSession(updatedSession);
      await saveSessions(updatedSessions);
      console.log('✅ [프롬프트 수정] 세션 저장 완료 (번역 없이)');
    } catch (error) {
      console.error('❌ [프롬프트 수정] 세션 저장 오류:', error);
    }
  };

  // 한글 캐시 업데이트 (각 카드 수정 시 사용)
  const updateKoreanCache = (updates: Partial<KoreanAnalysisCache>) => {
    if (!currentSession) return;

    const updatedKoreanAnalysis: KoreanAnalysisCache = {
      ...(currentSession.koreanAnalysis || {}),
      ...updates,
    };

    const updatedSession: Session = {
      ...currentSession,
      koreanAnalysis: updatedKoreanAnalysis,
      updatedAt: new Date().toISOString(),
    };

    const updatedSessions = sessions.map((s) =>
      s.id === currentSession.id ? updatedSession : s
    );
    setSessions(updatedSessions);
    setCurrentSession(updatedSession);
    saveSessions(updatedSessions);
    console.log('✅ [한글 캐시] 업데이트 완료');
  };

  // 변경된 내용이 있는지 확인 (영어 원본과 캐시 비교)
  const hasChangesToTranslate = (): boolean => {
    if (!analysisResult || !currentSession?.koreanAnalysis) {
      return false;
    }

    // style, character, composition, negative_prompt 변경 확인
    const oldAnalysis = currentSession.analysis;
    
    // style 변경 확인
    const styleChanged = JSON.stringify(oldAnalysis.style) !== JSON.stringify(analysisResult.style);
    
    // character 변경 확인
    const characterChanged = JSON.stringify(oldAnalysis.character) !== JSON.stringify(analysisResult.character);
    
    // composition 변경 확인
    const compositionChanged = JSON.stringify(oldAnalysis.composition) !== JSON.stringify(analysisResult.composition);
    
    // negative_prompt 변경 확인
    const negativeChanged = oldAnalysis.negative_prompt !== analysisResult.negative_prompt;

    // user_custom_prompt는 변경 감지에서 제외 (세션 저장/이미지 생성 시에만 처리)

    return styleChanged || characterChanged || compositionChanged || negativeChanged;
  };

  // 변경된 내용 번역 및 캐싱 갱신
  const translateAndUpdateCache = async (onProgress?: (progress: { stage: string; message: string; percentage: number }) => void): Promise<void> => {
    if (!analysisResult || !apiKey || !currentSession) {
      throw new Error('분석 결과, API 키, 또는 세션이 없습니다');
    }

    console.log('🌐 [자동 번역] 변경된 내용 번역 시작...');

    try {
      // 변경된 섹션만 번역
      const oldAnalysis = currentSession.analysis;
      let updatedAnalysis = analysisResult; // 영어 원본 업데이트용
      const updatedKoreanCache: KoreanAnalysisCache = {
        ...(currentSession.koreanAnalysis || {}),
      };
      
      let hasAnyChanges = false;
      
      // 1단계: 모든 변경된 섹션의 한글 텍스트 수집
      const styleKoreanTexts: Array<{ text: string; field: string; index: number }> = [];
      const characterKoreanTexts: Array<{ text: string; field: string; index: number }> = [];
      const compositionKoreanTexts: Array<{ text: string; field: string; index: number }> = [];
      let negativeKoreanText: string | null = null;
      // user_custom_prompt는 translateAndUpdateCache에서 제외 (세션 저장/이미지 생성 시에만 처리)

      // style 변경 시 - 한글 텍스트만 수집
      if (JSON.stringify(oldAnalysis.style) !== JSON.stringify(analysisResult.style)) {
        hasAnyChanges = true;
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
        hasAnyChanges = true;
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
      if (JSON.stringify(oldAnalysis.composition) !== JSON.stringify(analysisResult.composition)) {
        hasAnyChanges = true;
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
        hasAnyChanges = true;
        if (containsKorean(analysisResult.negative_prompt)) {
          negativeKoreanText = analysisResult.negative_prompt;
        }
      }
      
      // user_custom_prompt는 translateAndUpdateCache에서 제외 (세션 저장/이미지 생성 시에만 처리)
      
      // 2단계: 모든 한글 텍스트를 하나로 모아서 배치 번역 (한글→영어만)
      const allKoreanTextsToTranslate: string[] = [];
      const translationMap: Array<{ section: 'style' | 'character' | 'composition' | 'negative' | 'custom'; field?: string; index?: number; originalIndex: number }> = [];
      
      styleKoreanTexts.forEach((item) => {
        allKoreanTextsToTranslate.push(item.text);
        translationMap.push({ section: 'style', field: item.field, index: item.index, originalIndex: allKoreanTextsToTranslate.length - 1 });
      });
      
      characterKoreanTexts.forEach((item) => {
        allKoreanTextsToTranslate.push(item.text);
        translationMap.push({ section: 'character', field: item.field, index: item.index, originalIndex: allKoreanTextsToTranslate.length - 1 });
      });
      
      compositionKoreanTexts.forEach((item) => {
        allKoreanTextsToTranslate.push(item.text);
        translationMap.push({ section: 'composition', field: item.field, index: item.index, originalIndex: allKoreanTextsToTranslate.length - 1 });
      });
      
      if (negativeKoreanText) {
        allKoreanTextsToTranslate.push(negativeKoreanText);
        translationMap.push({ section: 'negative', originalIndex: allKoreanTextsToTranslate.length - 1 });
      }
      
      // user_custom_prompt는 translateAndUpdateCache에서 제외 (세션 저장/이미지 생성 시에만 처리)
      
      // 3단계: 배치 번역 실행 (한글→영어만, 영어→한글 번역 제거)
      if (allKoreanTextsToTranslate.length > 0) {
        onProgress?.({ stage: 'translating', message: '변경된 내용 번역 중...', percentage: 10 });
        console.log(`   - 배치 번역 시작 (한→영: ${allKoreanTextsToTranslate.length}개 텍스트)`);
        
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
        
        // user_custom_prompt는 translateAndUpdateCache에서 제외 (세션 저장/이미지 생성 시에만 처리)
      } else {
        // 한글이 없는 경우 영어 그대로 사용
        if (oldAnalysis.negative_prompt !== analysisResult.negative_prompt) {
          updatedAnalysis = {
            ...updatedAnalysis,
            negative_prompt: analysisResult.negative_prompt,
          };
          updatedKoreanCache.negativePrompt = analysisResult.negative_prompt;
        }
        // user_custom_prompt는 translateAndUpdateCache에서 제외
      }

      // positivePrompt는 변경된 섹션이 있을 때만 재생성 (이미 영어로 생성되므로 한글 번역 불필요)
      // 사용자가 한글로 편집한 경우에만 캐시에 저장되므로, 여기서는 영어 원본만 사용
      if (hasAnyChanges) {
        // positivePrompt는 buildUnifiedPrompt로 생성되므로 별도 처리 불필요
        // 한글 캐시는 기존 캐시 유지 (사용자가 수정하지 않은 경우)
      }

      // 영어 원본 상태 업데이트
      setAnalysisResult(updatedAnalysis);

      // 세션 업데이트 (최신 updatedAnalysis 사용)
      const updatedSession: Session = {
        ...currentSession,
        analysis: updatedAnalysis,
        koreanAnalysis: updatedKoreanCache,
        updatedAt: new Date().toISOString(),
      };

      const updatedSessions = sessions.map((s) =>
        s.id === currentSession.id ? updatedSession : s
      );
      setSessions(updatedSessions);
      setCurrentSession(updatedSession);
      await saveSessions(updatedSessions);
      console.log('✅ [자동 번역] 번역 완료 및 캐싱 갱신');
    } catch (error) {
      console.error('❌ [자동 번역] 번역 오류:', error);
      throw error;
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
        onComplete: async (result) => {
          setAnalysisResult(result);
          setIsAnalyzing(false);
          console.log('✅ 분석 완료:', result);

          // 신규 세션 생성 후 이미지 분석 시 영어 -> 한글 번역 및 캐싱 후 세션 저장
          if (!isRefinementMode) {
            console.log('🌐 [신규 분석] 번역 시작...');
            try {
              // 전체 분석 결과 번역
              const koreanCache = await translateAnalysisResult(result);
              
              // user_custom_prompt 영어 번역 추가
              if (result.user_custom_prompt && containsKorean(result.user_custom_prompt)) {
                koreanCache.customPromptEnglish = await translateToEnglish(
                  apiKey,
                  result.user_custom_prompt
                );
              } else if (result.user_custom_prompt) {
                koreanCache.customPromptEnglish = result.user_custom_prompt;
              }

              // 자동으로 세션 생성 및 저장
              const newSession: Session = {
                id: Date.now().toString(),
                name: `세션 ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
                type: 'STYLE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                referenceImages: uploadedImages,
                analysis: result,
                koreanAnalysis: koreanCache,
                imageCount: uploadedImages.length,
              };

              const updatedSessions = [...sessions, newSession];
              setSessions(updatedSessions);
              setCurrentSession(newSession);
              await saveSessions(updatedSessions);
              console.log('✅ [신규 분석] 번역 완료 및 세션 저장');
            } catch (error) {
              console.error('❌ [신규 분석] 번역 오류:', error);
              // 번역 실패해도 분석 결과는 표시
            }
          } else {
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

    setSaveProgress({
      stage: 'idle',
      message: '',
      percentage: 0,
      estimatedSecondsLeft: 0,
    });

    try {
      // 변경된 내용이 있으면 번역 진행
      let koreanCache: KoreanAnalysisCache | undefined;

      if (currentSession) {
        // 기존 세션: 변경된 내용이 있으면 번역, 없으면 기존 캐시 사용
        if (hasChangesToTranslate()) {
          console.log('🔄 변경된 내용이 있습니다. 번역을 진행합니다...');
          setSaveProgress({
            stage: 'translating',
            message: '변경된 내용 번역 중...',
            percentage: 0,
            estimatedSecondsLeft: 0,
          });
          await translateAndUpdateCache((progress) => {
            setSaveProgress({
              stage: progress.stage as 'translating' | 'saving' | 'complete',
              message: progress.message,
              percentage: progress.percentage,
              estimatedSecondsLeft: 0,
            });
          });
          koreanCache = currentSession.koreanAnalysis;
        } else {
          console.log('♻️ 변경된 내용이 없습니다. 기존 캐시를 사용합니다.');
          koreanCache = currentSession.koreanAnalysis;
        }
        
        // user_custom_prompt 번역 처리 (세션 저장 시에만)
        if (koreanCache && analysisResult.user_custom_prompt) {
          setSaveProgress({
            stage: 'translating',
            message: '사용자 맞춤 프롬프트 번역 중...',
            percentage: 85,
            estimatedSecondsLeft: 0,
          });
          if (containsKorean(analysisResult.user_custom_prompt)) {
            koreanCache.customPromptEnglish = await translateToEnglish(
              apiKey,
              analysisResult.user_custom_prompt
            );
          } else {
            koreanCache.customPromptEnglish = analysisResult.user_custom_prompt;
          }
        }
      } else {
        // 새 세션: 전체 번역 실행
        console.log('🌐 [새 세션] 전체 번역 실행 중...');
        setSaveProgress({
          stage: 'translating',
          message: '전체 번역 중...',
          percentage: 0,
          estimatedSecondsLeft: 0,
        });
        koreanCache = await translateAnalysisResult(analysisResult);
        
        setSaveProgress({
          stage: 'translating',
          message: '사용자 맞춤 프롬프트 번역 중...',
          percentage: 90,
          estimatedSecondsLeft: 0,
        });
        
        // user_custom_prompt 영어 번역 추가
        if (analysisResult.user_custom_prompt && containsKorean(analysisResult.user_custom_prompt)) {
          koreanCache.customPromptEnglish = await translateToEnglish(
            apiKey,
            analysisResult.user_custom_prompt
          );
        } else if (analysisResult.user_custom_prompt) {
          koreanCache.customPromptEnglish = analysisResult.user_custom_prompt;
        }
      }

      setSaveProgress({
        stage: 'saving',
        message: '세션 저장 중...',
        percentage: 95,
        estimatedSecondsLeft: 0,
      });

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
          koreanAnalysis: koreanCache || currentSession.koreanAnalysis,
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
      await saveSessions(updatedSessions);
      
      setSaveProgress({
        stage: 'complete',
        message: '저장 완료!',
        percentage: 100,
        estimatedSecondsLeft: 0,
      });
      
      alert(
        `세션 "${sessionName}"이(가) ${currentSession ? '업데이트' : '저장'}되었습니다!\n참조 이미지: ${uploadedImages.length}개`
      );
      console.log('✅ 세션 저장 완료:', sessionToSave);

      // 세션을 현재 세션으로 설정
      setCurrentSession(sessionToSave);
      
      // 2초 후 완료 메시지 숨김
      setTimeout(() => {
        setSaveProgress({
          stage: 'idle',
          message: '',
          percentage: 0,
          estimatedSecondsLeft: 0,
        });
      }, 2000);
    } catch (error) {
      console.error('❌ 세션 저장 오류:', error);
      setSaveProgress({
        stage: 'idle',
        message: '',
        percentage: 0,
        estimatedSecondsLeft: 0,
      });
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

    if (!analysisResult) {
      alert('분석 결과가 없습니다');
      return;
    }

    try {
      let koreanCache: KoreanAnalysisCache | undefined;
      
      // 변경된 내용이 있으면 번역 진행
      if (currentSession && hasChangesToTranslate()) {
        console.log('🔄 변경된 내용이 있습니다. 번역을 진행합니다...');
        await translateAndUpdateCache();
        koreanCache = currentSession.koreanAnalysis;
      } else if (!currentSession) {
        // 세션이 없으면 전체 번역 후 세션 생성
        console.log('🌐 [새 세션] 전체 번역 실행 중...');
        koreanCache = await translateAnalysisResult(analysisResult);
      } else {
        koreanCache = currentSession.koreanAnalysis;
      }
      
      // user_custom_prompt 번역 처리 (이미지 생성 화면 이동 시에만)
      if (koreanCache && analysisResult.user_custom_prompt) {
        console.log('🌐 사용자 맞춤 프롬프트 번역 중...');
        if (containsKorean(analysisResult.user_custom_prompt)) {
          koreanCache.customPromptEnglish = await translateToEnglish(
            apiKey,
            analysisResult.user_custom_prompt
          );
        } else {
          koreanCache.customPromptEnglish = analysisResult.user_custom_prompt;
        }
      }

      // 세션 저장 또는 업데이트
      if (!currentSession) {
        // 새 세션 생성
        const newSession: Session = {
          id: Date.now().toString(),
          name: `세션 ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
          type: 'STYLE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          referenceImages: uploadedImages,
          analysis: analysisResult,
          koreanAnalysis: koreanCache,
          imageCount: uploadedImages.length,
        };

        const updatedSessions = [...sessions, newSession];
        setSessions(updatedSessions);
        setCurrentSession(newSession);
        await saveSessions(updatedSessions);
        console.log('✅ [이미지 생성] 번역 완료 및 세션 저장');
      } else if (currentSession) {
        // 기존 세션 업데이트 (user_custom_prompt 포함)
        console.log('🔄 기존 세션 업데이트 (user_custom_prompt 포함)');
        const updatedSession: Session = {
          ...currentSession,
          analysis: analysisResult,
          koreanAnalysis: koreanCache,
          updatedAt: new Date().toISOString(),
        };
        const updatedSessions = sessions.map((s) =>
          s.id === currentSession.id ? updatedSession : s
        );
        setSessions(updatedSessions);
        setCurrentSession(updatedSession);
        await saveSessions(updatedSessions);
      }

      setCurrentView('generator');
    } catch (error) {
      console.error('❌ [이미지 생성] 번역/저장 오류:', error);
      alert('번역 또는 저장 중 오류가 발생했습니다.');
    }
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
                    // 번역 없이 세션 저장 (통합 프롬프트에 즉시 반영)
                    saveSessionWithoutTranslation(updated);
                  }
                }}
                onCharacterUpdate={(character) => {
                  if (analysisResult) {
                    const updated = { ...analysisResult, character };
                    setAnalysisResult(updated);
                    // 번역 없이 세션 저장 (통합 프롬프트에 즉시 반영)
                    saveSessionWithoutTranslation(updated);
                  }
                }}
                onCompositionUpdate={(composition) => {
                  if (analysisResult) {
                    const updated = { ...analysisResult, composition };
                    setAnalysisResult(updated);
                    // 번역 없이 세션 저장 (통합 프롬프트에 즉시 반영)
                    saveSessionWithoutTranslation(updated);
                  }
                }}
                onNegativePromptUpdate={(negativePrompt) => {
                  if (analysisResult) {
                    const updated = { ...analysisResult, negative_prompt: negativePrompt };
                    setAnalysisResult(updated);
                    // 번역 없이 세션 저장 (통합 프롬프트에 즉시 반영)
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
        {/* 세션 저장 진행 상태 표시 */}
        {saveProgress.stage !== 'idle' && <ProgressIndicator {...saveProgress} />}
      </div>
  );
}

export default App;
