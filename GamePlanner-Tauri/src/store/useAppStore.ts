import { create } from 'zustand'
import { PromptTemplate } from '../types/promptTemplate'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

// 세션 타입 정의
export enum SessionType {
  PLANNING = 'planning',  // 기획 세션
  ANALYSIS = 'analysis',  // 분석 세션
}

export interface ChatSession {
  id: string
  type: SessionType  // 세션 타입 추가
  title: string
  messages: Message[]
  markdownContent: string
  createdAt: number
  updatedAt: number

  // 분석 세션 전용 필드 (optional)
  gameName?: string
  notionPageUrl?: string
  analysisStatus?: 'pending' | 'running' | 'completed' | 'failed'

  // 템플릿 연동 (신규)
  templateId?: string  // 이 세션에 사용된 템플릿 ID
}

interface AppState {
  // 현재 세션
  currentSessionId: string | null
  sessions: ChatSession[]
  currentSessionType: SessionType  // 현재 탭 타입

  // 레거시 (현재 세션에서 사용)
  messages: Message[]
  markdownContent: string

  // 앱 설정
  apiKey: string | null
  notionApiKey: string | null
  notionPlanningDatabaseId: string | null  // 기획서 DB
  notionAnalysisDatabaseId: string | null  // 분석 DB
  isLoading: boolean

  // 템플릿 관리 (신규)
  templates: PromptTemplate[]
  currentPlanningTemplateId: string | null
  currentAnalysisTemplateId: string | null

  // 세션 관리
  createNewSession: (templateId?: string) => string
  loadSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  updateCurrentSession: () => void
  getSessions: () => ChatSession[]
  importSession: (session: ChatSession) => void

  // 메시지 관리
  addMessage: (message: Message) => void
  setMarkdownContent: (content: string) => void
  clearMessages: () => void

  // 앱 설정
  setApiKey: (key: string | null) => void
  setNotionApiKey: (key: string | null) => void
  setNotionPlanningDatabaseId: (id: string | null) => void
  setNotionAnalysisDatabaseId: (id: string | null) => void
  setIsLoading: (loading: boolean) => void

  // 세션 타입 관리
  setCurrentSessionType: (type: SessionType) => void

  // 분석 세션 관리
  createAnalysisSession: (gameName: string) => string
  updateAnalysisStatus: (sessionId: string, status: string, notionUrl?: string) => void
  convertAnalysisToPlanning: (analysisSessionId: string) => string

