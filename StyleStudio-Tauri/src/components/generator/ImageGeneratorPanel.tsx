import { useState, useMemo } from 'react';
import { Wand2, Download, Image as ImageIcon, ArrowLeft, ChevronDown, ChevronUp, Dices, History, Languages, RotateCcw, Trash2, HelpCircle, X, Pin } from 'lucide-react';
import { ImageAnalysisResult } from '../../types/analysis';
import { SessionType, GenerationHistoryEntry, KoreanAnalysisCache } from '../../types/session';
import { buildUnifiedPrompt } from '../../lib/promptBuilder';
import { useGeminiImageGenerator } from '../../hooks/api/useGeminiImageGenerator';
import { useTranslation } from '../../hooks/useTranslation';
import { Resizer } from '../common/Resizer';
import { logger } from '../../lib/logger';

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
}: ImageGeneratorPanelProps) {
  const { positivePrompt, negativePrompt } = useMemo(
    () => buildUnifiedPrompt(analysis),
    [analysis]
  );
  const { generateImage } = useGeminiImageGenerator();
  const { translateCustomPrompt, containsKorean } = useTranslation();

  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [useReferenceImages, setUseReferenceImages] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  // 고급 설정
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [temperature, setTemperature] = useState<number>(1.0);
  const [topK, setTopK] = useState<number>(40);
  const [topP, setTopP] = useState<number>(0.95);
  const [referenceStrength, setReferenceStrength] = useState<number>(1.0);

  // 히스토리 영역 높이 (픽셀 단위)
  const [historyHeight, setHistoryHeight] = useState<number>(192); // 기본값: max-h-48 (192px)

  const handleHistoryResize = (delta: number) => {
    setHistoryHeight((prev) => {
      const newHeight = prev - delta; // delta는 아래로 드래그하면 양수, 위로 드래그하면 음수
      // 최소 120px, 최대 600px
      return Math.max(120, Math.min(600, newHeight));
    });
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
        },
        {
          onProgress: (message) => {
            setProgressMessage(message);
            logger.debug('📊 진행:', message);
          },
          onComplete: (imageBase64) => {
            const dataUrl = `data:image/png;base64,${imageBase64}`;
            setGeneratedImage(dataUrl);
            setIsGenerating(false);
            setIsTranslating(false);
            setProgressMessage('');
            logger.debug('✅ 생성 완료');

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
                },
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

  const handleDownload = () => {
    if (!generatedImage) return;

    try {
      // base64 데이터 URL을 Blob으로 변환
      const byteString = atob(generatedImage.split(',')[1]);
      const mimeString = generatedImage.split(',')[0].split(':')[1].split(';')[0];

      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }

      const blob = new Blob([ab], { type: mimeString });
      const blobUrl = URL.createObjectURL(blob);

      // 다운로드 링크 생성 및 클릭
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `style-studio-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Blob URL 해제
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

      logger.debug('✅ 이미지 다운로드 완료');
    } catch (error) {
      logger.error('❌ 다운로드 오류:', error);
      alert('이미지 다운로드에 실패했습니다: ' + (error as Error).message);
    }
  };

  // 삭제 확인 상태
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

    // 추가 포즈/동작 프롬프트 복원
    if (entry.additionalPrompt) {
      setAdditionalPrompt(entry.additionalPrompt);
    }

    // 생성된 이미지 표시
    setGeneratedImage(entry.imageBase64);

    alert('설정이 복원되었습니다. 프롬프트를 수정한 후 "이미지 생성"을 클릭하세요.');
  };

  // 히스토리 삭제 요청
  const handleDeleteHistory = (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    setDeleteConfirm(entryId);
  };

  // 삭제 확인
  const confirmDelete = () => {
    if (deleteConfirm && onHistoryDelete) {
      onHistoryDelete(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  // 삭제 취소
  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  // 프리셋 적용
  const applyPreset = (presetType: 'pose-variation' | 'character-design' | 'style-variation') => {
    if (presetType === 'pose-variation') {
      // 포즈/표정/동작 베리에이션 (캐릭터 외형 유지)
      setSeed(undefined);
      setTemperature(0.8);
      setTopK(40);
      setTopP(0.95);
      setReferenceStrength(0.95);
    } else if (presetType === 'character-design') {
      // 다양한 캐릭터 디자인 (스타일 유지)
      setSeed(undefined);
      setTemperature(1.2);
      setTopK(60);
      setTopP(0.95);
      setReferenceStrength(0.6);
    } else if (presetType === 'style-variation') {
      // 헤어/의상/악세사리 변경 (캐릭터 외형 유지)
      setSeed(undefined);
      setTemperature(1.0);
      setTopK(50);
      setTopP(0.90);
      setReferenceStrength(0.85);
    }
  };

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
                  : '스타일 세션'}{' '}
                · Gemini 3 Pro
              </p>
            </div>
          </div>
          {/* 다운로드 버튼 (이미지 생성 시 표시) */}
          {generatedImage && !isGenerating && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all shadow-lg"
            >
              <Download size={20} />
              <span>다운로드</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽: 설정 패널 */}
        <div className="w-96 bg-white border-r border-gray-200 p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* 사용자 맞춤 프롬프트 안내 (자동 적용) */}
            {analysis.user_custom_prompt && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-purple-800">
                    ✅ 사용자 맞춤 프롬프트 (자동 적용됨)
                  </p>
                  {containsKorean(analysis.user_custom_prompt) && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 rounded text-xs text-purple-700">
                      <Languages size={12} />
                      <span>한→영</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-purple-700 whitespace-pre-wrap break-words">
                  {analysis.user_custom_prompt}
                </p>
              </div>
            )}

            {/* 추가 프롬프트 입력 (선택사항) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  추가 프롬프트 (선택)
                </label>
                {containsKorean(additionalPrompt) && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded text-xs text-blue-700">
                    <Languages size={14} />
                    <span>한→영 자동 변환</span>
                  </div>
                )}
              </div>
              <textarea
                value={additionalPrompt}
                onChange={(e) => setAdditionalPrompt(e.target.value)}
                placeholder={
                  sessionType === 'CHARACTER'
                    ? '예: 손을 흔들며 뒤를 돌아보는 / looking back, waving hand'
                    : sessionType === 'BACKGROUND'
                    ? '예: 숲 속, 폭포가 있는 / forest with waterfall'
                    : sessionType === 'ICON'
                    ? '예: 불타는 검, 빛나는 / flaming sword, glowing'
                    : '예: 밤 풍경, 비오는 날씨 / night scene, rainy weather'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                한국어 또는 영어로 입력하세요. 한국어는 자동으로 영어로 변환됩니다.
              </p>
            </div>

            {/* 생성 버튼 */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all shadow-lg ${
                isGenerating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white hover:shadow-xl'
              }`}
            >
              <Wand2 size={20} />
              <span>{isGenerating ? '생성 중...' : '이미지 생성'}</span>
            </button>

            {/* 비율 선택 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">비율</label>
              <div className="grid grid-cols-3 gap-2">
                {(['1:1', '16:9', '9:16', '4:3', '3:4'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-3 py-2 rounded-lg font-semibold transition-all ${
                      aspectRatio === ratio
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* 크기 선택 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                이미지 크기
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['1K', '2K', '4K'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setImageSize(size)}
                    className={`px-3 py-2 rounded-lg font-semibold transition-all ${
                      imageSize === size
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* 참조 이미지 사용 */}
            <div>
              <label
                className={`flex items-center gap-2 ${
                  sessionType === 'STYLE' ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sessionType === 'STYLE' ? useReferenceImages : true}
                  onChange={(e) => setUseReferenceImages(e.target.checked)}
                  disabled={sessionType !== 'STYLE'}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 disabled:cursor-not-allowed"
                />
                <span className="text-sm font-semibold text-gray-700">
                  참조 이미지 사용 ({referenceImages.length}개)
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                {sessionType === 'CHARACTER'
                  ? '캐릭터 세션에서는 참조 이미지가 필수입니다 (자동 활성화)'
                  : sessionType === 'BACKGROUND'
                  ? '배경 세션에서는 참조 이미지가 필수입니다 (자동 활성화)'
                  : sessionType === 'ICON'
                  ? '아이콘 세션에서는 참조 이미지가 필수입니다 (자동 활성화)'
                  : '현재 세션의 이미지를 참조하여 스타일 일관성을 높입니다'}
              </p>

              {/* 참조 이미지가 사용될 때만 썸네일과 영향력 슬라이더 표시 */}
              {(sessionType !== 'STYLE' || useReferenceImages) && referenceImages.length > 0 && (
                <div className="mt-3 space-y-3">
                  {/* 참조 이미지 썸네일 */}
                  <div className="grid grid-cols-4 gap-2">
                    {referenceImages.slice(0, 4).map((img, idx) => (
                      <div key={idx} className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                        <img
                          src={img}
                          alt={`참조 ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>

                  {/* 참조 영향력 슬라이더 */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      참조 영향력: {(referenceStrength * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={referenceStrength}
                      onChange={(e) => setReferenceStrength(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>영감만 (0%)</span>
                      <span>완벽 복사 (100%)</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {sessionType === 'CHARACTER'
                        ? '캐릭터 외형 복사 정도를 조절합니다. 높을수록 참조 이미지와 동일하게 유지됩니다.'
                        : sessionType === 'BACKGROUND'
                        ? '배경 스타일 복사 정도를 조절합니다. 높을수록 참조 배경의 스타일을 강하게 따릅니다.'
                        : sessionType === 'ICON'
                        ? '아이콘 스타일 복사 정도를 조절합니다. 높을수록 참조 아이콘의 스타일을 강하게 따릅니다.'
                        : '스타일 복사 정도를 조절합니다. 높을수록 참조 스타일을 강하게 따릅니다.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 고급 설정 */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHelp(true)}
                  className="p-3 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  title="고급 설정 도움말"
                >
                  <HelpCircle size={20} />
                </button>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex-1 flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-700">고급 설정</span>
                  {showAdvanced ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>

              {showAdvanced && (
                <div className="mt-4 space-y-4">
                  {/* 프리셋 버튼 */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      프리셋
                    </label>
                    <div className="space-y-2">
                      <button
                        onClick={() => applyPreset('pose-variation')}
                        className="w-full flex flex-col items-start p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                      >
                        <span className="text-sm font-semibold text-blue-800">포즈/표정/동작 베리에이션</span>
                        <span className="text-xs text-blue-600 mt-0.5">캐릭터 외형을 유지하면서 다양한 포즈와 표정</span>
                      </button>
                      <button
                        onClick={() => applyPreset('character-design')}
                        className="w-full flex flex-col items-start p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
                      >
                        <span className="text-sm font-semibold text-green-800">다양한 캐릭터 디자인</span>
                        <span className="text-xs text-green-600 mt-0.5">참조 스타일로 다양한 캐릭터 생성</span>
                      </button>
                      <button
                        onClick={() => applyPreset('style-variation')}
                        className="w-full flex flex-col items-start p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200"
                      >
                        <span className="text-sm font-semibold text-purple-800">헤어/의상/악세사리 변경</span>
                        <span className="text-xs text-purple-600 mt-0.5">캐릭터 외형을 유지하면서 스타일 변형</span>
                      </button>
                    </div>
                  </div>
                  {/* Seed 값 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Seed (재현성)
                      </label>
                      <button
                        onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 rounded transition-colors"
                        title="랜덤 Seed 생성"
                      >
                        <Dices size={14} />
                        랜덤
                      </button>
                    </div>
                    <input
                      type="number"
                      value={seed ?? ''}
                      onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="비워두면 랜덤 생성"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      동일한 seed 값으로 동일한 결과를 재현할 수 있습니다
                    </p>
                  </div>

                  {/* Temperature */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Temperature: {temperature.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>일관성 (0.0)</span>
                      <span>창의성 (2.0)</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      낮을수록 일관적이고 예측 가능한 결과, 높을수록 창의적이고 다양한 결과
                    </p>
                  </div>

                  {/* Top-K */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Top-K: {topK}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={topK}
                      onChange={(e) => setTopK(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      샘플링할 상위 K개의 토큰 수 (낮을수록 보수적, 높을수록 다양함)
                    </p>
                  </div>

                  {/* Top-P */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Top-P: {topP.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={topP}
                      onChange={(e) => setTopP(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      누적 확률 임계값 (낮을수록 보수적, 높을수록 다양함)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 진행 상태 */}
            {progressMessage && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  {isTranslating && <Languages size={16} className="text-blue-600 animate-pulse" />}
                  <p className="text-sm text-blue-800">{progressMessage}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 결과 표시 및 히스토리 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 결과 표시 영역 */}
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="flex items-start justify-center min-h-full">
              {isGenerating ? (
                <div className="flex flex-col items-center mt-20">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mb-4"></div>
                  <p className="text-gray-600 font-semibold">{progressMessage}</p>
                </div>
              ) : generatedImage ? (
                <div className="max-w-5xl w-full">
                  <div className="bg-white rounded-xl shadow-2xl p-6">
                    <img
                      src={generatedImage}
                      alt="Generated"
                      className="w-full h-auto rounded-lg"
                      style={{ maxHeight: 'none' }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 mt-20">
                  <ImageIcon size={64} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-semibold">이미지를 생성해보세요</p>
                  <p className="text-sm mt-2">왼쪽 설정을 조정하고 "이미지 생성" 버튼을 클릭하세요</p>
                </div>
              )}
            </div>
          </div>

          {/* 히스토리 섹션 */}
          {generationHistory.length > 0 && (
            <>
              {/* Resizer - 히스토리 영역 상단 */}
              <Resizer onResize={handleHistoryResize} direction="vertical" />

              <div
                className="border-t border-gray-200 bg-white p-4 overflow-y-auto"
                style={{ height: `${historyHeight}px` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <History size={16} className="text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-800">생성 히스토리 ({generationHistory.length})</h3>
                </div>
              <div className="grid grid-cols-8 gap-2">
                {generationHistory
                  .slice()
                  .sort((a, b) => {
                    // 핀된 항목을 먼저 표시
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    // 시간순 역순 (최신 먼저)
                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                  })
                  .map((entry) => (
                  <div
                    key={entry.id}
                    className="group relative"
                    title={`생성 시간: ${new Date(entry.timestamp).toLocaleString()}`}
                  >
                    {/* 핀 아이콘 (좌측 상단) */}
                    <button
                      onClick={(e) => handleTogglePin(e, entry.id)}
                      className={`absolute top-1 left-1 z-10 p-1 rounded transition-all ${
                        entry.isPinned
                          ? 'bg-yellow-500 text-white'
                          : 'bg-black/50 text-white opacity-0 group-hover:opacity-100'
                      }`}
                      title={entry.isPinned ? '핀 해제' : '핀 고정'}
                    >
                      <Pin size={12} />
                    </button>

                    <div className={`aspect-square bg-gray-100 rounded-md overflow-hidden border-2 transition-all ${
                      entry.isPinned ? 'border-yellow-500' : 'border-transparent group-hover:border-purple-500'
                    }`}>
                      <img
                        src={entry.imageBase64}
                        alt={`Generated ${new Date(entry.timestamp).toLocaleString()}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-70 rounded-md transition-all flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => handleRestoreFromHistory(e, entry)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-green-600 hover:bg-green-700 rounded text-white"
                        title="복원"
                      >
                        <RotateCcw size={16} />
                      </button>
                      {onHistoryDelete && (
                        <button
                          onClick={(e) => handleDeleteHistory(e, entry.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-red-600 hover:bg-red-700 rounded text-white"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">히스토리 삭제</h3>
            <p className="text-gray-600 mb-6">
              이 생성 히스토리를 삭제하시겠습니까?<br />
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors font-medium"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

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
