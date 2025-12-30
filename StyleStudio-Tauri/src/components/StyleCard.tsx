import { useState, useEffect } from 'react';
import { Palette, Edit2, Save, X, Languages } from 'lucide-react';
import { StyleAnalysis } from '../types/analysis';
import { useGeminiTranslator } from '../hooks/useGeminiTranslator';

interface StyleCardProps {
  style: StyleAnalysis;
  apiKey: string;
  koreanStyle?: StyleAnalysis; // 캐시된 한국어 번역
  onUpdate?: (style: StyleAnalysis) => void;
}

export function StyleCard({ style, apiKey, koreanStyle: koreanStyleProp, onUpdate }: StyleCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedStyle, setEditedStyle] = useState<StyleAnalysis>(style);
  const [koreanStyle, setKoreanStyle] = useState<StyleAnalysis>(style);
  const [isTranslating, setIsTranslating] = useState(false);

  const { translateBatchToKorean } = useGeminiTranslator();

  // style prop이 변경되면 editedStyle 동기화
  useEffect(() => {
    setEditedStyle(style);
  }, [style]);

  // 스타일 필드들을 한국어로 번역 (캐시가 없을 때만 실행)
  useEffect(() => {
    const translateStyle = async () => {
      // 캐시된 번역이 있으면 그것을 사용
      if (koreanStyleProp) {
        console.log('♻️ [StyleCard] 캐시된 번역 사용');
        setKoreanStyle(koreanStyleProp);
        return;
      }

      // 캐시가 없으면 번역 실행
      if (!apiKey) return;

      console.log('🌐 [StyleCard] 번역 실행 중...');
      setIsTranslating(true);
      try {
        // 배치 번역으로 API 호출 1회로 줄임
        const texts = [
          style.art_style,
          style.technique,
          style.color_palette,
          style.lighting,
          style.mood,
        ];

        const translations = await translateBatchToKorean(apiKey, texts);

        setKoreanStyle({
          art_style: translations[0],
          technique: translations[1],
          color_palette: translations[2],
          lighting: translations[3],
          mood: translations[4],
        });
        console.log('✅ [StyleCard] 번역 완료');
      } catch (error) {
        console.error('❌ [StyleCard] 번역 오류:', error);
        setKoreanStyle(style);
      } finally {
        setIsTranslating(false);
      }
    };

    translateStyle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, apiKey, koreanStyleProp]); // koreanStyleProp 추가

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
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-800">스타일 분석</h3>
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
            ) : isTranslating ? (
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-500 flex items-center gap-2">
                <Languages size={14} className="animate-pulse" />
                <span className="text-sm">번역 중...</span>
              </div>
            ) : (
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-700">
                {koreanStyle[key]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
