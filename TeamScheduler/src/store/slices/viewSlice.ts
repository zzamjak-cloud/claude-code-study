// 뷰 상태 슬라이스

import { DEFAULT_ZOOM } from '../../lib/constants/grid'
import { DEFAULT_SCHEDULE_COLOR, DEFAULT_WEEKEND_COLOR } from '../../lib/constants/colors'

// 월별 가시성 타입 (1~12월)
export type MonthVisibility = Record<number, boolean>

// 기본 월 가시성 (모든 월 표시)
const defaultMonthVisibility: MonthVisibility = {
  1: true, 2: true, 3: true, 4: true, 5: true, 6: true,
  7: true, 8: true, 9: true, 10: true, 11: true, 12: true,
}

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

  // 선택한 기본 일정 색상
  selectedScheduleColor: string

  // 주말/공휴일 배경 색상
  weekendColor: string

  // 월별 가시성 (true = 표시, false = 숨김)
  monthVisibility: MonthVisibility

  // 메서드
  setZoomLevel: (level: number) => void
  setDateRange: (start: Date | null, end: Date | null) => void
  setScrollOffset: (offset: number) => void
  setCurrentYear: (year: number) => void
  setSelectedScheduleColor: (color: string) => void
  setWeekendColor: (color: string) => void
  toggleMonthVisibility: (month: number) => void
  setAllMonthsVisible: (visible: boolean) => void
  resetFilters: () => void
}

// localStorage에서 줌 레벨 로드
const getInitialZoomLevel = (): number => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('zoomLevel')
    if (saved) {
      const parsed = parseFloat(saved)
      if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) {
        return parsed
      }
    }
  }
  return DEFAULT_ZOOM
}

// localStorage에서 월 가시성 로드
const getInitialMonthVisibility = (): MonthVisibility => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('monthVisibility')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // 모든 월(1-12)이 있는지 확인
        const isValid = Object.keys(parsed).length === 12 &&
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].every(m => typeof parsed[m] === 'boolean')
        if (isValid) {
          return parsed
        }
      } catch (e) {
        // 파싱 실패 시 기본값 사용
      }
    }
  }
  return { ...defaultMonthVisibility }
}

// localStorage에서 일정 색상 로드
const getInitialScheduleColor = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('selectedScheduleColor')
    if (saved && /^#[0-9A-Fa-f]{6}$/.test(saved)) {
      return saved
    }
  }
  return DEFAULT_SCHEDULE_COLOR
}

// localStorage에서 주말 색상 로드
const getInitialWeekendColor = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('weekendColor')
    if (saved && /^#[0-9A-Fa-f]{6}$/.test(saved)) {
      return saved
    }
  }
  return DEFAULT_WEEKEND_COLOR
}

// 월 가시성 저장
const saveMonthVisibility = (visibility: MonthVisibility) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('monthVisibility', JSON.stringify(visibility))
  }
}

export const createViewSlice = (set: any): ViewSlice => ({
  // 초기 상태
  zoomLevel: getInitialZoomLevel(),
  dateRange: {
    start: null,
    end: null,
  },
  scrollOffset: 0,
  currentYear: new Date().getFullYear(),
  selectedScheduleColor: getInitialScheduleColor(),
  weekendColor: getInitialWeekendColor(),
  monthVisibility: getInitialMonthVisibility(),

  // 줌 레벨 설정 (localStorage에도 저장)
  setZoomLevel: (level) => {
    localStorage.setItem('zoomLevel', level.toString())
    set({ zoomLevel: level })
  },

  // 날짜 범위 설정
  setDateRange: (start, end) =>
    set({
      dateRange: { start, end },
    }),

  // 스크롤 위치 설정
  setScrollOffset: (offset) => set({ scrollOffset: offset }),

  // 현재 연도 설정
  setCurrentYear: (year) => set({ currentYear: year }),

  // 기본 일정 색상 설정 (localStorage에도 저장)
  setSelectedScheduleColor: (color) => {
    localStorage.setItem('selectedScheduleColor', color)
    set({ selectedScheduleColor: color })
  },

  // 주말 색상 설정 (localStorage에도 저장)
  setWeekendColor: (color) => {
    localStorage.setItem('weekendColor', color)
    set({ weekendColor: color })
  },

  // 월 가시성 토글 (localStorage에도 저장)
  toggleMonthVisibility: (month) =>
    set((state: ViewSlice) => {
      const newVisibility = {
        ...state.monthVisibility,
        [month]: !state.monthVisibility[month],
      }
      saveMonthVisibility(newVisibility)
      return { monthVisibility: newVisibility }
    }),

  // 모든 월 가시성 설정 (localStorage에도 저장)
  setAllMonthsVisible: (visible) => {
    const newVisibility = {
      1: visible, 2: visible, 3: visible, 4: visible, 5: visible, 6: visible,
      7: visible, 8: visible, 9: visible, 10: visible, 11: visible, 12: visible,
    }
    saveMonthVisibility(newVisibility)
    set({ monthVisibility: newVisibility })
  },

  // 필터 초기화 (localStorage도 초기화)
  resetFilters: () => {
    saveMonthVisibility(defaultMonthVisibility)
    localStorage.setItem('zoomLevel', DEFAULT_ZOOM.toString())
    set({
      dateRange: { start: null, end: null },
      zoomLevel: DEFAULT_ZOOM,
      monthVisibility: { ...defaultMonthVisibility },
    })
  },
})
