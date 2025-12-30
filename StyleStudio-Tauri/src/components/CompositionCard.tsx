import { useState, useEffect } from 'react';
import { Camera, Edit2, Save, X, Languages } from 'lucide-react';
import { CompositionAnalysis } from '../types/analysis';
import { useGeminiTranslator } from '../hooks/useGeminiTranslator';

interface CompositionCardProps {
  composition: CompositionAnalysis;
  apiKey: string;
  koreanComposition?: CompositionAnalysis; // 캐시된 한국어 번역
  onUpdate?: (composition: CompositionAnalysis) => void;
}

export function CompositionCard({ composition, apiKey, koreanComposition: koreanCompositionProp, onUpdate }: CompositionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedComposition, setEditedComposition] = useState<CompositionAnalysis>(composition);
  const [koreanComposition, setKoreanComposition] = useState<CompositionAnalysis>(composition);
  const [isTranslating, setIsTranslating] = useState(false);

  const { translateBatchToKorean } = useGeminiTranslator();

  // 구도 필드들을 한국어로 번역 (캐시가 없을 때만 실행)
  useEffect(() => {
    const translateComposition = async () => {
      // 캐시된 번역이 있으면 그것을 사용
      if (koreanCompositionProp) {
        console.log('♻️ [CompositionCard] 캐시된 번역 사용');
        setKoreanComposition(koreanCompositionProp);
        return;
      }

      // 캐시가 없으면 번역 실행
      if (!apiKey) return;

      console.log('🌐 [CompositionCard] 번역 실행 중...');
      setIsTranslating(true);
      try {
        // 배치 번역으로 API 호출 1회로 줄임
        const texts = [
          composition.pose,
          composition.angle,
          composition.background,
          composition.depth_of_field,
        ];

        const translations = await translateBatchToKorean(apiKey, texts);

        setKoreanComposition({
          pose: translations[0],
          angle: translations[1],
          background: translations[2],
          depth_of_field: translations[3],
        });
        console.log('✅ [CompositionCard] 번역 완료');
      } catch (error) {
        console.error('❌ [CompositionCard] 번역 오류:', error);
        setKoreanComposition(composition);
      } finally {
        setIsTranslating(false);
      }
    };

    translateComposition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composition, apiKey, koreanCompositionProp]); // koreanCompositionProp 추가

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
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-800">구도 분석</h3>
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
            ) : isTranslating ? (
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-500 flex items-center gap-2">
                <Languages size={14} className="animate-pulse" />
                <span className="text-sm">번역 중...</span>
              </div>
            ) : (
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-700">
                {koreanComposition[key]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
