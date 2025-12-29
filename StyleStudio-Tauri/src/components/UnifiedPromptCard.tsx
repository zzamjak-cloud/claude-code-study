import { useState } from 'react';
import { Copy, Check, Sparkles } from 'lucide-react';
import { ImageAnalysisResult } from '../types/analysis';
import { buildUnifiedPrompt } from '../lib/promptBuilder';

interface UnifiedPromptCardProps {
  analysis: ImageAnalysisResult;
}

export function UnifiedPromptCard({ analysis }: UnifiedPromptCardProps) {
  const [copiedPositive, setCopiedPositive] = useState(false);
  const [copiedNegative, setCopiedNegative] = useState(false);

  const { positivePrompt, negativePrompt } = buildUnifiedPrompt(analysis);

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

      {/* Positive Prompt */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">✅ Positive Prompt</label>
          <button
            onClick={() => handleCopy(positivePrompt, 'positive')}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-all"
          >
            {copiedPositive ? (
              <>
                <Check size={16} />
                <span>복사됨!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>복사</span>
              </>
            )}
          </button>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200 max-h-40 overflow-y-auto">
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
            {positivePrompt}
          </p>
        </div>
      </div>

      {/* Negative Prompt */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">❌ Negative Prompt</label>
          <button
            onClick={() => handleCopy(negativePrompt, 'negative')}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-all"
          >
            {copiedNegative ? (
              <>
                <Check size={16} />
                <span>복사됨!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>복사</span>
              </>
            )}
          </button>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200 max-h-40 overflow-y-auto">
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
            {negativePrompt}
          </p>
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>💡 사용법:</strong> Positive Prompt는 이미지 생성 시 포함할 요소, Negative Prompt는 피할 요소입니다.
          <br />각 버튼을 클릭하여 클립보드에 복사한 후 이미지 생성 도구에 붙여넣으세요.
        </p>
      </div>
    </div>
  );
}
