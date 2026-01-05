import { useState, useEffect } from 'react';
import { AlertCircle, Edit2, Save, X, Languages } from 'lucide-react';

interface NegativePromptCardProps {
  negativePrompt: string;
  koreanNegativePrompt?: string;
  onUpdate?: (negativePrompt: string) => void;
  onKoreanUpdate?: (koreanNegativePrompt: string) => void;
}

/**
 * 부정 프롬프트 카드 컴포넌트
 * 피해야 할 요소들을 표시하고 편집
 */
export function NegativePromptCard({
  negativePrompt,
  koreanNegativePrompt,
  onUpdate,
  onKoreanUpdate,
}: NegativePromptCardProps) {
  // 편집 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState('');

  // 표시용 상태 (한글 또는 영어)
  const [displayValue, setDisplayValue] = useState(negativePrompt);

  // 영어 원본이 변경되면 표시 업데이트
  useEffect(() => {
    if (!isEditing) {
      setDisplayValue(koreanNegativePrompt || negativePrompt);
    }
  }, [negativePrompt, koreanNegativePrompt, isEditing]);

  // 편집 시작
  const startEdit = () => {
    setEditedValue(displayValue);
    setIsEditing(true);
  };

  // 저장
  const saveEdit = () => {
    const trimmedValue = editedValue.trim();

    // 영어 원본 업데이트
    if (onUpdate) {
      onUpdate(trimmedValue);
    }

    // 한글 캐시 업데이트
    setDisplayValue(trimmedValue);
    if (onKoreanUpdate) {
      onKoreanUpdate(trimmedValue);
    }

    setIsEditing(false);
  };

  // 취소
  const cancelEdit = () => {
    setIsEditing(false);
    setEditedValue('');
  };

  // Textarea 자동 높이 조정
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    setEditedValue(target.value);

    // 높이 자동 조정
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-red-200">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-red-100 rounded-lg">
          <AlertCircle size={24} className="text-red-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-800">부정 프롬프트</h3>
        {!isEditing && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded text-xs text-blue-700">
            <Languages size={12} />
            <span>한국어</span>
          </div>
        )}
      </div>

      {/* 설명 */}
      <p className="text-sm text-gray-600 mb-3">
        피해야 할 요소들 (생성 시 제외할 특징)
      </p>

      {/* 내용 */}
      <div className="flex flex-col">
        {/* 편집/저장 버튼 */}
        <div className="flex items-center justify-end mb-2">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <button
                onClick={saveEdit}
                className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                title="저장"
              >
                <Save size={14} />
              </button>
              <button
                onClick={cancelEdit}
                className="p-1.5 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded transition-colors"
                title="취소"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="편집"
            >
              <Edit2 size={14} />
            </button>
          )}
        </div>

        {/* 필드 값 */}
        {isEditing ? (
          <textarea
            value={editedValue}
            onChange={handleTextareaChange}
            className="w-full px-3 py-2 border-2 border-red-500 focus:ring-red-500 rounded-lg
                       focus:outline-none focus:ring-2
                       resize-none overflow-y-auto"
            style={{ minHeight: '80px', maxHeight: '200px' }}
            autoFocus
            placeholder="피해야 할 요소들을 입력하세요..."
            onFocus={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
          />
        ) : (
          <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-700 whitespace-pre-wrap break-words min-h-[80px]">
            {displayValue || '(비어있음)'}
          </div>
        )}
      </div>
    </div>
  );
}
