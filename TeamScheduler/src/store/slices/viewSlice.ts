// 뷰 상태 슬라이스

import { DEFAULT_ZOOM } from '../../lib/constants/grid'
import { DEFAULT_SCHEDULE_COLOR, DEFAULT_WEEKEND_COLOR } from '../../lib/constants/colors'
import { storage, STORAGE_KEYS } from '../../lib/utils/storage'

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

  // 열너비 배율 (1.0 = 기본, 0.5 = 축소, 2.0 = 확대)
  columnWidthScale: number

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

  // 선택된 프로젝트 ID (null = 전체)
  selectedProjectId: string | null

  // 마지막 선택한 프로젝트 ID (일정 등록시 기본값)
  lastSelectedProjectId: string | null

  // 메서드
  setZoomLevel: (level: number) => void
  setColumnWidthScale: (scale: number) => void
  resetColumnWidthScale: () => void
  setDateRange: (start: Date | null, end: Date | null) => void
  setScrollOffset: (offset: number) => void
  setCurrentYear: (year: number) => void
  setSelectedScheduleColor: (color: string) => void
  setWeekendColor: (color: string) => void
  toggleMonthVisibility: (month: number) => void
  setAllMonthsVisible: (visible: boolean) => void
  setSelectedProjectId: (projectId: string | null) => void
  setLastSelectedProjectId: (projectId: string | null) => void
  resetFilters: () => void
}

// localStorage에서 줌 레벨 로드
const getInitialZoomLevel = (): number => {
  if (typeof window !== 'undefined') {
    const saved = storage.getNumber(STORAGE_KEYS.ZOOM_LEVEL, DEFAULT_ZOOM)
    if (saved >= 0.5 && saved <= 2.0) {
      return saved
    }
  }
  return DEFAULT_ZOOM
}

// localStorage에서 열너비 배율 로드
const getInitialColumnWidthScale = (): number => {
  if (typeof window !== 'undefined') {
    const saved = storage.getNumber(STORAGE_KEYS.COLUMN_WIDTH_SCALE, 1.0)
    if (saved >= 0.5 && saved <= 2.0) {
      return saved
    }
  }
  return 1.0 // 기본값
}

// localStorage에서 월 가시성 로드
const getInitialMonthVisibility = (): MonthVisibility => {
  if (typeof window !== 'undefined') {
    const saved = storage.get<MonthVisibility | null>(STORAGE_KEYS.MONTH_VISIBILITY, null)
    if (saved) {
      // 모든 월(1-12)이 있는지 확인
      const isValid = Object.keys(saved).length === 12 &&
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].every(m => typeof saved[m] === 'boolean')
      if (isValid) {
        return saved
      }
    }
  }
  return { ...defaultMonthVisibility }
}

// localStorage에서 일정 색상 로드
const getInitialScheduleColor = (): string => {
  if (typeof window !== 'undefined') {
    const saved = storage.getString(STORAGE_KEYS.SELECTED_SCHEDULE_COLOR, null)
    if (saved && /^#[0-9A-Fa-f]{6}$/.test(saved)) {
      return saved
    }
  }
  return DEFAULT_SCHEDULE_COLOR
}

// localStorage에서 주말 색상 로드
const getInitialWeekendColor = (): string => {
  if (typeof window !== 'undefined') {
    const saved = storage.getString(STORAGE_KEYS.WEEKEND_COLOR, null)
    if (saved && /^#[0-9A-Fa-f]{6}$/.test(saved)) {
      return saved
    }
  }
  return DEFAULT_WEEKEND_COLOR
}

// localStorage에서 마지막 선택 프로젝트 로드
const getInitialLastSelectedProjectId = (): string | null => {
  if (typeof window !== 'undefined') {
    return storage.getString(STORAGE_KEYS.LAST_SELECTED_PROJECT_ID, null)
  }
  return null
}

// localStorage에서 선택된 프로젝트 필터 로드
const getInitialSelectedProjectId = (): string | null => {
  if (typeof window !== 'undefined') {
    return storage.getString(STORAGE_KEYS.SELECTED_PROJECT_ID, null)
  }
  return null
}

