import { useState, useEffect } from 'react';
import { Camera, Edit2, Save, X, Languages } from 'lucide-react';
import { CompositionAnalysis } from '../types/analysis';
import { useGeminiTranslator } from '../hooks/useGeminiTranslator';
import { useFieldEditor } from '../hooks/useFieldEditor';

interface CompositionCardProps {
  composition: CompositionAnalysis;
  apiKey: string;
  koreanComposition?: CompositionAnalysis; // 캐시된 한국어 번역
  onUpdate?: (composition: CompositionAnalysis) => void;
}

export function CompositionCard({ composition, apiKey, koreanComposition: koreanCompositionProp, onUpdate }: CompositionCardProps) {
  // 로컬 한글 상태 (즉시 업데이트용)
  const [koreanCompositionDisplay, setKoreanCompositionDisplay] = useState<CompositionAnalysis>(composition);
  const [isInitialTranslating, setIsInitialTranslating] = useState(false);

  const { translateBatchToKorean } = useGeminiTranslator();

  // useFieldEditor 훅 사용
  const {
    editingField,
    editedValue,
    setEditedValue,
    isTranslating,
    startEdit,
    saveField,
    cancelEdit,
  } = useFieldEditor<CompositionAnalysis>({
    analysisData: composition,
    koreanData: koreanCompositionDisplay,
    apiKey,
    onUpdate: (updated) => {
      // 영어 분석 결과 업데이트 → App.tsx로 전달
      if (onUpdate) {
        onUpdate(updated);
      }
    },
    onKoreanUpdate: (updated) => {
      // 한글 캐시 즉시 업데이트 (화면 반영)
      setKoreanCompositionDisplay(updated);
    },
  });

  // composition prop이 변경되면 로컬 상태 동기화
  useEffect(() => {
    // 캐시된 번역이 있으면 사용
    if (koreanCompositionProp) {
      console.log('♻️ [CompositionCard] 캐시된 번역 사용');
      setKoreanCompositionDisplay(koreanCompositionProp);
      return;
    }

    // 캐시가 없으면 번역 실행
    const translateComposition = async () => {
      if (!apiKey) return;

      console.log('🌐 [CompositionCard] 번역 실행 중...');
      setIsInitialTranslating(true);
      try {
        const texts = [
          composition.pose,
          composition.angle,
          composition.background,
          composition.depth_of_field,
        ];

        const translations = await translateBatchToKorean(apiKey, texts);

        setKoreanCompositionDisplay({
          pose: translations[0],
          angle: translations[1],
          background: translations[2],
          depth_of_field: translations[3],
        });
        console.log('✅ [CompositionCard] 번역 완료');
      } catch (error) {
        console.error('❌ [CompositionCard] 번역 오류:', error);
        setKoreanCompositionDisplay(composition);
      } finally {
        setIsInitialTranslating(false);
      }
    };

    translateComposition();
  }, [composition, apiKey, koreanCompositionProp, translateBatchToKorean]);

  // Textarea 자동 높이 조정
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    setEditedValue(target.value);

    // 높이 자동 조정
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
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
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-green-100 rounded-lg">
          <Camera size={24} className="text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-800">구도 분석</h3>
        {!editingField && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded text-xs text-blue-700">
            <Languages size={12} />
            <span>한국어</span>
          </div>
        )}
      </div>

      {/* 필드 목록 */}
      <div className="space-y-3">
        {fields.map(({ key, label, icon }) => (
          <div key={key} className="flex flex-col">
            {/* 라벨 + 편집/저장/취소 버튼 */}
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                <span>{icon}</span>
                <span>{label}</span>
              </label>

              {editingField === key ? (
                // 저장/취소 버튼
                <div className="flex items-center gap-1">
                  <button
                    onClick={saveField}
                    className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isTranslating}
                    title="저장"
                  >
                    <Save size={14} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1.5 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isTranslating}
                    title="취소"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                // 편집 버튼 (항상 표시)
                <button
                  onClick={() => startEdit(key)}
                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={editingField !== null} // 다른 필드 편집 중이면 비활성화
                  title="편집"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </div>

            {/* 필드 값 */}
            {editingField === key ? (
              // 편집 모드: Textarea
              <div>
                <textarea
                  value={editedValue}
                  onChange={handleTextareaChange}
                  className="w-full px-3 py-2 border-2 border-green-500 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-green-500
                             resize-none overflow-y-auto"
                  style={{ minHeight: '60px', maxHeight: '200px' }}
                  autoFocus
                  disabled={isTranslating}
                  onFocus={(e) => {
                    // 포커스시 높이 조정
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                  }}
                />
                {isTranslating && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                    <Languages size={14} className="animate-pulse" />
                    <span>번역 중...</span>
                  </div>
                )}
              </div>
            ) : isInitialTranslating ? (
              // 초기 번역 중
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-500 flex items-center gap-2">
                <Languages size={14} className="animate-pulse" />
                <span className="text-sm">번역 중...</span>
              </div>
            ) : (
              // 읽기 모드
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-700 whitespace-pre-wrap break-words">
                {koreanCompositionDisplay[key]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