  // 템플릿 관리 (신규)
  addTemplate: (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTemplate: (id: string, updates: Partial<PromptTemplate>) => void
  deleteTemplate: (id: string) => void
  setCurrentPlanningTemplate: (id: string) => void
  setCurrentAnalysisTemplate: (id: string) => void
  getTemplateById: (id: string) => PromptTemplate | undefined
  getTemplatesByType: (type: string) => PromptTemplate[]
}

export const useAppStore = create<AppState>((set, get) => ({
  // 초기 상태
  currentSessionId: null,
  sessions: [],
  currentSessionType: SessionType.PLANNING,  // 기본값: 기획 탭
  messages: [],
  markdownContent: '',
  apiKey: null,
  notionApiKey: null,
  notionPlanningDatabaseId: null,
  notionAnalysisDatabaseId: null,
  isLoading: false,

  // 템플릿 초기 상태
  templates: [],
  currentPlanningTemplateId: 'default-planning',
  currentAnalysisTemplateId: 'default-analysis',

  // 새 세션 생성
  createNewSession: (customTemplateId?: string) => {
    const state = get()
    console.log('🆕 새 세션 생성 시작 - 현재 세션 타입:', state.currentSessionType)

    // 템플릿 ID 결정: 파라미터로 전달된 ID > 현재 선택된 템플릿 ID
    const templateId = customTemplateId || (
      state.currentSessionType === SessionType.PLANNING
        ? state.currentPlanningTemplateId
        : state.currentAnalysisTemplateId
    )

    const newSession: ChatSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: state.currentSessionType,  // 현재 탭 타입에 따라 생성
      title: state.currentSessionType === SessionType.PLANNING ? '기획서 초안' : '게임 분석 초안',
      messages: [],
      markdownContent: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      templateId: templateId || undefined,  // 템플릿 ID 할당
    }

    console.log('✅ 새 세션 생성 완료:', {
      id: newSession.id,
      type: newSession.type,
      title: newSession.title,
      templateId: newSession.templateId
    })

    set((state) => ({
      sessions: [...state.sessions, newSession],
      currentSessionId: newSession.id,
      messages: [],
      markdownContent: '',
    }))

    return newSession.id
  },

  // 세션 로드
  loadSession: (sessionId: string) => {
    const state = get()
    const session = state.sessions.find((s) => s.id === sessionId)

    if (session) {
      console.log('📂 세션 로드:', {
        id: session.id,
        type: session.type,
        title: session.title
      })
      set({
        currentSessionId: sessionId,
        currentSessionType: session.type, // 세션의 타입으로 currentSessionType 업데이트
        messages: session.messages,
        markdownContent: session.markdownContent,
      })
    }
  },

  // 세션 삭제
  deleteSession: (sessionId: string) => {
    set((state) => {
      const newSessions = state.sessions.filter((s) => s.id !== sessionId)
      const isCurrentSession = state.currentSessionId === sessionId

      return {
        sessions: newSessions,
        currentSessionId: isCurrentSession ? (newSessions[0]?.id || null) : state.currentSessionId,
        messages: isCurrentSession ? (newSessions[0]?.messages || []) : state.messages,
        markdownContent: isCurrentSession ? (newSessions[0]?.markdownContent || '') : state.markdownContent,
      }
    })
  },

  // 현재 세션 업데이트
  updateCurrentSession: () => {
    const state = get()
    if (!state.currentSessionId) return

    set((prevState) => {
      const updatedSessions = prevState.sessions.map((session) => {
        if (session.id === prevState.currentSessionId) {
          let title = session.title

          // 마크다운에서 게임명 추출
          if (prevState.markdownContent) {
            if (session.type === SessionType.PLANNING) {
              // 기획서: "🎮 **게임명 게임 기획서**" 패턴에서 게임명 추출
              const gameNameMatch = prevState.markdownContent.match(/^🎮\s*\*\*(.+?)\s*게임\s*기획서\*\*/m)
              if (gameNameMatch) {
                title = gameNameMatch[1].trim()
                console.log('✅ 세션 제목 업데이트:', title)
              } else {
                console.log('⚠️ 기획서 제목 추출 실패, 현재 제목 유지:', title)
              }
            } else if (session.type === SessionType.ANALYSIS) {
              // 분석 보고서: "<!-- ANALYSIS_TITLE: 게임명 게임 분석 보고서 -->" 패턴에서 게임명 추출
              const titleMatch = prevState.markdownContent.match(/<!--\s*ANALYSIS_TITLE:\s*(.+?)\s*게임\s*분석\s*보고서\s*-->/m)
              if (titleMatch) {
                title = titleMatch[1].trim()
                console.log('✅ 세션 제목 업데이트:', title)
              } else {
                console.log('⚠️ 분석 보고서 제목 추출 실패, 현재 제목 유지:', title)
              }
            }
          }

          return {
            ...session,
            title,
            messages: prevState.messages,
            markdownContent: prevState.markdownContent,
            updatedAt: Date.now(),
          }
        }
        return session
      })

      return { sessions: updatedSessions }
    })
  },

  // 세션 목록 가져오기
  getSessions: () => {
    return get().sessions
  },

  // 세션 불러오기 (파일에서)
  importSession: (importedSession: ChatSession) => {
    // 새 ID 생성 (중복 방지)
    const newSession: ChatSession = {
      ...importedSession,
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      updatedAt: Date.now(),
    }

    console.log('📥 세션 불러오기:', {
      id: newSession.id,
      type: newSession.type,
      title: newSession.title
    })

    set((state) => ({
      sessions: [...state.sessions, newSession],
      currentSessionId: newSession.id,
      currentSessionType: newSession.type, // 불러온 세션의 타입으로 업데이트
      messages: newSession.messages,
      markdownContent: newSession.markdownContent,
    }))
  },

  // 메시지 추가
  addMessage: (message) => {
    set((state) => ({ messages: [...state.messages, message] }))
    get().updateCurrentSession()
  },

  // 마크다운 설정
  setMarkdownContent: (content) => {
    set({ markdownContent: content })
    get().updateCurrentSession()
  },

  // 메시지 초기화
  clearMessages: () => {
    set({ messages: [], markdownContent: '' })
    get().updateCurrentSession()
  },

  // API Key 설정
  setApiKey: (key) => set({ apiKey: key }),

  // Notion API Key 설정
  setNotionApiKey: (key) => set({ notionApiKey: key }),

  // Notion Database ID 설정 (기획서 DB)
  setNotionPlanningDatabaseId: (id) => set({ notionPlanningDatabaseId: id }),

  // Notion Database ID 설정 (분석 DB)
  setNotionAnalysisDatabaseId: (id) => set({ notionAnalysisDatabaseId: id }),

  // 로딩 상태
  setIsLoading: (loading) => set({ isLoading: loading }),

  // 세션 타입 변경
  setCurrentSessionType: (type) => set({ currentSessionType: type }),

  // 분석 세션 생성
  createAnalysisSession: (gameName: string) => {
    const state = get()
    const newSession: ChatSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: SessionType.ANALYSIS,
      title: `${gameName} 분석`,
      messages: [],
      markdownContent: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      gameName,
      analysisStatus: 'pending',
      templateId: state.currentAnalysisTemplateId || 'default-analysis',  // 템플릿 ID 할당
    }

    set((state) => ({
      sessions: [...state.sessions, newSession],
      currentSessionId: newSession.id,
      messages: [],
      markdownContent: '',
    }))

    return newSession.id
  },

  // 분석 상태 업데이트
  updateAnalysisStatus: (sessionId: string, status: string, notionUrl?: string) => {
    set((state) => ({
      sessions: state.sessions.map((session) => {
        if (session.id === sessionId) {
          return {
            ...session,
            analysisStatus: status as 'pending' | 'running' | 'completed' | 'failed',
            notionPageUrl: notionUrl || session.notionPageUrl,
            updatedAt: Date.now(),
          }
        }
        return session
      }),
    }))
  },

  // 분석 세션을 기획 세션으로 변환
  convertAnalysisToPlanning: (analysisSessionId: string) => {
    const state = get()
    const analysisSession = state.sessions.find(s => s.id === analysisSessionId)

    if (!analysisSession) {
      throw new Error('분석 세션을 찾을 수 없습니다.')
    }

    const newSession: ChatSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: SessionType.PLANNING,
      title: `${analysisSession.gameName || '새로운'} 게임 기획`,
      messages: [{
        role: 'user',
        content: `"${analysisSession.gameName}" 게임을 분석했습니다.\n\n${analysisSession.notionPageUrl ? `분석 결과: ${analysisSession.notionPageUrl}\n\n` : ''}${analysisSession.markdownContent ? `\n\n분석 내용:\n${analysisSession.markdownContent}\n\n` : ''}이 분석을 참고하여 유사한 장르의 신규 게임 기획서를 작성해주세요.`
      }],
      markdownContent: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      templateId: state.currentPlanningTemplateId || 'default-planning',  // 템플릿 ID 할당
    }

    set((state) => ({
      sessions: [...state.sessions, newSession],
      currentSessionId: newSession.id,
      currentSessionType: SessionType.PLANNING,
      messages: newSession.messages,
      markdownContent: '',
    }))

    return newSession.id
  },

