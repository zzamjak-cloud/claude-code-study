import { useState } from 'react';
import { useGeminiTranslator } from './useGeminiTranslator';

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
  const [isTranslating, setIsTranslating] = useState(false);

  const { translateToEnglish, translateToKorean, containsKorean } = useGeminiTranslator();

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
   * 1. 한글 감지 → 영어 번역
   * 2. 영어 값으로 analysisData 업데이트
   * 3. 영어 입력이었으면 한글로 번역하여 koreanData 업데이트
   */
  const saveField = async () => {
    if (!editingField) {
      console.warn('⚠️ [useFieldEditor] 편집 중인 필드가 없습니다.');
      return;
    }

    setIsTranslating(true);

    try {
      let englishValue = editedValue.trim();
      let koreanValue = editedValue.trim();
      const isKoreanInput = containsKorean(editedValue);

      console.log(`💾 [useFieldEditor] 저장 시작 (${editingField as string}):`, {
        isKoreanInput,
        value: editedValue,
      });

      // 1. 한글 입력이면 영어로 번역
      if (isKoreanInput) {
        console.log('🌐 [useFieldEditor] 한글 → 영어 번역 중...');
        englishValue = await translateToEnglish(props.apiKey, editedValue.trim());
        console.log('✅ [useFieldEditor] 영어 번역 완료:', englishValue);
        // 한글 값은 입력 그대로 사용
        koreanValue = editedValue.trim();
      } else {
        // 2. 영어 입력이면 한글로 번역 (즉시 화면 표시용)
        console.log('🌐 [useFieldEditor] 영어 → 한글 번역 중...');
        koreanValue = await translateToKorean(props.apiKey, editedValue.trim());
        console.log('✅ [useFieldEditor] 한글 번역 완료:', koreanValue);
        // 영어 값은 입력 그대로 사용
        englishValue = editedValue.trim();
      }

      // 3. 영어 값으로 분석 결과 업데이트
      const updatedAnalysis = {
        ...props.analysisData,
        [editingField]: englishValue,
      };
      props.onUpdate(updatedAnalysis);
      console.log('✅ [useFieldEditor] 영어 분석 결과 업데이트 완료');

      // 4. 한글 캐시 업데이트 (즉시 화면 반영)
      const updatedKorean = {
        ...props.koreanData,
        [editingField]: koreanValue,
      };
      props.onKoreanUpdate(updatedKorean);
      console.log('✅ [useFieldEditor] 한글 캐시 업데이트 완료');

      // 5. 편집 모드 종료
      setEditingField(null);
      setEditedValue('');
    } catch (error) {
      console.error('❌ [useFieldEditor] 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsTranslating(false);
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
