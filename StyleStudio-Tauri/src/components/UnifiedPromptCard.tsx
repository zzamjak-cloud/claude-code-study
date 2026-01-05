import { useState } from 'react';
import { Copy, Check, FileText } from 'lucide-react';
import { ImageAnalysisResult } from '../types/analysis';
import { KoreanAnalysisCache } from '../types/session';

interface UnifiedPromptCardProps {
  analysis: ImageAnalysisResult;
  koreanAnalysis?: KoreanAnalysisCache;
}

/**
 * 통합 프롬프트 카드
 * 모든 분석 결과를 하나의 프롬프트로 통합하여 표시 (읽기 전용)
 */
export function UnifiedPromptCard({
  analysis,
  koreanAnalysis,
}: UnifiedPromptCardProps) {
  const [copied, setCopied] = useState(false);

  // 통합 프롬프트 생성
  const generateUnifiedPrompt = (): string => {
    const parts: string[] = [];

    // 사용자 맞춤 프롬프트 (최우선)
    if (analysis.user_custom_prompt?.trim()) {
      parts.push(analysis.user_custom_prompt.trim());
    }

    // 스타일
    const style = koreanAnalysis?.style || analysis.style;
    parts.push(
      `[스타일] ${style.art_style}, ${style.technique}, ${style.color_palette}, ${style.lighting}, ${style.mood}`
    );

    // 캐릭터
    const character = koreanAnalysis?.character || analysis.character;
    parts.push(
      `[캐릭터] ${character.gender}, ${character.age_group}, ${character.hair}, ${character.eyes}, ${character.face}, ${character.outfit}, ${character.accessories}, ${character.body_proportions}, ${character.limb_proportions}, ${character.torso_shape}, ${character.hand_style}`
    );

    // 구도
    const composition = koreanAnalysis?.composition || analysis.composition;
    parts.push(
      `[구도] ${composition.pose}, ${composition.angle}, ${composition.background}, ${composition.depth_of_field}`
    );

    return parts.join('\n\n');
  };

  const unifiedPrompt = generateUnifiedPrompt();

  // 클립보드에 복사
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(unifiedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('복사 실패:', error);
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-lg p-6 border-2 border-purple-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg">
            <FileText size={24} className="text-purple-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">통합 프롬프트</h3>
            <p className="text-xs text-gray-500">모든 분석 결과 통합</p>
          </div>
        </div>

        {/* 복사 버튼 */}
        <button
          onClick={copyToClipboard}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
            copied
              ? 'bg-green-500 text-white'
              : 'bg-white hover:bg-purple-100 text-purple-600 border border-purple-200'
          }`}
          title="클립보드에 복사"
        >
          {copied ? (
            <>
              <Check size={18} />
              <span>복사됨!</span>
            </>
          ) : (
            <>
              <Copy size={18} />
              <span>복사</span>
            </>
          )}
        </button>
      </div>

      {/* 통합 프롬프트 내용 */}
      <div className="bg-white rounded-lg p-4 text-gray-700 whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto border border-purple-200">
        {unifiedPrompt}
      </div>

      {/* 안내 메시지 */}
      <p className="text-xs text-gray-500 mt-3">
        이 프롬프트를 복사하여 이미지 생성 AI에 사용할 수 있습니다.
      </p>
    </div>
  );
}
