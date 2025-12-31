import { useState, useEffect } from 'react';
import { Copy, Check, Sparkles, Edit3, Languages } from 'lucide-react';
import { ImageAnalysisResult } from '../types/analysis';
import { buildUnifiedPrompt } from '../lib/promptBuilder';
import { useGeminiTranslator } from '../hooks/useGeminiTranslator';

interface UnifiedPromptCardProps {
  analysis: ImageAnalysisResult;
  apiKey: string;
  koreanPositivePrompt?: string; // 캐시된 한국어 번역
  koreanNegativePrompt?: string; // 캐시된 한국어 번역
  onCustomPromptChange?: (customPrompt: string) => void;
}

export function UnifiedPromptCard({
  analysis,
  apiKey,
  koreanPositivePrompt: koreanPositiveProp,
  koreanNegativePrompt: koreanNegativeProp,
  onCustomPromptChange,
}: UnifiedPromptCardProps) {
  const [copiedPositive, setCopiedPositive] = useState(false);
  const [copiedNegative, setCopiedNegative] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(analysis.user_custom_prompt || '');
  const [koreanPositivePrompt, setKoreanPositivePrompt] = useState('');
  const [koreanNegativePrompt, setKoreanNegativePrompt] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const { positivePrompt, negativePrompt } = buildUnifiedPrompt(analysis);
  const { translateBatchToKorean, containsKorean } = useGeminiTranslator();

  // analysis가 변경될 때 customPrompt 업데이트
  useEffect(() => {
    setCustomPrompt(analysis.user_custom_prompt || '');
  }, [analysis.user_custom_prompt]);

  // 프롬프트를 한국어로 번역 (캐시가 없을 때만 실행)
  useEffect(() => {
    const translatePrompts = async () => {
      // 캐시된 번역이 있으면 그것을 사용
      if (koreanPositiveProp && koreanNegativeProp) {
        console.log('♻️ [UnifiedPromptCard] 캐시된 번역 사용');
        setKoreanPositivePrompt(koreanPositiveProp);
        setKoreanNegativePrompt(koreanNegativeProp);
        return;
      }

      // 캐시가 없으면 번역 실행
      if (!apiKey || !positivePrompt) return;

      console.log('🌐 [UnifiedPromptCard] 번역 실행 중...');
      setIsTranslating(true);
      try {
        // 배치 번역으로 API 호출 1회로 줄임
        const translations = await translateBatchToKorean(apiKey, [
          positivePrompt,
          negativePrompt,
        ]);

        setKoreanPositivePrompt(translations[0]);
        setKoreanNegativePrompt(translations[1]);
        console.log('✅ [UnifiedPromptCard] 번역 완료');
      } catch (error) {
        console.error('❌ [UnifiedPromptCard] 번역 오류:', error);
        // 번역 실패 시 영어 원본 사용
        setKoreanPositivePrompt(positivePrompt);
        setKoreanNegativePrompt(negativePrompt);
      } finally {
        setIsTranslating(false);
      }
    };

    translatePrompts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positivePrompt, negativePrompt, apiKey, koreanPositiveProp, koreanNegativeProp]); // props 추가

  const handleCustomPromptChange = (value: string) => {
    setCustomPrompt(value);
    onCustomPromptChange?.(value);
  };

  const handleCopy = async (text: string, type: 'positive' | 'negative') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'positive') {
        setCopiedPositive(true);
        setTimeout(() => setCopiedPositive(false), 2000);
      } else {
        setCopiedNegative(true);
        setTimeout(() => setCopiedNegative(false), 2000);
      }
    } catch (error) {
      console.error('복사 실패:', error);
      alert('클립보드 복사 실패');
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-lg p-6 border-2 border-purple-300">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-purple-600 rounded-lg">
          <Sparkles size={24} className="text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-800">통합 프롬프트</h3>
          <p className="text-xs text-gray-600">이미지 생성에 바로 사용 가능</p>
        </div>
      </div>

      {/* 사용자 맞춤 프롬프트 (최상단) */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Edit3 size={16} className="text-purple-600" />
          <label className="text-sm font-semibold text-gray-700">✨ 사용자 맞춤 프롬프트</label>
        </div>
        <textarea
          value={customPrompt}
          onChange={(e) => handleCustomPromptChange(e.target.value)}
          placeholder="추가하고 싶은 요소나 변경사항을 입력하세요 (예: smiling, outdoor background, sunset lighting)"
          className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm"
          rows={3}
        />
        <p className="text-xs text-gray-500 mt-1">
          💡 여기에 입력한 내용은 분석 강화 시에도 유지됩니다
        </p>
      </div>

      {/* Positive Prompt */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-700">✅ Positive Prompt</label>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded text-xs text-blue-700">
              <Languages size={12} />
              <span>한국어 표시</span>
            </div>
          </div>
          <button
            onClick={() => handleCopy(positivePrompt, 'positive')}
            className="p-2 text-green-600 hover:bg-green-100 hover:text-green-700 rounded-lg transition-all"
            title="영어 원본 복사 (API 전달용)"
          >
            {copiedPositive ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200 max-h-40 overflow-y-auto">
          {isTranslating ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Languages size={16} className="animate-pulse" />
              <span>한국어로 번역 중...</span>
            </div>
          ) : (
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
              {koreanPositivePrompt || positivePrompt}
            </p>
          )}
        </div>
      </div>

      {/* Negative Prompt */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-700">❌ Negative Prompt</label>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded text-xs text-blue-700">
              <Languages size={12} />
              <span>한국어 표시</span>
            </div>
          </div>
          <button
            onClick={() => handleCopy(negativePrompt, 'negative')}
            className="p-2 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-all"
            title="영어 원본 복사 (API 전달용)"
          >
            {copiedNegative ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200 max-h-40 overflow-y-auto">
          {isTranslating ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Languages size={16} className="animate-pulse" />
              <span>한국어로 번역 중...</span>
            </div>
          ) : (
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
              {koreanNegativePrompt || negativePrompt}
            </p>
          )}
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>💡 사용법:</strong> 프롬프트는 한국어로 표시되지만, 복사 버튼을 클릭하면 API 전달용 영어 원본이 복사됩니다.
          <br />사용자 맞춤 프롬프트는 한국어 또는 영어로 입력 가능하며, 이미지 생성 시 자동으로 영어로 변환됩니다.
        </p>
      </div>
    </div>
  );
}
