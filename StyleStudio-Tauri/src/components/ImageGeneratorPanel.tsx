import { useState } from 'react';
import { Wand2, Download, Settings, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { ImageAnalysisResult } from '../types/analysis';
import { SessionType } from '../types/session';
import { buildUnifiedPrompt } from '../lib/promptBuilder';
import { useGeminiImageGenerator } from '../hooks/useGeminiImageGenerator';

interface ImageGeneratorPanelProps {
  apiKey: string;
  analysis: ImageAnalysisResult;
  referenceImages: string[];
  sessionType: SessionType;
  onSettingsClick?: () => void;
  onBack?: () => void;
}

export function ImageGeneratorPanel({
  apiKey,
  analysis,
  referenceImages,
  sessionType,
  onSettingsClick,
  onBack,
}: ImageGeneratorPanelProps) {
  const { positivePrompt, negativePrompt } = buildUnifiedPrompt(analysis);
  const { generateImage } = useGeminiImageGenerator();

  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [useReferenceImages, setUseReferenceImages] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!apiKey) {
      alert('API 키를 먼저 설정해주세요');
      onSettingsClick?.();
      return;
    }

    setIsGenerating(true);
    setProgressMessage('이미지 생성 준비 중...');
    setGeneratedImage(null);

    // 최종 프롬프트 구성
    let finalPrompt = '';

    if (sessionType === 'CHARACTER') {
      // 캐릭터 세션: 참조 이미지가 캐릭터 외형을 완벽히 유지하므로
      // 포즈/표정/동작만 프롬프트로 전달
      const parts = [
        analysis.user_custom_prompt,
        additionalPrompt.trim(),
      ].filter(Boolean);
      finalPrompt = parts.length > 0 ? parts.join(', ') : 'standing naturally, neutral expression';
    } else {
      // 스타일 세션: 참조 이미지가 있으면 스타일만 유지하고
      // 구체적인 내용은 사용자 프롬프트 사용
      if (useReferenceImages && referenceImages.length > 0) {
        // 참조 이미지로 스타일 유지, 사용자 프롬프트만 사용
        const parts = [
          analysis.user_custom_prompt,
          additionalPrompt.trim(),
        ].filter(Boolean);
        finalPrompt = parts.length > 0 ? parts.join(', ') : positivePrompt;
      } else {
        // 참조 이미지 없으면 AI 분석 프롬프트 포함
        const parts = [
          positivePrompt,
          analysis.user_custom_prompt,
          additionalPrompt.trim(),
        ].filter(Boolean);
        finalPrompt = parts.join(', ');
      }
    }

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
      },
      {
        onProgress: (message) => {
          setProgressMessage(message);
          console.log('📊 진행:', message);
        },
        onComplete: (imageBase64) => {
          const dataUrl = `data:image/png;base64,${imageBase64}`;
          setGeneratedImage(dataUrl);
          setIsGenerating(false);
          setProgressMessage('');
          console.log('✅ 생성 완료');
        },
        onError: (error) => {
          setIsGenerating(false);
          setProgressMessage('');
          console.error('❌ 생성 오류:', error);
          alert('이미지 생성 실패: ' + error.message);
        },
      }
    );
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

      console.log('✅ 이미지 다운로드 완료');
    } catch (error) {
      console.error('❌ 다운로드 오류:', error);
      alert('이미지 다운로드에 실패했습니다: ' + (error as Error).message);
    }
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
                {sessionType === 'CHARACTER' ? '캐릭터 세션' : '스타일 세션'} · Gemini 3 Pro
              </p>
            </div>
          </div>
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings size={20} className="text-gray-600" />
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
                <p className="text-xs font-semibold text-purple-800 mb-1">
                  ✅ 사용자 맞춤 프롬프트 (자동 적용됨)
                </p>
                <p className="text-xs text-purple-700 whitespace-pre-wrap break-words">
                  {analysis.user_custom_prompt}
                </p>
              </div>
            )}

            {/* 추가 프롬프트 입력 (선택사항) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {sessionType === 'CHARACTER' ? '추가 포즈/표정/동작 (선택)' : '추가 프롬프트 (선택)'}
              </label>
              <textarea
                value={additionalPrompt}
                onChange={(e) => setAdditionalPrompt(e.target.value)}
                placeholder={
                  sessionType === 'CHARACTER'
                    ? '예: looking back, waving hand'
                    : '예: night scene, rainy weather'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                {sessionType === 'CHARACTER'
                  ? '이 생성에만 적용할 임시 요소를 입력하세요. 캐릭터 외형은 참조 이미지를 유지합니다.'
                  : '이 생성에만 적용할 임시 요소를 입력하세요. AI 분석과 사용자 맞춤 프롬프트는 자동 포함됩니다.'}
              </p>
            </div>

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
                  sessionType === 'CHARACTER' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sessionType === 'CHARACTER' ? true : useReferenceImages}
                  onChange={(e) => setUseReferenceImages(e.target.checked)}
                  disabled={sessionType === 'CHARACTER'}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 disabled:cursor-not-allowed"
                />
                <span className="text-sm font-semibold text-gray-700">
                  참조 이미지 사용 ({referenceImages.length}개)
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                {sessionType === 'CHARACTER'
                  ? '캐릭터 세션에서는 참조 이미지가 필수입니다 (자동 활성화)'
                  : '현재 세션의 이미지를 참조하여 스타일 일관성을 높입니다'}
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

            {/* 진행 상태 */}
            {progressMessage && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">{progressMessage}</p>
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 결과 표시 */}
        <div className="flex-1 p-8 flex items-center justify-center overflow-auto">
          {isGenerating ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mb-4"></div>
              <p className="text-gray-600 font-semibold">{progressMessage}</p>
            </div>
          ) : generatedImage ? (
            <div className="max-w-4xl w-full">
              <div className="bg-white rounded-xl shadow-2xl p-6">
                <img
                  src={generatedImage}
                  alt="Generated"
                  className="w-full h-auto rounded-lg"
                />
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all"
                  >
                    <Download size={20} />
                    <span>다운로드</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400">
              <ImageIcon size={64} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-semibold">이미지를 생성해보세요</p>
              <p className="text-sm mt-2">왼쪽 설정을 조정하고 "이미지 생성" 버튼을 클릭하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