  // ============ 템플릿 관리 메서드 (신규) ============

  // 템플릿 추가
  addTemplate: (template) => {
    const newTemplate: PromptTemplate = {
      ...template,
      id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((state) => ({
      templates: [...state.templates, newTemplate]
    }))
    console.log('✅ 템플릿 추가:', newTemplate.name)
  },

  // 템플릿 수정
  updateTemplate: (id, updates) => {
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
      )
    }))
    console.log('✅ 템플릿 수정:', id)
  },

  // 템플릿 삭제
  deleteTemplate: (id) => {
    const state = get()
    const template = state.templates.find(t => t.id === id)

    if (template?.isDefault) {
      throw new Error('기본 템플릿은 삭제할 수 없습니다.')
    }

    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id)
    }))
    console.log('✅ 템플릿 삭제:', id)
  },

  // 현재 기획 템플릿 설정
  setCurrentPlanningTemplate: (id) => {
    set({ currentPlanningTemplateId: id })
    console.log('✅ 현재 기획 템플릿 설정:', id)
  },

  // 현재 분석 템플릿 설정
  setCurrentAnalysisTemplate: (id) => {
    set({ currentAnalysisTemplateId: id })
    console.log('✅ 현재 분석 템플릿 설정:', id)
  },

  // ID로 템플릿 가져오기
  getTemplateById: (id) => {
    const state = get()
    return state.templates.find((t) => t.id === id)
  },

  // 타입별 템플릿 목록 가져오기
  getTemplatesByType: (type) => {
    const state = get()
    return state.templates.filter((t) => t.type === type)
  },
}))
