import { useState, useEffect } from 'react';
import { AlertTriangle, Edit2, Save, X } from 'lucide-react';
import { logger } from '../../lib/logger';

interface NegativePromptCardProps {
  negativePrompt: string;
  koreanNegativePrompt?: string; // 캐시된 한국어 번역
  onUpdate?: (negativePrompt: string) => void;
  onKoreanUpdate?: (koreanNegativePrompt: string) => void;
}

export function NegativePromptCard({
  negativePrompt,
  koreanNegativePrompt: koreanNegativeProp,
  onUpdate,
  onKoreanUpdate,
}: NegativePromptCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(negativePrompt);
  // 로컬 한글 상태 (즉시 업데이트용)
  const [koreanPromptDisplay, setKoreanPromptDisplay] = useState(negativePrompt);
  const [isSaving, setIsSaving] = useState(false);

  // 네거티브 프롬프트 표시 (자동 번역 제거, 캐시만 사용)
  // 영어 원본이 변경되면 한글 표시도 업데이트 (번역은 나중에)
  useEffect(() => {
    // 편집 중이 아니면 영어 원본 표시
    if (!isEditing) {
      setKoreanPromptDisplay(negativePrompt);
    }
  }, [negativePrompt, isEditing]);
  
  // 캐시가 업데이트되면 반영 (번역 버튼 클릭 시)
  useEffect(() => {
    if (koreanNegativeProp) {
      logger.debug('♻️ [NegativePromptCard] 캐시된 번역 사용');
      setKoreanPromptDisplay(koreanNegativeProp);
    }
  }, [koreanNegativeProp]);

  const handleSave = async () => {
    if (!onUpdate) return;

    setIsSaving(true);

    try {
      const trimmedValue = editedPrompt.trim();

      logger.debug(`💾 [NegativePromptCard] 저장 시작:`, {
        value: trimmedValue,
      });

      // 1. 입력한 값을 그대로 저장 (번역 없이)
      // 영어 원본은 세션 저장 시에만 번역됨
      onUpdate(trimmedValue);
      logger.debug('✅ [NegativePromptCard] 값 저장 완료 (번역 없이)');

      // 2. 한글 값은 입력한 그대로 저장 (통합 프롬프트에서 한글 캐시 사용)
      setKoreanPromptDisplay(trimmedValue);
      
      // 세션의 한글 캐시도 업데이트
      if (onKoreanUpdate) {
        onKoreanUpdate(trimmedValue);
      }

      // 3. 편집 모드 종료
      setIsEditing(false);
    } catch (error) {
      logger.error('❌ [NegativePromptCard] 저장 오류:', error);
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
            rows={8}
            placeholder="피해야 할 요소들을 한글 또는 영어로 입력하세요 (예: 사실적인 비율, 상세한 해부학, 5개 손가락 손)"
            disabled={isSaving}
            autoFocus
          />
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
