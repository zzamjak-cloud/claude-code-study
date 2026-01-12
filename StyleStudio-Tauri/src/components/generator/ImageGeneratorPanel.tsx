import { useState, useMemo, useEffect } from 'react';
import { Wand2, ArrowLeft, ChevronDown, HelpCircle, X, Folder, FolderOpen, ZoomIn } from 'lucide-react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { join, downloadDir } from '@tauri-apps/api/path';
import { ImageAnalysisResult } from '../../types/analysis';
import { SessionType, GenerationHistoryEntry, KoreanAnalysisCache } from '../../types/session';
import { PixelArtGridLayout } from '../../types/pixelart';
import { ReferenceDocument } from '../../types/referenceDocument';
import { buildUnifiedPrompt } from '../../lib/promptBuilder';
import { useGeminiImageGenerator } from '../../hooks/api/useGeminiImageGenerator';
import { useTranslation } from '../../hooks/useTranslation';
import { logger } from '../../lib/logger';
import { GeneratorSettings } from './GeneratorSettings';
import { GeneratorPreview } from './GeneratorPreview';
import { GeneratorHistory } from './GeneratorHistory';
import {
  IMAGE_GENERATION_DEFAULTS,
  ADVANCED_SETTINGS_DEFAULTS,
  HISTORY_PANEL,
} from '../../types/constants';

interface ImageGeneratorPanelProps {
  apiKey: string;
  analysis: ImageAnalysisResult;
  referenceImages: string[];
  sessionType: SessionType;
  koreanAnalysis?: KoreanAnalysisCache; // 한글 캐시 (사용자 맞춤 프롬프트 번역 포함)
  generationHistory?: GenerationHistoryEntry[];
  onHistoryAdd?: (entry: GenerationHistoryEntry) => void;
  onHistoryUpdate?: (entryId: string, updates: Partial<GenerationHistoryEntry>) => void;
  onHistoryDelete?: (entryId: string) => void;
  onBack?: () => void;
  autoSavePath?: string; // 자동 저장 폴더 경로
  onAutoSavePathChange?: (path: string) => void; // 폴더 경로 변경 콜백
  referenceDocuments?: ReferenceDocument[]; // 참조 문서 (UI 세션 전용)
  onDocumentAdd?: (document: ReferenceDocument) => void;
  onDocumentDelete?: (documentId: string) => void;
}

// 통합 상태 타입 정의
interface GeneratorState {
  additionalPrompt: string;
  isTranslating: boolean;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  imageSize: '1K' | '2K' | '4K';
  useReferenceImages: boolean;
  isGenerating: boolean;
  progressMessage: string;
  generatedImage: string | null;
  pixelArtGrid: PixelArtGridLayout;
  zoomLevel: 'fit' | 'actual' | number;
  showZoomMenu: boolean;
  showPathTooltip: boolean;
  showAdvanced: boolean;
  showHelp: boolean;
  seed: number | undefined;
  temperature: number;
  topK: number;
  topP: number;
  referenceStrength: number;
  historyHeight: number;
}

