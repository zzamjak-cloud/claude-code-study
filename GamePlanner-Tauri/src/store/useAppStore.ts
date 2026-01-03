// 메인 스토어 - 슬라이스 통합

import { create } from 'zustand'
import { createSessionSlice, SessionSlice } from './slices/sessionSlice'
import { createTemplateSlice, TemplateSlice } from './slices/templateSlice'
import { createSettingsSlice, SettingsSlice } from './slices/settingsSlice'
import { createUiSlice, UiSlice } from './slices/uiSlice'

// 공통 타입 export
export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export enum SessionType {
  PLANNING = 'planning',
  ANALYSIS = 'analysis',
}

export interface ChatSession {
  id: string
  type: SessionType
  title: string
  messages: Message[]
  markdownContent: string
  createdAt: number
  updatedAt: number

  // 분석 세션 전용 필드 (optional)
  gameName?: string
  notionPageUrl?: string
  analysisStatus?: 'pending' | 'running' | 'completed' | 'failed'

  // 템플릿 연동
  templateId?: string
}

// 통합된 App State 타입
export type AppState = SessionSlice & TemplateSlice & SettingsSlice & UiSlice

// 스토어 생성
export const useAppStore = create<AppState>()((...a) => ({
  ...createSessionSlice(...a),
  ...createTemplateSlice(...a),
  ...createSettingsSlice(...a),
  ...createUiSlice(...a),
}))
