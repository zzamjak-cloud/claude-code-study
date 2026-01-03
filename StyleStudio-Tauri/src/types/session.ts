import { ImageAnalysisResult, StyleAnalysis, CharacterAnalysis, CompositionAnalysis } from './analysis';

export type SessionType = 'STYLE' | 'CHARACTER';

// 번역된 분석 결과 (캐싱용)
export interface KoreanAnalysisCache {
  style?: StyleAnalysis;
  character?: CharacterAnalysis;
  composition?: CompositionAnalysis;
  negativePrompt?: string; // 한국어 번역
  positivePrompt?: string; // 한국어 번역
  customPromptEnglish?: string; // 사용자 맞춤 프롬프트의 영어 번역 (이미지 생성용)
}

export interface Session {
  id: string;
  name: string;
  type: SessionType;
  createdAt: string;
  updatedAt: string;
  referenceImages: string[]; // Base64 data URL 배열
  analysis: ImageAnalysisResult;
  koreanAnalysis?: KoreanAnalysisCache; // 번역된 결과 캐시
  imageCount: number; // 참조 이미지 개수
  generationHistory?: GenerationHistoryEntry[]; // 생성 히스토리 (선택)
}

// 생성 히스토리 엔트리
export interface GenerationHistoryEntry {
  id: string; // UUID
  timestamp: string; // ISO 8601
  prompt: string; // 사용된 프롬프트
  negativePrompt?: string; // 사용된 네거티브 프롬프트
  additionalPrompt?: string; // 추가 포즈/동작 프롬프트 (원본 한글 또는 영어)
  imageBase64: string; // 생성된 이미지 (Base64)
  settings: GenerationSettings; // 사용된 설정
}

// 생성 설정
export interface GenerationSettings {
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  imageSize: '1K' | '2K' | '4K';
  seed?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  referenceStrength?: number; // 참조 이미지 영향력 (0.0 ~ 1.0)
  useReferenceImages: boolean;
}
