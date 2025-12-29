import { useState } from 'react';
import { Palette, Edit2, Save, X } from 'lucide-react';
import { StyleAnalysis } from '../types/analysis';

interface StyleCardProps {
  style: StyleAnalysis;
  onUpdate?: (style: StyleAnalysis) => void;
}

export function StyleCard({ style, onUpdate }: StyleCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedStyle, setEditedStyle] = useState<StyleAnalysis>(style);

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editedStyle);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedStyle(style);
    setIsEditing(false);
  };

  const fields: Array<{ key: keyof StyleAnalysis; label: string; icon?: string }> = [
    { key: 'art_style', label: '화풍', icon: '🎨' },
    { key: 'technique', label: '기법', icon: '🖌️' },
    { key: 'color_palette', label: '색상', icon: '🎨' },
    { key: 'lighting', label: '조명', icon: '💡' },
    { key: 'mood', label: '분위기', icon: '✨' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-purple-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Palette size={24} className="text-purple-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">스타일 분석</h3>
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
              className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
              title="편집"
            >
              <Edit2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 필드 목록 */}
      <div className="space-y-3">
        {fields.map(({ key, label, icon }) => (
          <div key={key} className="flex flex-col">
            <label className="text-sm font-semibold text-gray-600 mb-1 flex items-center gap-2">
              <span>{icon}</span>
              <span>{label}</span>
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedStyle[key]}
                onChange={(e) =>
                  setEditedStyle({ ...editedStyle, [key]: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-700">
                {style[key]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
