import { useState, useEffect } from 'react';
import { User, Edit2, Save, X, Languages } from 'lucide-react';
import { CharacterAnalysis } from '../types/analysis';
import { useGeminiTranslator } from '../hooks/useGeminiTranslator';

interface CharacterCardProps {
  character: CharacterAnalysis;
  apiKey: string;
  koreanCharacter?: CharacterAnalysis; // 캐시된 한국어 번역
  onUpdate?: (character: CharacterAnalysis) => void;
}

export function CharacterCard({ character, apiKey, koreanCharacter: koreanCharacterProp, onUpdate }: CharacterCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCharacter, setEditedCharacter] = useState<CharacterAnalysis>(character);
  const [koreanCharacter, setKoreanCharacter] = useState<CharacterAnalysis>(character);
  const [isTranslating, setIsTranslating] = useState(false);

  const { translateBatchToKorean } = useGeminiTranslator();

  // character prop이 변경되면 editedCharacter 동기화
  useEffect(() => {
    setEditedCharacter(character);
  }, [character]);

  // 캐릭터 필드들을 한국어로 번역 (캐시가 없을 때만 실행)
  useEffect(() => {
    const translateCharacter = async () => {
      // 캐시된 번역이 있으면 그것을 사용
      if (koreanCharacterProp) {
        console.log('♻️ [CharacterCard] 캐시된 번역 사용');
        setKoreanCharacter(koreanCharacterProp);
        return;
      }

      // 캐시가 없으면 번역 실행
      if (!apiKey) return;

      console.log('🌐 [CharacterCard] 번역 실행 중...');
      setIsTranslating(true);
      try {
        // 배치 번역으로 API 호출 1회로 줄임
        const texts = [
          character.gender,
          character.age_group,
          character.hair,
          character.eyes,
          character.face,
          character.outfit,
          character.accessories,
          character.body_proportions,
          character.limb_proportions,
          character.torso_shape,
          character.hand_style,
        ];

        const translations = await translateBatchToKorean(apiKey, texts);

        setKoreanCharacter({
          gender: translations[0],
          age_group: translations[1],
          hair: translations[2],
          eyes: translations[3],
          face: translations[4],
          outfit: translations[5],
          accessories: translations[6],
          body_proportions: translations[7],
          limb_proportions: translations[8],
          torso_shape: translations[9],
          hand_style: translations[10],
        });
        console.log('✅ [CharacterCard] 번역 완료');
      } catch (error) {
        console.error('❌ [CharacterCard] 번역 오류:', error);
        setKoreanCharacter(character);
      } finally {
        setIsTranslating(false);
      }
    };

    translateCharacter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character, apiKey, koreanCharacterProp]); // koreanCharacterProp 추가

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
    { key: 'limb_proportions', label: '팔다리 비율', icon: '🦵' },
    { key: 'torso_shape', label: '몸통 형태', icon: '🫁' },
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
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-800">캐릭터 분석</h3>
            {!isEditing && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded text-xs text-blue-700">
                <Languages size={12} />
                <span>한국어</span>
              </div>
            )}
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
            ) : isTranslating ? (
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-500 flex items-center gap-2">
                <Languages size={14} className="animate-pulse" />
                <span className="text-sm">번역 중...</span>
              </div>
            ) : (
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-700">
                {koreanCharacter[key]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
