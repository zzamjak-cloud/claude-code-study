// 특이사항 관리 슬라이스

import { SpecialEvent } from '../../types/event'

export interface EventSlice {
  // 상태
  events: SpecialEvent[]

  // 메서드
  setEvents: (events: SpecialEvent[]) => void
  addEvent: (event: SpecialEvent) => void
  updateEvent: (eventId: string, updates: Partial<SpecialEvent>) => void
  deleteEvent: (eventId: string) => void
  getEventsByDate: (date: Date) => SpecialEvent[]
}

export const createEventSlice = (set: any, get: any): EventSlice => ({
  // 초기 상태
  events: [],

  // 특이사항 목록 설정 (Firebase 동기화용)
  setEvents: (events) => set({ events }),

  // 특이사항 추가
  addEvent: (event) =>
    set((state) => ({
      events: [...state.events, event],
    })),

  // 특이사항 업데이트
  updateEvent: (eventId, updates) =>
    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId ? { ...e, ...updates } : e
      ),
    })),

  // 특이사항 삭제
  deleteEvent: (eventId) =>
    set((state) => ({
      events: state.events.filter((e) => e.id !== eventId),
    })),

  // 특정 날짜의 특이사항 가져오기
  getEventsByDate: (date) => {
    const state = get()
    const targetDate = new Date(date).setHours(0, 0, 0, 0)

    return state.events.filter((e) => {
      const eventDate = new Date(e.date).setHours(0, 0, 0, 0)
      return eventDate === targetDate
    })
  },
})
