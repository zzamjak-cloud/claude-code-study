// 인증 상태 슬라이스

import { User } from '../../types/store'

export interface AuthSlice {
  // 상태
  currentUser: User | null
  workspaceId: string | null
  isAdmin: boolean
  isLoading: boolean

  // 메서드
  setCurrentUser: (user: User | null) => void
  setWorkspace: (workspaceId: string | null, isAdmin: boolean) => void
  setLoading: (isLoading: boolean) => void
  logout: () => void
}

export const createAuthSlice = (set: any): AuthSlice => ({
  // 초기 상태
  currentUser: null,
  workspaceId: null,
  isAdmin: false,
  isLoading: true,

  // 현재 사용자 설정
  setCurrentUser: (user) => set({ currentUser: user }),

  // 워크스페이스 설정
  setWorkspace: (workspaceId, isAdmin) =>
    set({
      workspaceId,
      isAdmin,
    }),

  // 로딩 상태 설정
  setLoading: (isLoading) => set({ isLoading }),

  // 로그아웃
  logout: () =>
    set({
      currentUser: null,
      workspaceId: null,
      isAdmin: false,
    }),
})
