import { useState } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import { ImageAnalysisResult } from '../types/analysis';

interface CustomPromptCardProps {
  analysis: ImageAnalysisResult;
  onCustomPromptChange?: (customPrompt: string) => void;
}

/**
 * 사용자 맞춤 프롬프트 카드
 * 사용자가 직접 입력한 추가 프롬프트를 관리
 */
export function CustomPromptCard({
  analysis,
  onCustomPromptChange,
}: CustomPromptCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState('');

  const currentValue = analysis.user_custom_prompt || '';

  // 편집 시작
  const startEdit = () => {
    setEditedValue(currentValue);
    setIsEditing(true);
  };

  // 저장
  const saveEdit = () => {
    const trimmedValue = editedValue.trim();

    if (onCustomPromptChange) {
      onCustomPromptChange(trimmedValue);
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
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Pencil size={24} className="text-blue-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-800">사용자 맞춤 프롬프트</h3>
      </div>

      {/* 설명 */}
      <p className="text-sm text-gray-600 mb-3">
        추가로 원하는 스타일이나 특징을 자유롭게 입력하세요. 분석 강화 시 유지됩니다.
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
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="편집"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>

        {/* 필드 값 */}
        {isEditing ? (
          <textarea
            value={editedValue}
            onChange={handleTextareaChange}
            className="w-full px-3 py-2 border-2 border-blue-500 focus:ring-blue-500 rounded-lg
                       focus:outline-none focus:ring-2
                       resize-none overflow-y-auto"
            style={{ minHeight: '100px', maxHeight: '200px' }}
            autoFocus
            placeholder="예: 더 밝은 색상, 부드러운 느낌, 귀여운 표정 등..."
            onFocus={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
          />
        ) : (
          <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-700 whitespace-pre-wrap break-words min-h-[100px]">
            {currentValue || '(추가 프롬프트가 없습니다. 편집 버튼을 눌러 입력하세요)'}
          </div>
        )}
      </div>
    </div>
  );
}