export const createViewSlice = (set: any): ViewSlice => ({
  // 초기 상태
  zoomLevel: getInitialZoomLevel(),
  columnWidthScale: getInitialColumnWidthScale(),
  dateRange: {
    start: null,
    end: null,
  },
  scrollOffset: 0,
  currentYear: new Date().getFullYear(),
  selectedScheduleColor: getInitialScheduleColor(),
  weekendColor: getInitialWeekendColor(),
  monthVisibility: getInitialMonthVisibility(),
  selectedProjectId: getInitialSelectedProjectId(),
  lastSelectedProjectId: getInitialLastSelectedProjectId(),

  // 줌 레벨 설정 (localStorage에도 저장)
  setZoomLevel: (level) => {
    storage.setString(STORAGE_KEYS.ZOOM_LEVEL, level.toString())
    set({ zoomLevel: level })
  },

  // 열너비 배율 설정 (localStorage에도 저장)
  setColumnWidthScale: (scale) => {
    storage.setString(STORAGE_KEYS.COLUMN_WIDTH_SCALE, scale.toString())
    set({ columnWidthScale: scale })
  },

  // 열너비 배율 초기화
  resetColumnWidthScale: () => {
    storage.setString(STORAGE_KEYS.COLUMN_WIDTH_SCALE, '1.0')
    set({ columnWidthScale: 1.0 })
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
    storage.setString(STORAGE_KEYS.SELECTED_SCHEDULE_COLOR, color)
    set({ selectedScheduleColor: color })
  },

  // 주말 색상 설정 (localStorage에도 저장)
  setWeekendColor: (color) => {
    storage.setString(STORAGE_KEYS.WEEKEND_COLOR, color)
    set({ weekendColor: color })
  },

  // 월 가시성 토글 (localStorage에도 저장)
  toggleMonthVisibility: (month) =>
    set((state: ViewSlice) => {
      const newVisibility = {
        ...state.monthVisibility,
        [month]: !state.monthVisibility[month],
      }
      storage.set(STORAGE_KEYS.MONTH_VISIBILITY, newVisibility)
      return { monthVisibility: newVisibility }
    }),

  // 모든 월 가시성 설정 (localStorage에도 저장)
  setAllMonthsVisible: (visible) => {
    const newVisibility = {
      1: visible, 2: visible, 3: visible, 4: visible, 5: visible, 6: visible,
      7: visible, 8: visible, 9: visible, 10: visible, 11: visible, 12: visible,
    }
    storage.set(STORAGE_KEYS.MONTH_VISIBILITY, newVisibility)
    set({ monthVisibility: newVisibility })
  },

  // 선택된 프로젝트 설정 (localStorage에도 저장)
  setSelectedProjectId: (projectId) => {
    if (projectId) {
      storage.setString(STORAGE_KEYS.SELECTED_PROJECT_ID, projectId)
    } else {
      storage.remove(STORAGE_KEYS.SELECTED_PROJECT_ID)
    }
    set({ selectedProjectId: projectId })
  },

  // 마지막 선택 프로젝트 설정 (localStorage에도 저장)
  setLastSelectedProjectId: (projectId) => {
    if (projectId) {
      storage.setString(STORAGE_KEYS.LAST_SELECTED_PROJECT_ID, projectId)
    } else {
      storage.remove(STORAGE_KEYS.LAST_SELECTED_PROJECT_ID)
    }
    set({ lastSelectedProjectId: projectId })
  },

  // 필터 초기화 (localStorage도 초기화)
  resetFilters: () => {
    storage.set(STORAGE_KEYS.MONTH_VISIBILITY, defaultMonthVisibility)
    storage.setString(STORAGE_KEYS.ZOOM_LEVEL, DEFAULT_ZOOM.toString())
    set({
      dateRange: { start: null, end: null },
      zoomLevel: DEFAULT_ZOOM,
      monthVisibility: { ...defaultMonthVisibility },
    })
  },
})
