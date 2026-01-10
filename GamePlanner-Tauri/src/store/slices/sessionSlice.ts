// 세션 관리 슬라이스

import { StateCreator } from 'zustand'
import { SessionType, ChatSession, Message } from '../useAppStore'
import { generateSessionId, generateSessionTitle, getDefaultTemplateId } from '../../lib/utils/session'
import { devLog } from '../../lib/utils/logger'

export interface SessionSlice {
  // 세션 상태
  currentSessionId: string | null
  sessions: ChatSession[]
  currentSessionType: SessionType

  // 레거시 상태 (세션과 중복)
  messages: Message[]
  markdownContent: string

  // 세션 관리 메서드
  createNewSession: (templateId?: string, customTitle?: string) => string
  loadSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  updateCurrentSession: () => void
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => void
  getSessions: () => ChatSession[]
  importSession: (session: ChatSession) => void
  reorderSessions: (reorderedSessions: ChatSession[]) => void

  // 메시지 관리
  addMessage: (message: Message) => void
  setMarkdownContent: (content: string) => void
  clearMessages: () => void

  // 분석 세션 관리
  createAnalysisSession: (gameName: string) => string
  updateAnalysisStatus: (sessionId: string, status: string, notionUrl?: string) => void
  convertAnalysisToPlanning: (analysisSessionId: string) => string

  // 버전 관리 (Phase 1)
  createVersion: (sessionId: string, description?: string) => string
  restoreVersion: (sessionId: string, versionId: string) => void
  deleteVersion: (sessionId: string, versionId: string) => void
  getVersions: (sessionId: string) => import('../../types/version').DocumentVersion[]
  compareVersions: (sessionId: string, versionId1: string, versionId2: string) => import('../../types/version').VersionDiff | null
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
  createNewSession: (customTemplateId?: string, customTitle?: string) => {
    const state = get()
    devLog.log('🆕 새 세션 생성:', state.currentSessionType)

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
      title: customTitle || generateSessionTitle(state.currentSessionType),
      messages: [],
      markdownContent: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      templateId: templateId || undefined,
    }

    devLog.log('✅ 세션 생성:', newSession.title)

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
      devLog.log('📂 세션 로드:', session.title)
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

      if (!isCurrentSession) {
        // 다른 세션을 삭제한 경우, 상태 변경 없음
        return { sessions: newSessions }
      }

      // 현재 세션을 삭제한 경우, 같은 타입의 세션 중 가장 최근 세션 선택
      const sameTypeSessions = newSessions
        .filter((s) => s.type === state.currentSessionType)
        .sort((a, b) => b.updatedAt - a.updatedAt)

      const nextSession = sameTypeSessions[0] || null

      return {
        sessions: newSessions,
        currentSessionId: nextSession?.id || null,
        messages: nextSession?.messages || [],
        markdownContent: nextSession?.markdownContent || '',
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
          // 제목은 자동 변경하지 않고 그대로 유지
          return {
            ...session,
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

  // 세션 업데이트
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => {
    set((state) => ({
      sessions: state.sessions.map((session) => {
        if (session.id === sessionId) {
          return {
            ...session,
            ...updates,
            updatedAt: Date.now(),
          }
        }
        return session
      }),
    }))
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

    devLog.log('📥 세션 불러오기:', newSession.title)

    set((state) => ({
      sessions: [...state.sessions, newSession],
      currentSessionId: newSession.id,
      currentSessionType: newSession.type,
      messages: newSession.messages,
      markdownContent: newSession.markdownContent,
    }))
  },

  // 세션 순서 변경
  reorderSessions: (reorderedSessions: ChatSession[]) => {
    devLog.log('🔄 세션 순서 변경')
    set({ sessions: reorderedSessions })
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

  // 버전 생성
  createVersion: (sessionId: string, description?: string) => {
    const state = get()
    const session = state.sessions.find(s => s.id === sessionId)
    if (!session) {
      throw new Error('세션을 찾을 수 없습니다.')
    }

    const versions = session.versions || []
    const currentVersionNumber = session.currentVersionNumber || 0
    const newVersionNumber = currentVersionNumber + 1

    const newVersion: import('../../types/version').DocumentVersion = {
      id: `version-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      versionNumber: newVersionNumber,
      markdownContent: session.markdownContent,
      messages: [...session.messages],
      createdAt: Date.now(),
      createdBy: 'user',
      description,
    }

    set((state) => ({
      sessions: state.sessions.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            versions: [...versions, newVersion],
            currentVersionNumber: newVersionNumber,
          }
        }
        return s
      }),
    }))

    devLog.log('📸 버전 생성:', `v${newVersionNumber}${description ? ` - ${description}` : ''}`)

    return newVersion.id
  },

  // 버전 복원
  restoreVersion: (sessionId: string, versionId: string) => {
    const state = get()
    const session = state.sessions.find(s => s.id === sessionId)
    if (!session || !session.versions) {
      throw new Error('세션 또는 버전을 찾을 수 없습니다.')
    }

    const version = session.versions.find(v => v.id === versionId)
    if (!version) {
      throw new Error('버전을 찾을 수 없습니다.')
    }

    // 현재 상태를 새 버전으로 저장 (복원 전 백업)
    const currentVersionNumber = session.currentVersionNumber || 0
    const backupVersion: import('../../types/version').DocumentVersion = {
      id: `version-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      versionNumber: currentVersionNumber,
      markdownContent: session.markdownContent,
      messages: [...session.messages],
      createdAt: Date.now(),
      createdBy: 'user',
      description: '복원 전 자동 백업',
    }

    set((state) => {
      const updatedSessions = state.sessions.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            markdownContent: version.markdownContent,
            messages: [...version.messages],
            versions: [...(s.versions || []), backupVersion],
            updatedAt: Date.now(),
          }
        }
        return s
      })

      // 현재 세션이면 상태도 업데이트
      if (state.currentSessionId === sessionId) {
        return {
          sessions: updatedSessions,
          messages: [...version.messages],
          markdownContent: version.markdownContent,
        }
      }

      return { sessions: updatedSessions }
    })

