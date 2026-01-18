// 글로벌 공지 슬라이스

import { GlobalNotice } from '../../types/globalNotice'

export interface GlobalNoticeSlice {
  // 상태
  globalNotices: GlobalNotice[]

  // 메서드
  setGlobalNotices: (notices: GlobalNotice[]) => void
  addGlobalNotice: (notice: GlobalNotice) => void
  updateGlobalNotice: (id: string, updates: Partial<GlobalNotice>) => void
  deleteGlobalNotice: (id: string) => void
  reorderGlobalNotices: (notices: GlobalNotice[]) => void
}

export const createGlobalNoticeSlice = (set: any): GlobalNoticeSlice => ({
  // 초기 상태
  globalNotices: [],

  // 공지 목록 설정 (Firebase 동기화용)
  setGlobalNotices: (notices) => set({ globalNotices: notices }),

  // 공지 추가
  addGlobalNotice: (notice) =>
    set((state: GlobalNoticeSlice) => ({
      globalNotices: [...state.globalNotices, notice],
    })),

  // 공지 수정
  updateGlobalNotice: (id, updates) =>
    set((state: GlobalNoticeSlice) => ({
      globalNotices: state.globalNotices.map((n) =>
        n.id === id ? { ...n, ...updates } : n
      ),
    })),

  // 공지 삭제
  deleteGlobalNotice: (id) =>
    set((state: GlobalNoticeSlice) => ({
      globalNotices: state.globalNotices.filter((n) => n.id !== id),
    })),

  // 공지 순서 변경
  reorderGlobalNotices: (notices) => set({ globalNotices: notices }),
})
