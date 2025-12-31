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
  // 로컬 한글 상태 (즉시 업데이트용)
  const [koreanPromptDisplay, setKoreanPromptDisplay] = useState(negativePrompt);
  const [isInitialTranslating, setIsInitialTranslating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { translateToKorean, translateToEnglish, containsKorean } = useGeminiTranslator();

  // 네거티브 프롬프트를 한국어로 번역 (캐시가 없을 때만 실행)
  useEffect(() => {
    // 캐시된 번역이 있으면 사용
    if (koreanNegativeProp) {
      console.log('♻️ [NegativePromptCard] 캐시된 번역 사용');
      setKoreanPromptDisplay(koreanNegativeProp);
      return;
    }

    // 캐시가 없으면 번역 실행
    const translatePrompt = async () => {
      if (!apiKey || !negativePrompt) return;

      console.log('🌐 [NegativePromptCard] 번역 실행 중...');
      setIsInitialTranslating(true);
      try {
        const translated = await translateToKorean(apiKey, negativePrompt);
        setKoreanPromptDisplay(translated);
        console.log('✅ [NegativePromptCard] 번역 완료');
      } catch (error) {
        console.error('❌ [NegativePromptCard] 번역 오류:', error);
        setKoreanPromptDisplay(negativePrompt);
      } finally {
        setIsInitialTranslating(false);
      }
    };

    translatePrompt();
  }, [negativePrompt, apiKey, koreanNegativeProp, translateToKorean]);

  const handleSave = async () => {
    if (!onUpdate) return;

    setIsSaving(true);

    try {
      const trimmedValue = editedPrompt.trim();
      const isKoreanInput = containsKorean(trimmedValue);

      console.log(`💾 [NegativePromptCard] 저장 시작:`, {
        isKoreanInput,
        value: trimmedValue,
      });

      let englishValue = trimmedValue;
      let koreanValue = trimmedValue;

      // 1. 한글 입력이면 영어로 번역
      if (isKoreanInput) {
        console.log('🌐 [NegativePromptCard] 한글 → 영어 번역 중...');
        englishValue = await translateToEnglish(apiKey, trimmedValue);
        console.log('✅ [NegativePromptCard] 영어 번역 완료:', englishValue);
        koreanValue = trimmedValue; // 한글 값은 입력 그대로
      } else {
        // 2. 영어 입력이면 한글로 번역 (즉시 화면 표시용)
        console.log('🌐 [NegativePromptCard] 영어 → 한글 번역 중...');
        koreanValue = await translateToKorean(apiKey, trimmedValue);
        console.log('✅ [NegativePromptCard] 한글 번역 완료:', koreanValue);
        englishValue = trimmedValue; // 영어 값은 입력 그대로
      }

      // 3. 영어 값으로 저장 (App.tsx로 전달)
      onUpdate(englishValue);
      console.log('✅ [NegativePromptCard] 영어 값 저장 완료');

      // 4. 한글 캐시 즉시 업데이트 (화면 반영)
      setKoreanPromptDisplay(koreanValue);
      console.log('✅ [NegativePromptCard] 한글 캐시 업데이트 완료');

      // 5. 편집 모드 종료
      setIsEditing(false);
    } catch (error) {
      console.error('❌ [NegativePromptCard] 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    // 편집 모드 진입시 한글 번역된 값으로 초기화
    setEditedPrompt(koreanPromptDisplay);
    setIsEditing(true);
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
                className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="저장"
                disabled={isSaving}
              >
                <Save size={18} />
              </button>
              <button
                onClick={handleCancel}
                className="p-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="취소"
                disabled={isSaving}
              >
                <X size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={handleEdit}
              className="p-2 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors"
              title="편집"
            >
              <Edit2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 내용 */}
      {isEditing ? (
        <div>
          <textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            className="w-full px-3 py-2 border-2 border-red-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            rows={4}
            placeholder="피해야 할 요소들을 한글 또는 영어로 입력하세요 (예: 사실적인 비율, 상세한 해부학, 5개 손가락 손)"
            disabled={isSaving}
            autoFocus
          />
          {isSaving && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <Languages size={14} className="animate-pulse" />
              <span>번역 중...</span>
            </div>
          )}
        </div>
      ) : isInitialTranslating ? (
        <div className="px-3 py-2 bg-red-50 rounded-lg text-gray-500 flex items-center gap-2">
          <Languages size={16} className="animate-pulse" />
          <span>번역 중...</span>
        </div>
      ) : (
        <div className="px-3 py-2 bg-red-50 rounded-lg text-gray-700 whitespace-pre-wrap break-words">
          {koreanPromptDisplay}
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
