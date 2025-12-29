import { useState } from 'react';
import { User, Edit2, Save, X } from 'lucide-react';
import { CharacterAnalysis } from '../types/analysis';

interface CharacterCardProps {
  character: CharacterAnalysis;
  onUpdate?: (character: CharacterAnalysis) => void;
}

export function CharacterCard({ character, onUpdate }: CharacterCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCharacter, setEditedCharacter] = useState<CharacterAnalysis>(character);

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editedCharacter);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedCharacter(character);
    setIsEditing(false);
  };

  const fields: Array<{ key: keyof CharacterAnalysis; label: string; icon?: string }> = [
    { key: 'gender', label: '성별', icon: '👤' },
    { key: 'age_group', label: '연령대', icon: '📅' },
    { key: 'hair', label: '머리', icon: '💇' },
    { key: 'eyes', label: '눈', icon: '👁️' },
    { key: 'face', label: '얼굴', icon: '😊' },
    { key: 'outfit', label: '의상', icon: '👔' },
    { key: 'accessories', label: '액세서리', icon: '💎' },
    { key: 'body_proportions', label: '등신대 비율', icon: '📏' },
    { key: 'hand_style', label: '손 표현', icon: '✋' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <User size={24} className="text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">캐릭터 분석</h3>
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
              className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
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
                value={editedCharacter[key]}
                onChange={(e) =>
                  setEditedCharacter({ ...editedCharacter, [key]: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-700">
                {character[key]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
