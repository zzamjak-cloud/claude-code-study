// 뷰 상태 슬라이스

import { DEFAULT_ZOOM } from '../../lib/constants/grid'

export interface ViewSlice {
  // 줌 레벨 (1.0 = 기본, 0.5 = 축소, 2.0 = 확대)
  zoomLevel: number

  // 필터링
  dateRange: {
    start: Date | null
    end: Date | null
  }

  // 스크롤 위치
  scrollOffset: number

  // 현재 연도
  currentYear: number

  // 메서드
  setZoomLevel: (level: number) => void
  setDateRange: (start: Date | null, end: Date | null) => void
  setScrollOffset: (offset: number) => void
  setCurrentYear: (year: number) => void
  resetFilters: () => void
}

export const createViewSlice = (set: any): ViewSlice => ({
  // 초기 상태
  zoomLevel: DEFAULT_ZOOM,
  dateRange: {
    start: null,
    end: null,
  },
  scrollOffset: 0,
  currentYear: new Date().getFullYear(),

  // 줌 레벨 설정
  setZoomLevel: (level) => set({ zoomLevel: level }),

  // 날짜 범위 설정
  setDateRange: (start, end) =>
    set({
      dateRange: { start, end },
    }),

  // 스크롤 위치 설정
  setScrollOffset: (offset) => set({ scrollOffset: offset }),

  // 현재 연도 설정
  setCurrentYear: (year) => set({ currentYear: year }),

  // 필터 초기화
  resetFilters: () =>
    set({
      dateRange: { start: null, end: null },
      zoomLevel: DEFAULT_ZOOM,
    }),
})
