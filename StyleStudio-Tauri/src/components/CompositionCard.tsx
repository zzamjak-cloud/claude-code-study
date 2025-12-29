import { useState } from 'react';
import { Camera, Edit2, Save, X } from 'lucide-react';
import { CompositionAnalysis } from '../types/analysis';

interface CompositionCardProps {
  composition: CompositionAnalysis;
  onUpdate?: (composition: CompositionAnalysis) => void;
}

export function CompositionCard({ composition, onUpdate }: CompositionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedComposition, setEditedComposition] = useState<CompositionAnalysis>(composition);

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editedComposition);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedComposition(composition);
    setIsEditing(false);
  };

  const fields: Array<{ key: keyof CompositionAnalysis; label: string; icon?: string }> = [
    { key: 'pose', label: '포즈', icon: '🧍' },
    { key: 'angle', label: '앵글', icon: '📐' },
    { key: 'background', label: '배경', icon: '🏞️' },
    { key: 'depth_of_field', label: '심도', icon: '🔍' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Camera size={24} className="text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">구도 분석</h3>
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
              className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
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
                value={editedComposition[key]}
                onChange={(e) =>
                  setEditedComposition({ ...editedComposition, [key]: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-700">
                {composition[key]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
