// 세션 관리 슬라이스

import { StateCreator } from 'zustand'
import { SessionType, ChatSession, Message } from '../useAppStore'
import { extractGameNameFromPlanning, extractGameNameFromAnalysis } from '../../lib/utils/markdown'
import { generateSessionId, generateSessionTitle, getDefaultTemplateId } from '../../lib/utils/session'

export interface SessionSlice {
  // 세션 상태
  currentSessionId: string | null
  sessions: ChatSession[]
  currentSessionType: SessionType

  // 레거시 상태 (세션과 중복)
  messages: Message[]
  markdownContent: string

  // 세션 관리 메서드
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

  // 분석 세션 관리
  createAnalysisSession: (gameName: string) => string
  updateAnalysisStatus: (sessionId: string, status: string, notionUrl?: string) => void
  convertAnalysisToPlanning: (analysisSessionId: string) => string
}

export const createSessionSlice: StateCreator<
  SessionSlice,
  [],
  [],
  SessionSlice
> = (set, get) => ({
  // 초기 상태
  currentSessionId: null,
  sessions: [],
  currentSessionType: SessionType.PLANNING,
  messages: [],
  markdownContent: '',

  // 새 세션 생성
  createNewSession: (customTemplateId?: string) => {
    const state = get()
    console.log('🆕 새 세션 생성 시작 - 현재 세션 타입:', state.currentSessionType)

    // 템플릿 ID 결정: 파라미터로 전달된 ID > 현재 선택된 템플릿 ID
    const fullState = state as SessionSlice & { currentPlanningTemplateId: string | null; currentAnalysisTemplateId: string | null }
    const templateId = customTemplateId || (
      state.currentSessionType === SessionType.PLANNING
        ? fullState.currentPlanningTemplateId
        : fullState.currentAnalysisTemplateId
    ) || getDefaultTemplateId({ type: state.currentSessionType } as ChatSession)

    const newSession: ChatSession = {
      id: generateSessionId(),
      type: state.currentSessionType,
      title: generateSessionTitle(state.currentSessionType),
      messages: [],
      markdownContent: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      templateId: templateId || undefined,
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
        currentSessionType: session.type,
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
              const extractedName = extractGameNameFromPlanning(prevState.markdownContent)
              if (extractedName) {
                title = extractedName
                console.log('✅ 세션 제목 업데이트:', title)
              } else {
                console.log('⚠️ 기획서 제목 추출 실패, 현재 제목 유지:', title)
              }
            } else if (session.type === SessionType.ANALYSIS) {
              const extractedName = extractGameNameFromAnalysis(prevState.markdownContent)
              if (extractedName) {
                title = extractedName
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
      id: generateSessionId(),
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
      currentSessionType: newSession.type,
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

  // 분석 세션 생성
  createAnalysisSession: (gameName: string) => {
    const state = get()
    const newSession: ChatSession = {
      id: generateSessionId(),
      type: SessionType.ANALYSIS,
      title: generateSessionTitle(SessionType.ANALYSIS, gameName),
      messages: [],
      markdownContent: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      gameName,
      analysisStatus: 'pending',
      templateId: (state as SessionSlice & { currentAnalysisTemplateId: string | null }).currentAnalysisTemplateId || 'default-analysis',
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
      id: generateSessionId(),
      type: SessionType.PLANNING,
      title: generateSessionTitle(SessionType.PLANNING, analysisSession.gameName),
      messages: [{
        role: 'user',
        content: `"${analysisSession.gameName}" 게임을 분석했습니다.\n\n${analysisSession.notionPageUrl ? `분석 결과: ${analysisSession.notionPageUrl}\n\n` : ''}${analysisSession.markdownContent ? `\n\n분석 내용:\n${analysisSession.markdownContent}\n\n` : ''}이 분석을 참고하여 유사한 장르의 신규 게임 기획서를 작성해주세요.`
      }],
      markdownContent: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      templateId: (state as SessionSlice & { currentPlanningTemplateId: string | null }).currentPlanningTemplateId || 'default-planning',
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
})

