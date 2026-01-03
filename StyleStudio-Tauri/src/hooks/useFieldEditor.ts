import { useState } from 'react';

/**
 * 개별 필드 편집을 위한 커스텀 훅
 * 제네릭 타입으로 모든 분석 타입(StyleAnalysis, CharacterAnalysis, CompositionAnalysis)에서 사용 가능
 */

interface UseFieldEditorProps<T> {
  analysisData: T; // 영어 원본 데이터
  koreanData: T; // 한글 번역 데이터 (로컬 상태)
  apiKey: string;
  onUpdate: (updated: T) => void; // 영어 값 업데이트 콜백
  onKoreanUpdate: (updated: T) => void; // 한글 캐시 업데이트 콜백
}

interface UseFieldEditorReturn<T> {
  editingField: keyof T | null;
  editedValue: string;
  setEditedValue: (value: string) => void;
  isTranslating: boolean;
  startEdit: (field: keyof T) => void;
  saveField: () => Promise<void>;
  cancelEdit: () => void;
}

export function useFieldEditor<T extends Record<string, any>>(
  props: UseFieldEditorProps<T>
): UseFieldEditorReturn<T> {
  const [editingField, setEditingField] = useState<keyof T | null>(null);
  const [editedValue, setEditedValue] = useState('');
  const [isTranslating] = useState(false); // 번역 없이 저장하므로 항상 false

  /**
   * 편집 모드 진입
   * 한글 번역된 값으로 초기화
   */
  const startEdit = (field: keyof T) => {
    console.log('✏️ [useFieldEditor] 편집 시작:', field);
    setEditingField(field);
    // 한글 값으로 초기화 (사용자가 한글로 편집할 수 있도록)
    setEditedValue(String(props.koreanData[field]));
  };

  /**
   * 필드 저장
   * 번역 없이 입력한 값을 그대로 저장 (영어 원본은 세션 저장 시에만 번역)
   */
  const saveField = async () => {
    if (!editingField) {
      console.warn('⚠️ [useFieldEditor] 편집 중인 필드가 없습니다.');
      return;
    }

    try {
      const trimmedValue = editedValue.trim();

      console.log(`💾 [useFieldEditor] 저장 시작 (${editingField as string}):`, {
        value: trimmedValue,
      });

      // 1. 입력한 값을 그대로 영어 원본에 저장 (번역 없이)
      // 영어 원본은 세션 저장 시에만 번역됨
      const updatedAnalysis = {
        ...props.analysisData,
        [editingField]: trimmedValue, // 입력한 값 그대로 저장 (번역 없이)
      };
      props.onUpdate(updatedAnalysis);
      console.log('✅ [useFieldEditor] 분석 결과 업데이트 완료 (번역 없이)');

      // 2. 한글 값은 입력한 그대로 저장 (통합 프롬프트에서 한글 캐시 사용)
      const updatedKorean = {
        ...props.koreanData,
        [editingField]: trimmedValue, // 한글 값 그대로 저장
      };
      props.onKoreanUpdate(updatedKorean);
      console.log('✅ [useFieldEditor] 한글 캐시 업데이트 (한글 값 그대로 저장)');

      // 3. 편집 모드 종료
      setEditingField(null);
      setEditedValue('');
    } catch (error) {
      console.error('❌ [useFieldEditor] 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  /**
   * 편집 취소
   */
  const cancelEdit = () => {
    console.log('❌ [useFieldEditor] 편집 취소');
    setEditingField(null);
    setEditedValue('');
  };

  return {
    editingField,
    editedValue,
    setEditedValue,
    isTranslating,
    startEdit,
    saveField,
    cancelEdit,
  };
}
