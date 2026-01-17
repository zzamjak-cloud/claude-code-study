// 글로벌 특이사항 관리 슬라이스

import { GlobalEvent } from '../../types/globalEvent'

export interface GlobalEventSlice {
  // 상태
  globalEvents: GlobalEvent[]
  globalEventRowCount: number

  // 메서드
  setGlobalEvents: (events: GlobalEvent[]) => void
  setGlobalEventRowCount: (count: number) => void
  addGlobalEvent: (event: GlobalEvent) => void
  updateGlobalEvent: (id: string, updates: Partial<GlobalEvent>) => void
  deleteGlobalEvent: (id: string) => void
}

export const createGlobalEventSlice = (set: any): GlobalEventSlice => ({
  // 초기 상태
  globalEvents: [],
  globalEventRowCount: 1,

  // 글로벌 이벤트 목록 설정 (Firebase 동기화용)
  setGlobalEvents: (events) => set({ globalEvents: events }),

  // 행 개수 설정
  setGlobalEventRowCount: (count) => set({ globalEventRowCount: count }),

  // 글로벌 이벤트 추가
  addGlobalEvent: (event) =>
    set((state: GlobalEventSlice) => ({
      globalEvents: [...state.globalEvents, event],
    })),

  // 글로벌 이벤트 업데이트
  updateGlobalEvent: (id, updates) =>
    set((state: GlobalEventSlice) => ({
      globalEvents: state.globalEvents.map((event) =>
        event.id === id ? { ...event, ...updates } : event
      ),
    })),

  // 글로벌 이벤트 삭제
  deleteGlobalEvent: (id) =>
    set((state: GlobalEventSlice) => ({
      globalEvents: state.globalEvents.filter((event) => event.id !== id),
    })),
})
