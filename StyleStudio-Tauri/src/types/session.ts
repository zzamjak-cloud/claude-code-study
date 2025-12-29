import { ImageAnalysisResult } from './analysis';

export type SessionType = 'STYLE' | 'CHARACTER';

export interface Session {
  id: string;
  name: string;
  type: SessionType;
  createdAt: string;
  updatedAt: string;
  referenceImages: string[]; // Base64 data URL 배열
  analysis: ImageAnalysisResult;
  imageCount: number; // 참조 이미지 개수
}
