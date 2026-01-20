// 글로벌 특이사항 관리 슬라이스

import { GlobalEvent } from '../../types/globalEvent'

export interface GlobalEventSlice {
  // 상태
  globalEvents: GlobalEvent[]
  globalEventRowCounts: Record<string, number>  // 프로젝트별 행 개수 (키: projectId 또는 'default')

  // 메서드
  setGlobalEvents: (events: GlobalEvent[]) => void
  setGlobalEventRowCounts: (rowCounts: Record<string, number>) => void
  setGlobalEventRowCount: (projectId: string | null, count: number) => void
  addGlobalEvent: (event: GlobalEvent) => void
  updateGlobalEvent: (id: string, updates: Partial<GlobalEvent>) => void
  deleteGlobalEvent: (id: string) => void
}

export const createGlobalEventSlice = (set: any): GlobalEventSlice => ({
  // 초기 상태
  globalEvents: [],
  globalEventRowCounts: { default: 1 },  // 기본값

  // 글로벌 이벤트 목록 설정 (Firebase 동기화용)
  setGlobalEvents: (events) => set({ globalEvents: events }),

  // 전체 행 개수 설정 (Firebase 동기화용)
  setGlobalEventRowCounts: (rowCounts) => set({ globalEventRowCounts: rowCounts }),

  // 특정 프로젝트의 행 개수 설정
  setGlobalEventRowCount: (projectId, count) =>
    set((state: GlobalEventSlice) => ({
      globalEventRowCounts: {
        ...state.globalEventRowCounts,
        [projectId || 'default']: count,
      },
    })),

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
