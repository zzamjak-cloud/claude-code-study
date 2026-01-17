// localStorage 중앙화 유틸리티
// 모든 localStorage 접근을 이 모듈을 통해 수행

/**
 * localStorage 키 상수
 * 모든 키를 한 곳에서 관리하여 오타 방지 및 일관성 유지
 */
export const STORAGE_KEYS = {
  // 뷰 설정
  ZOOM_LEVEL: 'zoomLevel',
  COLUMN_WIDTH_SCALE: 'columnWidthScale',
  MONTH_VISIBILITY: 'monthVisibility',
  SELECTED_SCHEDULE_COLOR: 'selectedScheduleColor',
  WEEKEND_COLOR: 'weekendColor',
  SELECTED_PROJECT_ID: 'selectedProjectId',
  LAST_SELECTED_PROJECT_ID: 'lastSelectedProjectId',

  // 팀 설정
  SELECTED_MEMBER_ID: 'selectedMemberId',
  CUSTOM_JOB_TITLES: 'customJobTitles',

  // UI 설정
  BOTTOM_PANEL_HEIGHT: 'bottomPanelHeight',
  AVAILABLE_YEARS: 'availableYears',
} as const

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]

/**
 * localStorage 유틸리티 객체
 */
export const storage = {
  /**
   * localStorage에서 값 가져오기
   * @param key - 저장소 키
   * @param defaultValue - 기본값 (값이 없을 때 반환)
   * @returns 저장된 값 또는 기본값
   */
  get: <T>(key: StorageKey, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key)
      if (item === null) return defaultValue
      return JSON.parse(item) as T
    } catch {
      return defaultValue
    }
  },

  /**
   * localStorage에서 문자열 값 가져오기 (JSON 파싱 없이)
   * @param key - 저장소 키
   * @param defaultValue - 기본값
   * @returns 저장된 문자열 또는 기본값
   */
  getString: (key: StorageKey, defaultValue: string | null = null): string | null => {
    try {
      return localStorage.getItem(key) ?? defaultValue
    } catch {
      return defaultValue
    }
  },

  /**
   * localStorage에서 숫자 값 가져오기
   * @param key - 저장소 키
   * @param defaultValue - 기본값
   * @returns 저장된 숫자 또는 기본값
   */
  getNumber: (key: StorageKey, defaultValue: number): number => {
    try {
      const item = localStorage.getItem(key)
      if (item === null) return defaultValue
      const parsed = parseFloat(item)
      return isNaN(parsed) ? defaultValue : parsed
    } catch {
      return defaultValue
    }
  },

  /**
   * localStorage에 값 저장하기
   * @param key - 저장소 키
   * @param value - 저장할 값
   */
  set: <T>(key: StorageKey, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error(`localStorage 저장 실패 [${key}]:`, error)
    }
  },

  /**
   * localStorage에 문자열 값 저장하기 (JSON 직렬화 없이)
   * @param key - 저장소 키
   * @param value - 저장할 문자열
   */
  setString: (key: StorageKey, value: string): void => {
    try {
      localStorage.setItem(key, value)
    } catch (error) {
      console.error(`localStorage 저장 실패 [${key}]:`, error)
    }
  },

  /**
   * localStorage에서 값 삭제하기
   * @param key - 저장소 키
   */
  remove: (key: StorageKey): void => {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error(`localStorage 삭제 실패 [${key}]:`, error)
    }
  },

  /**
   * localStorage 전체 초기화 (앱 관련 키만)
   */
  clearAll: (): void => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key)
      })
    } catch (error) {
      console.error('localStorage 초기화 실패:', error)
    }
  },
}
