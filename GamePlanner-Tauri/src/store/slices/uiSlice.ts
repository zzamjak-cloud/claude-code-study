// UI 상태 슬라이스

import { StateCreator } from 'zustand'
import { SessionType } from '../useAppStore'

export interface UiSlice {
  // UI 상태
  currentSessionType: SessionType

  // UI 관리 메서드
  setCurrentSessionType: (type: SessionType) => void
}

export const createUiSlice: StateCreator<
  UiSlice,
  [],
  [],
  UiSlice
> = (set) => ({
  // 초기 상태
  currentSessionType: SessionType.PLANNING,

  // 세션 타입 변경
  setCurrentSessionType: (type) => set({ currentSessionType: type }),
})

