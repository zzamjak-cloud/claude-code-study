import { useState } from 'react';
import { Copy, Check, Sparkles } from 'lucide-react';
import { ImageAnalysisResult } from '../../types/analysis';
import { buildUnifiedPrompt, buildUnifiedPromptFromKorean } from '../../lib/promptBuilder';
import { KoreanAnalysisCache } from '../../types/session';
import { logger } from '../../lib/logger';

interface UnifiedPromptCardProps {
  analysis: ImageAnalysisResult;
  koreanAnalysis?: KoreanAnalysisCache; // 한글 캐시 정보
}

export function UnifiedPromptCard({
  analysis,
  koreanAnalysis,
}: UnifiedPromptCardProps) {
  const [copiedPositive, setCopiedPositive] = useState(false);
  const [copiedNegative, setCopiedNegative] = useState(false);

  // 영어 원본 프롬프트 (API 전달용)
  const { positivePrompt: englishPositivePrompt, negativePrompt: englishNegativePrompt } = buildUnifiedPrompt(analysis);
  
  // 한글 프롬프트 (화면 표시용) - 한글 캐시가 있으면 사용, 없으면 영어 원본 표시
  const koreanPrompts = koreanAnalysis 
    ? buildUnifiedPromptFromKorean(analysis, koreanAnalysis)
    : { positivePrompt: englishPositivePrompt, negativePrompt: englishNegativePrompt };
  
  const displayPositivePrompt = koreanPrompts.positivePrompt || englishPositivePrompt;
  const displayNegativePrompt = koreanPrompts.negativePrompt || englishNegativePrompt;

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
      logger.error('복사 실패:', error);
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
          <p className="text-xs text-gray-600">모든 분석 카드의 정보를 통합한 프롬프트</p>
        </div>
      </div>

      {/* Positive Prompt */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-700">✅ Positive Prompt</label>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded text-xs text-blue-700">
              <span>한국어 표시</span>
            </div>
          </div>
          <button
            onClick={() => handleCopy(englishPositivePrompt, 'positive')}
            className="p-2 text-green-600 hover:bg-green-100 hover:text-green-700 rounded-lg transition-all"
            title="영어 원본 복사 (API 전달용)"
          >
            {copiedPositive ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200 max-h-40 overflow-y-auto">
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
            {displayPositivePrompt}
          </p>
        </div>
      </div>

      {/* Negative Prompt */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-700">❌ Negative Prompt</label>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded text-xs text-blue-700">
              <span>한국어 표시</span>
            </div>
          </div>
          <button
            onClick={() => handleCopy(englishNegativePrompt, 'negative')}
            className="p-2 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-all"
            title="영어 원본 복사 (API 전달용)"
          >
            {copiedNegative ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200 max-h-40 overflow-y-auto">
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
            {displayNegativePrompt}
          </p>
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>💡 사용법:</strong> 통합 프롬프트는 모든 분석 카드의 정보를 모아서 표시합니다.
          <br />각 분석 카드를 수정하면 통합 프롬프트가 자동으로 갱신됩니다.
          <br />복사 버튼을 클릭하면 API 전달용 영어 원본이 복사됩니다.
        </p>
      </div>
    </div>
  );
}