    devLog.log('🔄 버전 복원:', `v${version.versionNumber}`)
  },

  // 버전 삭제
  deleteVersion: (sessionId: string, versionId: string) => {
    const state = get()
    const session = state.sessions.find(s => s.id === sessionId)
    if (!session || !session.versions) {
      throw new Error('세션 또는 버전을 찾을 수 없습니다.')
    }

    const version = session.versions.find(v => v.id === versionId)
    if (!version) {
      throw new Error('버전을 찾을 수 없습니다.')
    }

    set((state) => ({
      sessions: state.sessions.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            versions: s.versions?.filter(v => v.id !== versionId) || [],
          }
        }
        return s
      }),
    }))

    devLog.log('🗑️ 버전 삭제:', `v${version.versionNumber}`)
  },

  // 버전 목록 가져오기
  getVersions: (sessionId: string) => {
    const state = get()
    const session = state.sessions.find(s => s.id === sessionId)
    return session?.versions || []
  },

  // 버전 비교
  compareVersions: (sessionId: string, versionId1: string, versionId2: string) => {
    const state = get()
    const session = state.sessions.find(s => s.id === sessionId)
    if (!session || !session.versions) {
      return null
    }

    const version1 = session.versions.find(v => v.id === versionId1)
    const version2 = session.versions.find(v => v.id === versionId2)

    if (!version1 || !version2) {
      return null
    }

    // 간단한 텍스트 비교 (실제로는 더 정교한 diff 알고리즘 사용 가능)
    const content1 = version1.markdownContent
    const content2 = version2.markdownContent

    // 섹션 추출 (간단한 구현)
    const extractSections = (content: string) => {
      const sections: string[] = []
      const lines = content.split('\n')
      let currentSection = ''
      for (const line of lines) {
        if (line.startsWith('# ')) {
          if (currentSection) sections.push(currentSection.trim())
          currentSection = line + '\n'
        } else {
          currentSection += line + '\n'
        }
      }
      if (currentSection) sections.push(currentSection.trim())
      return sections
    }

    const sections1 = extractSections(content1)
    const sections2 = extractSections(content2)

    const added: string[] = []
    const removed: string[] = []
    const modified: Array<{ section: string; before: string; after: string }> = []

    // 간단한 비교 로직
    const sectionMap1 = new Map<string, string>()
    const sectionMap2 = new Map<string, string>()

    sections1.forEach(section => {
      const title = section.split('\n')[0] || ''
      sectionMap1.set(title, section)
    })

    sections2.forEach(section => {
      const title = section.split('\n')[0] || ''
      sectionMap2.set(title, section)
    })

    // 추가된 섹션
    sectionMap2.forEach((_content, title) => {
      if (!sectionMap1.has(title)) {
        added.push(title)
      }
    })

    // 삭제된 섹션
    sectionMap1.forEach((_content, title) => {
      if (!sectionMap2.has(title)) {
        removed.push(title)
      }
    })

    // 수정된 섹션
    sectionMap1.forEach((content1, title) => {
      const content2 = sectionMap2.get(title)
      if (content2 && content1 !== content2) {
        modified.push({
          section: title,
          before: content1,
          after: content2,
        })
      }
    })

    return {
      added,
      removed,
      modified,
    }
  },
})

