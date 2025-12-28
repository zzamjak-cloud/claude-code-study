import { create } from 'zustand'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  markdownContent: string
  createdAt: number
  updatedAt: number
}

interface AppState {
  // 현재 세션
  currentSessionId: string | null
  sessions: ChatSession[]

  // 레거시 (현재 세션에서 사용)
  messages: Message[]
  markdownContent: string

  // 앱 설정
  apiKey: string | null
  isLoading: boolean

  // 세션 관리
  createNewSession: () => string
  loadSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  updateCurrentSession: () => void
  getSessions: () => ChatSession[]

  // 메시지 관리
  addMessage: (message: Message) => void
  setMarkdownContent: (content: string) => void
  clearMessages: () => void

  // 앱 설정
  setApiKey: (key: string | null) => void
  setIsLoading: (loading: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // 초기 상태
  currentSessionId: null,
  sessions: [],
  messages: [],
  markdownContent: '',
  apiKey: null,
  isLoading: false,

  // 새 세션 생성
  createNewSession: () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: '새 게임 기획',
      messages: [],
      markdownContent: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

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
      set({
        currentSessionId: sessionId,
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
          // 제목 자동 생성 (첫 사용자 메시지 또는 마크다운 제목)
          let title = session.title
          if (prevState.messages.length > 0 && session.title === '새 게임 기획') {
            const firstUserMessage = prevState.messages.find((m) => m.role === 'user')
            if (firstUserMessage) {
              title = firstUserMessage.content.substring(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '')
            }

            // 마크다운에서 게임명 추출
            const gameNameMatch = prevState.markdownContent.match(/^#\s*🎮\s*(.+?)\s*게임\s*기획서/m)
            if (gameNameMatch) {
              title = gameNameMatch[1].trim()
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

  // 로딩 상태
  setIsLoading: (loading) => set({ isLoading: loading }),
}))
