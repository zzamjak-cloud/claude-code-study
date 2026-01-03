import { useState, useEffect } from 'react';
import { Edit3, Sparkles } from 'lucide-react';
import { ImageAnalysisResult } from '../../types/analysis';

interface CustomPromptCardProps {
  analysis: ImageAnalysisResult;
  onCustomPromptChange?: (customPrompt: string) => void;
}

export function CustomPromptCard({
  analysis,
  onCustomPromptChange,
}: CustomPromptCardProps) {
  const [customPrompt, setCustomPrompt] = useState(analysis.user_custom_prompt || '');

  // analysis가 변경될 때 customPrompt 업데이트
  useEffect(() => {
    setCustomPrompt(analysis.user_custom_prompt || '');
  }, [analysis.user_custom_prompt]);

  const handleCustomPromptChange = (value: string) => {
    setCustomPrompt(value);
    onCustomPromptChange?.(value);
  };

  return (
    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl shadow-lg p-6 border-2 border-yellow-300">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-yellow-600 rounded-lg">
          <Sparkles size={24} className="text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-800">사용자 맞춤 프롬프트</h3>
          <p className="text-xs text-gray-600">추가하고 싶은 요소나 변경사항을 입력하세요</p>
        </div>
      </div>

      {/* 사용자 맞춤 프롬프트 입력 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Edit3 size={16} className="text-yellow-600" />
          <label className="text-sm font-semibold text-gray-700">✨ 추가 프롬프트</label>
        </div>
        <textarea
          value={customPrompt}
          onChange={(e) => handleCustomPromptChange(e.target.value)}
          placeholder="추가하고 싶은 요소나 변경사항을 입력하세요 (예: smiling, outdoor background, sunset lighting)"
          className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none text-sm"
          rows={6}
        />
        <p className="text-xs text-gray-500 mt-1">
          💡 여기에 입력한 내용은 분석 강화 시에도 유지됩니다
        </p>
      </div>

      {/* 안내 메시지 */}
      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800">
          <strong>💡 사용법:</strong> 한국어 또는 영어로 입력 가능하며, 이미지 생성 시 자동으로 영어로 변환됩니다.
        </p>
      </div>
    </div>
  );
}

