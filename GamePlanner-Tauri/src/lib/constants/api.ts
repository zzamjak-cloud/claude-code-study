// API 관련 상수

export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export const GEMINI_MODELS = {
  FLASH: 'gemini-2.5-flash',
  FLASH_EXP: 'gemini-2.0-flash-exp',
  PRO: 'gemini-2.0-pro',
} as const

export const GEMINI_GENERATION_CONFIG = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 8192,
} as const

export const CHAT_HISTORY_LIMIT = 10 // 최근 대화 히스토리 개수