export function ImageGeneratorPanel({
  apiKey,
  analysis,
  referenceImages,
  sessionType,
  koreanAnalysis,
  generationHistory = [],
  onHistoryAdd,
  onHistoryUpdate,
  onHistoryDelete,
  onBack,
  autoSavePath,
  onAutoSavePathChange,
  referenceDocuments = [],
  onDocumentAdd,
  onDocumentDelete,
}: ImageGeneratorPanelProps) {
  const { positivePrompt, negativePrompt } = useMemo(
    () => buildUnifiedPrompt(analysis),
    [analysis]
  );
  const { generateImage } = useGeminiImageGenerator();
  const { translateCustomPrompt, containsKorean } = useTranslation();

  // 통합 상태 관리
  const [state, setState] = useState<GeneratorState>({
    additionalPrompt: '',
    isTranslating: false,
    aspectRatio: IMAGE_GENERATION_DEFAULTS.ASPECT_RATIO,
    imageSize: IMAGE_GENERATION_DEFAULTS.IMAGE_SIZE,
    useReferenceImages: IMAGE_GENERATION_DEFAULTS.USE_REFERENCE_IMAGES,
    isGenerating: false,
    progressMessage: '',
    generatedImage: null,
    pixelArtGrid: IMAGE_GENERATION_DEFAULTS.PIXEL_ART_GRID,
    zoomLevel: 'fit',
    showZoomMenu: false,
    showPathTooltip: false,
    showAdvanced: false,
    showHelp: false,
    seed: undefined,
    temperature: ADVANCED_SETTINGS_DEFAULTS.TEMPERATURE,
    topK: ADVANCED_SETTINGS_DEFAULTS.TOP_K,
    topP: ADVANCED_SETTINGS_DEFAULTS.TOP_P,
    referenceStrength: ADVANCED_SETTINGS_DEFAULTS.REFERENCE_STRENGTH,
    historyHeight: HISTORY_PANEL.DEFAULT_HEIGHT,
  });

  // 상태 업데이트 헬퍼 함수
  const updateState = (updates: Partial<GeneratorState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // 상태에서 자주 사용되는 값들을 destructure
  const {
    additionalPrompt,
    isTranslating,
    aspectRatio,
    imageSize,
    useReferenceImages,
    isGenerating,
    progressMessage,
    generatedImage,
    pixelArtGrid,
    zoomLevel,
    showZoomMenu,
    showPathTooltip,
    showAdvanced,
    showHelp,
    seed,
    temperature,
    topK,
    topP,
    referenceStrength,
    historyHeight,
  } = state;

  // 기존 코드 호환성을 위한 개별 setter 함수들
  const setAdditionalPrompt = (value: string) => updateState({ additionalPrompt: value });
  const setIsTranslating = (value: boolean) => updateState({ isTranslating: value });
  const setAspectRatio = (value: '1:1' | '16:9' | '9:16' | '4:3' | '3:4') => updateState({ aspectRatio: value });
  const setImageSize = (value: '1K' | '2K' | '4K') => updateState({ imageSize: value });
  const setUseReferenceImages = (value: boolean) => updateState({ useReferenceImages: value });
  const setIsGenerating = (value: boolean) => updateState({ isGenerating: value });
  const setProgressMessage = (value: string) => updateState({ progressMessage: value });
  const setGeneratedImage = (value: string | null) => updateState({ generatedImage: value });
  const setPixelArtGrid = (value: PixelArtGridLayout) => updateState({ pixelArtGrid: value });
  const setZoomLevel = (value: 'fit' | 'actual' | number) => updateState({ zoomLevel: value });
  const setShowZoomMenu = (value: boolean) => updateState({ showZoomMenu: value });
  const setShowPathTooltip = (value: boolean) => updateState({ showPathTooltip: value });
  const setShowAdvanced = (value: boolean) => updateState({ showAdvanced: value });
  const setShowHelp = (value: boolean) => updateState({ showHelp: value });
  const setSeed = (value: number | undefined) => updateState({ seed: value });
  const setTemperature = (value: number) => updateState({ temperature: value });
  const setTopK = (value: number) => updateState({ topK: value });
  const setTopP = (value: number) => updateState({ topP: value });
  const setReferenceStrength = (value: number) => updateState({ referenceStrength: value });

  // 줌 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (showZoomMenu) {
      const handleClickOutside = () => updateState({ showZoomMenu: false });
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showZoomMenu]);

  const handleHistoryResize = (delta: number) => {
    const newHeight = historyHeight - delta; // delta는 아래로 드래그하면 양수, 위로 드래그하면 음수
    // 최소 120px, 최대 600px
    updateState({ historyHeight: Math.max(120, Math.min(600, newHeight)) });
  };


  const handleGenerate = async () => {
    if (!apiKey) {
      alert('API 키를 먼저 설정해주세요. Style Studio 헤더의 설정 아이콘을 클릭하여 API 키를 입력하세요.');
      return;
    }

    setIsGenerating(true);
    setProgressMessage('이미지 생성 준비 중...');
    setGeneratedImage(null);

    try {
      // 1단계: 한국어 프롬프트를 영어로 번역
      setIsTranslating(true);
      setProgressMessage('프롬프트를 영어로 변환 중...');

      // 사용자 맞춤 프롬프트: 캐시에서 가져오기 (이미 세션 저장 시 번역됨)
      let translatedUserCustomPrompt = '';
      if (analysis.user_custom_prompt) {
        // 캐시에 번역된 영어가 있으면 사용
        if (koreanAnalysis?.customPromptEnglish) {
          logger.debug('♻️ 사용자 맞춤 프롬프트 캐시 사용');
          translatedUserCustomPrompt = koreanAnalysis.customPromptEnglish;
        } else if (containsKorean(analysis.user_custom_prompt)) {
          // 캐시가 없고 한글이면 번역 (예외 상황)
          logger.debug('🌐 사용자 맞춤 프롬프트 번역 중... (캐시 없음)');
          translatedUserCustomPrompt = await translateCustomPrompt(apiKey, analysis.user_custom_prompt);
        } else {
          // 이미 영어인 경우
          logger.debug('♻️ 사용자 맞춤 프롬프트는 이미 영어입니다');
          translatedUserCustomPrompt = analysis.user_custom_prompt;
        }
      }

      // 추가 프롬프트: 항상 번역 (매번 새로 입력되는 값)
      let translatedAdditionalPrompt = '';
      if (additionalPrompt.trim()) {
        // 한글이 포함되어 있으면 번역, 영어면 그대로 사용
        if (containsKorean(additionalPrompt.trim())) {
          logger.debug('🌐 추가 프롬프트 번역 중...');
          translatedAdditionalPrompt = await translateCustomPrompt(apiKey, additionalPrompt.trim());
        } else {
          logger.debug('♻️ 추가 프롬프트는 이미 영어입니다');
          translatedAdditionalPrompt = additionalPrompt.trim();
        }
      }

      setIsTranslating(false);
      logger.debug('✅ 번역 완료');
      logger.debug('   - 사용자 맞춤 프롬프트:', translatedUserCustomPrompt);
      logger.debug('   - 추가 프롬프트:', translatedAdditionalPrompt);

      // 2단계: 최종 프롬프트 구성 (영어 사용)
      let finalPrompt = '';

      if (sessionType === 'CHARACTER') {
        // 캐릭터 세션: 참조 이미지가 캐릭터 외형을 완벽히 유지하므로
        // 포즈/표정/동작만 프롬프트로 전달
        const parts = [translatedUserCustomPrompt, translatedAdditionalPrompt].filter(Boolean);
        finalPrompt = parts.length > 0 ? parts.join(', ') : 'standing naturally, neutral expression';
      } else {
        // 스타일 세션: 참조 이미지가 있으면 스타일만 유지하고
        // 구체적인 내용은 사용자 프롬프트 사용
        if (useReferenceImages && referenceImages.length > 0) {
          // 참조 이미지로 스타일 유지, 사용자 프롬프트만 사용
          const parts = [translatedUserCustomPrompt, translatedAdditionalPrompt].filter(Boolean);
          finalPrompt = parts.length > 0 ? parts.join(', ') : positivePrompt;
        } else {
          // 참조 이미지 없으면 AI 분석 프롬프트도 포함
          const parts = [translatedUserCustomPrompt, translatedAdditionalPrompt, positivePrompt].filter(Boolean);
          finalPrompt = parts.join(', ');
        }
      }

      logger.debug('🎨 최종 프롬프트 (영어):', finalPrompt);

      // 3단계: 이미지 생성
      await generateImage(
        apiKey,
        {
          prompt: finalPrompt,
          negativePrompt: negativePrompt,
          referenceImages:
            sessionType === 'CHARACTER' || useReferenceImages ? referenceImages : undefined,
          aspectRatio: aspectRatio,
          imageSize: imageSize,
          sessionType: sessionType,
          // 고급 설정
          seed: seed,
          temperature: temperature,
          topK: topK,
          topP: topP,
          referenceStrength: referenceStrength,
          // 픽셀아트 전용 설정
          analysis: analysis, // 이미지 분석 결과 (픽셀아트 해상도 추출용)
          pixelArtGrid: pixelArtGrid, // 픽셀아트 그리드 레이아웃
          // UI 세션 전용 설정
          referenceDocuments: referenceDocuments, // 참조 문서 (UI 세션에서 기획 내용 반영)
        },
        {
          onProgress: (message) => {
            setProgressMessage(message);
            logger.debug('📊 진행:', message);
          },
          onComplete: async (imageBase64) => {
            const dataUrl = `data:image/png;base64,${imageBase64}`;
            setGeneratedImage(dataUrl);
            setZoomLevel('fit'); // 이미지 생성 시 줌을 '화면에 맞춤'으로 리셋
            setIsGenerating(false);
            setIsTranslating(false);
            setProgressMessage('');
            logger.debug('✅ 생성 완료');

            // 자동 저장
            try {
              const savedPath = await autoSaveImage(dataUrl);
              logger.debug('💾 자동 저장 완료:', savedPath);
            } catch (error) {
              logger.error('❌ 자동 저장 실패:', error);
              // 자동 저장 실패해도 이미지 표시는 계속
            }

            // 히스토리에 추가
            if (onHistoryAdd) {
              const historyEntry: GenerationHistoryEntry = {
                id: `gen-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                timestamp: new Date().toISOString(),
                prompt: finalPrompt,
                negativePrompt: negativePrompt,
                additionalPrompt: additionalPrompt.trim() || undefined, // 추가 포즈/동작 프롬프트 (원본)
                imageBase64: dataUrl,
                settings: {
                  aspectRatio: aspectRatio,
                  imageSize: imageSize,
                  seed: seed,
                  temperature: temperature,
                  topK: topK,
                  topP: topP,
                  referenceStrength: referenceStrength,
                  useReferenceImages: sessionType === 'CHARACTER' || useReferenceImages,
                  pixelArtGrid: pixelArtGrid, // 스프라이트 그리드 레이아웃
                },
                referenceDocumentIds: referenceDocuments?.map(doc => doc.id), // 참조 문서 ID 목록
              };
              onHistoryAdd(historyEntry);
              logger.debug('📜 히스토리에 추가됨:', historyEntry.id);
            }
          },
          onError: (error) => {
            setIsGenerating(false);
            setIsTranslating(false);
            setProgressMessage('');
            logger.error('❌ 생성 오류:', error);
            alert('이미지 생성 실패: ' + error.message);
          },
        }
      );
    } catch (error) {
      setIsGenerating(false);
      setIsTranslating(false);
      setProgressMessage('');
      logger.error('❌ 프롬프트 변환 또는 생성 오류:', error);
      alert('오류 발생: ' + (error as Error).message);
    }
  };

  // 폴더 선택 함수
  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '이미지 저장 폴더 선택',
      });

      if (selected && typeof selected === 'string') {
        logger.debug('📁 폴더 선택됨:', selected);
        if (onAutoSavePathChange) {
          onAutoSavePathChange(selected);
        }
      }
    } catch (error) {
      logger.error('❌ 폴더 선택 오류:', error);
      alert('폴더 선택에 실패했습니다: ' + (error as Error).message);
    }
  };

  // 자동 저장 함수 (Gemini API가 JPEG로 반환하므로 .jpg로 저장)
  const autoSaveImage = async (imageDataUrl: string) => {
    try {
      // 저장 경로 결정
      let savePath = autoSavePath;

      // 경로가 없거나 폴더가 존재하지 않으면 기본 경로 사용
      if (!savePath || !(await exists(savePath))) {
        const downloadPath = await downloadDir();
        savePath = await join(downloadPath, 'AI_Gen');

        // 기본 폴더가 없으면 생성
        if (!(await exists(savePath))) {
          await mkdir(savePath, { recursive: true });
          logger.debug('📁 기본 폴더 생성됨:', savePath);
        }

        // 기본 경로로 변경 알림
        if (onAutoSavePathChange) {
          onAutoSavePathChange(savePath);
        }
      }

      // 파일명 생성 (.jpg 확장자 사용 - Gemini가 JPEG 반환)
      const timestamp = Date.now();
      const fileName = `style-studio-${timestamp}.jpg`;
      const fullPath = await join(savePath, fileName);

      // Base64를 Uint8Array로 변환 (원본 그대로 저장)
      const base64Data = imageDataUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 파일 저장
      await writeFile(fullPath, bytes);
      logger.debug('✅ 이미지 자동 저장 완료:', fullPath);

      return fullPath;
    } catch (error) {
      logger.error('❌ 자동 저장 오류:', error);
      throw error;
    }
  };

  // 수동 저장 함수 (사용자가 다운로드 버튼 클릭 시)
  const handleManualSave = async () => {
    if (!generatedImage) {
      return;
    }

    // Base64 data URL 형식 검증
    if (!generatedImage.startsWith('data:')) {
      logger.error('❌ 유효하지 않은 이미지 형식:', generatedImage.substring(0, 50));
      alert('이미지 다운로드에 실패했습니다.\n\n이미지 데이터가 손상되었습니다. 세션을 다시 import하거나 이미지를 새로 생성해주세요.');
      return;
    }

    try {
      // 기본 저장 경로 결정
      let defaultPath = autoSavePath;

      // 경로가 없거나 폴더가 존재하지 않으면 기본 경로 사용
      if (!defaultPath || !(await exists(defaultPath))) {
        const downloadPath = await downloadDir();
        defaultPath = await join(downloadPath, 'AI_Gen');

        // 기본 폴더가 없으면 생성
        if (!(await exists(defaultPath))) {
          await mkdir(defaultPath, { recursive: true });
          logger.debug('📁 기본 폴더 생성됨:', defaultPath);
        }
      }

      // 기본 파일명 생성
      const timestamp = Date.now();
      const defaultFileName = `style-studio-${timestamp}.jpg`;
      const defaultFilePath = await join(defaultPath, defaultFileName);

      // Tauri의 save 다이얼로그 사용 (OS 네이티브, 덮어쓰기 자동 확인)
      const selectedPath = await save({
        defaultPath: defaultFilePath,
        filters: [
          {
            name: 'JPEG Image',
            extensions: ['jpg', 'jpeg'],
          },
        ],
        title: '이미지 저장',
      });

      // 사용자가 취소한 경우
      if (!selectedPath) {
        logger.debug('💾 사용자가 저장 취소');
        return;
      }

      logger.debug('💾 수동 저장 경로:', selectedPath);

      // Base64를 Uint8Array로 변환
      const base64Data = generatedImage.split(',')[1];
      if (!base64Data) {
        throw new Error('Base64 데이터를 추출할 수 없습니다');
      }

      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 파일 저장
      await writeFile(selectedPath, bytes);
      logger.debug('✅ 이미지 수동 저장 완료:', selectedPath);

      alert(`이미지가 저장되었습니다.\n\n${selectedPath}`);
    } catch (error) {
      logger.error('❌ 수동 저장 오류:', error);
      alert('이미지 저장에 실패했습니다: ' + (error as Error).message);
    }
  };

  // 히스토리에서 설정 복원
  const handleRestoreFromHistory = (e: React.MouseEvent, entry: GenerationHistoryEntry) => {
    e.stopPropagation();
    logger.debug('🔄 히스토리에서 설정 복원:', entry.id);

    // 이미지 설정 복원
    setAspectRatio(entry.settings.aspectRatio);
    setImageSize(entry.settings.imageSize);
    setUseReferenceImages(entry.settings.useReferenceImages);

    // 고급 설정 복원
    setSeed(entry.settings.seed);
    setTemperature(entry.settings.temperature ?? 1.0);
    setTopK(entry.settings.topK ?? 40);
    setTopP(entry.settings.topP ?? 0.95);
    setReferenceStrength(entry.settings.referenceStrength ?? 1.0);

    // 스프라이트 그리드 레이아웃 복원
    if (entry.settings.pixelArtGrid) {
      setPixelArtGrid(entry.settings.pixelArtGrid);
    }

    // 추가 포즈/동작 프롬프트 복원
    if (entry.additionalPrompt) {
      setAdditionalPrompt(entry.additionalPrompt);
    }

    // 생성된 이미지 표시
    setGeneratedImage(entry.imageBase64);

    alert('설정이 복원되었습니다. 프롬프트를 수정한 후 "이미지 생성"을 클릭하세요.');
  };

  // 히스토리 삭제 요청

  // 히스토리 핀 토글
  const handleTogglePin = (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    if (!onHistoryUpdate) return;

    const entry = generationHistory.find((h) => h.id === entryId);
    if (!entry) return;

    // isPinned 상태를 토글
    onHistoryUpdate(entryId, { isPinned: !entry.isPinned });
    logger.debug(`📌 히스토리 핀 토글: ${entryId}, 새 상태: ${!entry.isPinned}`);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="분석 화면으로 돌아가기"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
            )}
            <div className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg">
              <Wand2 size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">이미지 생성</h2>
              <p className="text-sm text-gray-500">
                {sessionType === 'CHARACTER'
                  ? '캐릭터 세션'
                  : sessionType === 'BACKGROUND'
                  ? '배경 세션'
                  : sessionType === 'ICON'
                  ? '아이콘 세션'
                  : sessionType === 'PIXELART_CHARACTER'
                  ? '픽셀 캐릭터 세션'
                  : sessionType === 'PIXELART_BACKGROUND'
                  ? '픽셀 배경 세션'
                  : sessionType === 'PIXELART_ICON'
                  ? '픽셀 아이콘 세션'
                  : sessionType === 'UI'
                  ? 'UI 디자인 세션'
                  : sessionType === 'LOGO'
                  ? '로고 세션'
                  : '스타일 세션'}{' '}
                · Gemini 3 Pro
              </p>
            </div>
          </div>
          {/* 자동 저장 폴더 정보 및 설정 버튼 */}
          <div className="flex items-center gap-3">
            {/* 폴더 경로 표시 (항상 표시) + 커스텀 툴팁 */}
            <div className="relative">
              <div
                className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg cursor-help hover:bg-green-100 transition-colors"
                onMouseEnter={() => setShowPathTooltip(true)}
                onMouseLeave={() => setShowPathTooltip(false)}
              >
                <FolderOpen size={16} className="text-green-600" />
                <span className="text-sm text-green-700 font-medium max-w-xs truncate">
                  {autoSavePath ? autoSavePath.split(/[/\\]/).filter(Boolean).pop() : 'AI_Gen'}
                </span>
              </div>

              {/* 커스텀 툴팁 (왼쪽으로 표시) */}
              {showPathTooltip && (
                <div className="absolute top-full right-0 mt-2 z-50 pointer-events-none">
                  <div className="bg-gray-900 text-white text-xs rounded-lg shadow-xl px-3 py-2 whitespace-nowrap">
                    <div className="font-semibold mb-1">저장 위치:</div>
                    <div className="text-gray-300">
                      {autoSavePath || '~/Downloads/AI_Gen (기본)'}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* 폴더 선택 버튼 */}
            <button
              onClick={handleSelectFolder}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all shadow-lg"
              title="자동 저장 폴더 선택"
            >
              <Folder size={20} />
              <span>저장 폴더</span>
            </button>

            {/* 줌 컨트롤 */}
            {generatedImage && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowZoomMenu(!showZoomMenu);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <ZoomIn size={18} />
                  <span className="text-sm font-medium">
                    {zoomLevel === 'fit' ? '화면에 맞춤' : zoomLevel === 'actual' ? '원본 크기' : `${zoomLevel}%`}
                  </span>
                  <ChevronDown size={16} />
                </button>

                {/* 줌 드롭다운 메뉴 */}
                {showZoomMenu && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-2 min-w-[180px]"
                  >
                    <button
                      onClick={() => {
                        setZoomLevel('fit');
                        setShowZoomMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                        zoomLevel === 'fit' ? 'bg-purple-50 text-purple-700 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      화면에 맞춤
                    </button>
                    <button
                      onClick={() => {
                        setZoomLevel('actual');
                        setShowZoomMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                        zoomLevel === 'actual' ? 'bg-purple-50 text-purple-700 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      원본 크기 (100%)
                    </button>
                    <div className="border-t border-gray-200 my-2"></div>
                    {[25, 50, 75, 100, 150, 200, 300].map((level) => (
                      <button
                        key={level}
                        onClick={() => {
                          setZoomLevel(level);
                          setShowZoomMenu(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                          zoomLevel === level ? 'bg-purple-50 text-purple-700 font-semibold' : 'text-gray-700'
                        }`}
                      >
                        {level}%
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽: 설정 패널 */}
        <GeneratorSettings
          apiKey={apiKey}
          sessionType={sessionType}
          analysis={analysis}
          additionalPrompt={additionalPrompt}
          isGenerating={isGenerating}
          isTranslating={isTranslating}
          progressMessage={progressMessage}
          aspectRatio={aspectRatio}
          imageSize={imageSize}
          useReferenceImages={useReferenceImages}
          pixelArtGrid={pixelArtGrid}
          showAdvanced={showAdvanced}
          showHelp={showHelp}
          seed={seed}
          temperature={temperature}
          topK={topK}
          topP={topP}
          referenceDocuments={referenceDocuments}
          onGenerate={handleGenerate}
          onAdditionalPromptChange={setAdditionalPrompt}
          onAspectRatioChange={setAspectRatio}
          onImageSizeChange={setImageSize}
          onUseReferenceImagesChange={setUseReferenceImages}
          onPixelArtGridChange={setPixelArtGrid}
          onShowAdvancedChange={setShowAdvanced}
          onShowHelpChange={setShowHelp}
          onSeedChange={setSeed}
          onTemperatureChange={setTemperature}
          onTopKChange={setTopK}
          onTopPChange={setTopP}
          onDocumentAdd={onDocumentAdd}
          onDocumentDelete={onDocumentDelete}
          containsKorean={containsKorean}
        />


      {/* 오른쪽: 결과 표시 및 히스토리 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 결과 표시 영역 */}
          <GeneratorPreview
            isGenerating={isGenerating}
            progressMessage={progressMessage}
            generatedImage={generatedImage}
            zoomLevel={zoomLevel}
            onManualSave={handleManualSave}
          />

          {/* 히스토리 섹션 */}
          <GeneratorHistory
            generationHistory={generationHistory}
            historyHeight={historyHeight}
            onHistoryResize={handleHistoryResize}
            onRestoreFromHistory={handleRestoreFromHistory}
            onTogglePin={handleTogglePin}
            onDeleteHistory={onHistoryDelete}
          />

        </div>
      </div>


      {/* 도움말 팝업 */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            {/* 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle size={24} className="text-purple-600" />
                <h3 className="text-lg font-semibold">고급 설정 도움말</h3>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* 내용 */}
            <div className="p-6 space-y-6">
              {/* Seed */}
              <div>
                <h4 className="text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm">Seed</span>
                  <span>재현성 제어</span>
                </h4>
                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                  동일한 Seed 값을 사용하면 같은 설정에서 동일한 결과를 재현할 수 있습니다.
                </p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• <strong>값 지정:</strong> 특정 결과를 재현하고 싶을 때 사용</li>
                  <li>• <strong>비워두기:</strong> 매번 다른 랜덤 결과 생성</li>
                  <li>• <strong>팁:</strong> 좋은 결과가 나온 Seed 값을 저장해두면 유용합니다</li>
                </ul>
              </div>

              {/* Temperature */}
              <div>
                <h4 className="text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">Temperature</span>
                  <span>창의성 vs 일관성</span>
                </h4>
                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                  이미지 생성 시 AI의 창의성 정도를 조절합니다.
                </p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• <strong>낮은 값 (0.0~0.8):</strong> 일관적이고 예측 가능한 결과, 참조 이미지에 가까움</li>
                  <li>• <strong>중간 값 (0.8~1.2):</strong> 균형잡힌 창의성과 일관성</li>
                  <li>• <strong>높은 값 (1.2~2.0):</strong> 창의적이고 다양한 결과, 예측 불가능</li>
                  <li>• <strong>권장:</strong> 캐릭터 유지는 0.8, 새로운 디자인은 1.2</li>
                </ul>
              </div>

              {/* Top-K */}
              <div>
                <h4 className="text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">Top-K</span>
                  <span>샘플링 범위</span>
                </h4>
                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                  AI가 선택할 수 있는 상위 토큰의 개수를 제한합니다.
                </p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• <strong>낮은 값 (1~30):</strong> 가장 확실한 선택만, 보수적이고 안전한 결과</li>
                  <li>• <strong>중간 값 (30~60):</strong> 적절한 다양성 유지</li>
                  <li>• <strong>높은 값 (60~100):</strong> 더 많은 선택지, 다양하고 실험적인 결과</li>
                  <li>• <strong>권장:</strong> 일반적으로 40이 적절, 다양성 원하면 60</li>
                </ul>
              </div>

              {/* Top-P */}
              <div>
                <h4 className="text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm">Top-P</span>
                  <span>누적 확률 임계값</span>
                </h4>
                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                  누적 확률이 이 값에 도달할 때까지의 토큰만 고려합니다 (Nucleus Sampling).
                </p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• <strong>낮은 값 (0.5~0.8):</strong> 가장 확실한 선택만, 일관된 결과</li>
                  <li>• <strong>중간 값 (0.8~0.95):</strong> 균형잡힌 다양성</li>
                  <li>• <strong>높은 값 (0.95~1.0):</strong> 거의 모든 선택지 고려, 매우 다양한 결과</li>
                  <li>• <strong>권장:</strong> 0.95가 적절, Top-K와 함께 사용하면 효과적</li>
                </ul>
              </div>

              {/* Reference Strength */}
              <div>
                <h4 className="text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded text-sm">Reference Strength</span>
                  <span>참조 영향력</span>
                </h4>
                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                  참조 이미지가 생성 결과에 미치는 영향력을 조절합니다.
                </p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• <strong>낮은 값 (0.0~0.5):</strong> 영감만 받음, 자유로운 해석</li>
                  <li>• <strong>중간 값 (0.5~0.8):</strong> 스타일이나 구도만 유지</li>
                  <li>• <strong>높은 값 (0.8~1.0):</strong> 참조 이미지와 매우 유사하게</li>
                  <li>• <strong>권장:</strong> 캐릭터 유지는 0.95, 스타일만 0.6, 변형은 0.85</li>
                </ul>
              </div>

              {/* 프리셋 설명 */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                <h4 className="text-base font-semibold text-gray-800 mb-3">💡 프리셋 활용 팁</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>🎭 포즈/표정/동작 베리에이션:</strong> Reference Strength 0.95, Temperature 0.8 → 캐릭터 외형은 그대로 유지하면서 포즈만 변경</p>
                  <p><strong>👥 다양한 캐릭터 디자인:</strong> Reference Strength 0.6, Temperature 1.2 → 스타일은 유지하되 완전히 새로운 캐릭터 생성</p>
                  <p><strong>👗 헤어/의상/악세사리 변경:</strong> Reference Strength 0.85, Temperature 1.0 → 캐릭터의 기본 외형은 유지하면서 스타일 요소만 변경</p>
                </div>
              </div>

              {/* Negative Prompt 안내 */}
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <h4 className="text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  ⚠️ Negative Prompt 설정
                </h4>
                <p className="text-sm text-gray-700">
                  Negative Prompt는 이미지 분석 패널의 "부정 프롬프트 카드"에서만 수정할 수 있습니다.
                  이는 일관된 품질을 유지하기 위해 고정된 값을 사용하도록 설계되었습니다.
                </p>
              </div>
            </div>

            {/* 푸터 */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
              <button
                onClick={() => setShowHelp(false)}
                className="w-full px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
