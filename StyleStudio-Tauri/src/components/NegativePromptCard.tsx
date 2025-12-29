import { useState } from 'react';
import { AlertTriangle, Edit2, Save, X } from 'lucide-react';

interface NegativePromptCardProps {
  negativePrompt: string;
  onUpdate?: (negativePrompt: string) => void;
}

export function NegativePromptCard({ negativePrompt, onUpdate }: NegativePromptCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(negativePrompt);

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
          <div>
            <h3 className="text-xl font-bold text-gray-800">부정 프롬프트</h3>
            <p className="text-xs text-gray-500">이 스타일에서 피해야 할 요소</p>
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
      ) : (
        <div className="px-3 py-2 bg-red-50 rounded-lg text-gray-700 whitespace-pre-wrap">
          {negativePrompt}
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
