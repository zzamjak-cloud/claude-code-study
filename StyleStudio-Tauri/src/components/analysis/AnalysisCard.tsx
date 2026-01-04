import { useState, useEffect } from 'react';
import { LucideIcon, Edit2, Save, X, Languages } from 'lucide-react';
import { useFieldEditor } from '../../hooks/useFieldEditor';
import { logger } from '../../lib/logger';

interface AnalysisCardProps<T> {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  borderColor: string;
  bgColor: string;
  hoverColor: string;
  focusColor: string;
  data: T;
  koreanData?: T;
  fields: Array<{ key: keyof T; label: string; icon?: string }>;
  onUpdate?: (data: T) => void;
  onKoreanUpdate?: (koreanData: T) => void;
}

/**
 * 공통 분석 카드 컴포넌트
 * StyleCard, CharacterCard, CompositionCard를 통합
 */
export function AnalysisCard<T extends Record<string, any>>({
  title,
  icon: Icon,
  iconColor,
  borderColor,
  bgColor,
  hoverColor,
  focusColor,
  data,
  koreanData: koreanDataProp,
  fields,
  onUpdate,
  onKoreanUpdate,
}: AnalysisCardProps<T>) {
  // 로컬 한글 상태 (즉시 업데이트용)
  // 초기값: 캐시된 한국어가 있으면 사용, 없으면 영어 원본 사용
  const [koreanDataDisplay, setKoreanDataDisplay] = useState<T>(koreanDataProp || data);

  // useFieldEditor 훅 사용
  const {
    editingField,
    editedValue,
    setEditedValue,
    isTranslating,
    startEdit,
    saveField,
    cancelEdit,
  } = useFieldEditor<T>({
    analysisData: data,
    koreanData: koreanDataDisplay,
    onUpdate: (updated) => {
      // 영어 분석 결과 업데이트 → App.tsx로 전달
      if (onUpdate) {
        onUpdate(updated);
      }
    },
    onKoreanUpdate: (updated) => {
      // 한글 캐시 즉시 업데이트 (화면 반영)
      setKoreanDataDisplay(updated);
      // 세션의 한글 캐시도 업데이트
      if (onKoreanUpdate) {
        onKoreanUpdate(updated);
      }
    },
  });

  // 영어 원본이 변경되면 한글 표시도 영어 원본으로 업데이트 (번역은 나중에)
  // 영어 원본이 변경되었을 때만 업데이트 (편집 중이 아닐 때, 캐시가 없을 때만)
  useEffect(() => {
    // 편집 중이 아니고, 캐시가 없을 때만 영어 원본 표시
    if (!editingField && !koreanDataProp) {
      setKoreanDataDisplay(data);
    }
  }, [data, editingField, koreanDataProp]);

  // 캐시가 업데이트되면 반영 (번역 완료 시)
  useEffect(() => {
    if (koreanDataProp) {
      logger.debug(`♻️ [${title}] 캐시된 번역 사용`);
      if (!editingField) {
        setKoreanDataDisplay(koreanDataProp);
      }
    } else if (!editingField) {
      // 캐시가 없으면 영어 원본 표시
      setKoreanDataDisplay(data);
    }
  }, [koreanDataProp, data, editingField, title]);

  // Textarea 자동 높이 조정
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    setEditedValue(target.value);

    // 높이 자동 조정
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
  };

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 border-2 ${borderColor}`}>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 ${bgColor} rounded-lg`}>
          <Icon size={24} className={iconColor} />
        </div>
        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
        {!editingField && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded text-xs text-blue-700">
            <Languages size={12} />
            <span>한국어</span>
          </div>
        )}
      </div>

      {/* 필드 목록 */}
      <div className="space-y-3">
        {fields.map(({ key, label, icon: fieldIcon }) => (
          <div key={String(key)} className="flex flex-col">
            {/* 라벨 + 편집/저장/취소 버튼 */}
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                {fieldIcon && <span>{fieldIcon}</span>}
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
                  className={`p-1.5 text-gray-400 ${hoverColor} rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
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
                  className={`w-full px-3 py-2 border-2 ${focusColor} rounded-lg
                             focus:outline-none focus:ring-2 ${focusColor}
                             resize-none overflow-y-auto`}
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
            ) : (
              // 읽기 모드
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-700 whitespace-pre-wrap break-words">
                {String(koreanDataDisplay[key] ?? '')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

