import { useState, useEffect } from 'react';
import { AlertTriangle, Edit2, Save, X, Languages } from 'lucide-react';
import { useGeminiTranslator } from '../hooks/useGeminiTranslator';

interface NegativePromptCardProps {
  negativePrompt: string;
  apiKey: string;
  koreanNegativePrompt?: string; // 캐시된 한국어 번역
  onUpdate?: (negativePrompt: string) => void;
}

export function NegativePromptCard({
  negativePrompt,
  apiKey,
  koreanNegativePrompt: koreanNegativeProp,
  onUpdate,
}: NegativePromptCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(negativePrompt);
  const [koreanPrompt, setKoreanPrompt] = useState(negativePrompt);
  const [isTranslating, setIsTranslating] = useState(false);

  const { translateToKorean } = useGeminiTranslator();

  // negativePrompt prop이 변경되면 editedPrompt 동기화
  useEffect(() => {
    setEditedPrompt(negativePrompt);
  }, [negativePrompt]);

  // 네거티브 프롬프트를 한국어로 번역 (캐시가 없을 때만 실행)
  useEffect(() => {
    const translatePrompt = async () => {
      // 캐시된 번역이 있으면 그것을 사용
      if (koreanNegativeProp) {
        console.log('♻️ [NegativePromptCard] 캐시된 번역 사용');
        setKoreanPrompt(koreanNegativeProp);
        return;
      }

      // 캐시가 없으면 번역 실행
      if (!apiKey || !negativePrompt) return;

      console.log('🌐 [NegativePromptCard] 번역 실행 중...');
      setIsTranslating(true);
      try {
        const translated = await translateToKorean(apiKey, negativePrompt);
        setKoreanPrompt(translated);
        console.log('✅ [NegativePromptCard] 번역 완료');
      } catch (error) {
        console.error('❌ [NegativePromptCard] 번역 오류:', error);
        setKoreanPrompt(negativePrompt);
      } finally {
        setIsTranslating(false);
      }
    };

    translatePrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negativePrompt, apiKey, koreanNegativeProp]); // koreanNegativeProp 추가

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editedPrompt);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedPrompt(negativePrompt);
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-red-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle size={24} className="text-red-600" />
          </div>
          <div className="flex items-center gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-gray-800">부정 프롬프트</h3>
                {!isEditing && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded text-xs text-blue-700">
                    <Languages size={12} />
                    <span>한국어</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">이 스타일에서 피해야 할 요소</p>
            </div>
          </div>
        </div>

        {/* 편집 버튼 */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                title="저장"
              >
                <Save size={18} />
              </button>
              <button
                onClick={handleCancel}
                className="p-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                title="취소"
              >
                <X size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              title="편집"
            >
              <Edit2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 내용 */}
      {isEditing ? (
        <textarea
          value={editedPrompt}
          onChange={(e) => setEditedPrompt(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
          rows={4}
          placeholder="피해야 할 요소들을 입력하세요 (예: realistic proportions, detailed anatomy, 5-finger hands)"
        />
      ) : isTranslating ? (
        <div className="px-3 py-2 bg-red-50 rounded-lg text-gray-500 flex items-center gap-2">
          <Languages size={16} className="animate-pulse" />
          <span>번역 중...</span>
        </div>
      ) : (
        <div className="px-3 py-2 bg-red-50 rounded-lg text-gray-700 whitespace-pre-wrap">
          {koreanPrompt}
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-800">
          <strong>💡 Tip:</strong> 이미지 생성 시 이 요소들을 피하면 스타일 일관성이 높아집니다.
        </p>
      </div>
    </div>
  );
}
