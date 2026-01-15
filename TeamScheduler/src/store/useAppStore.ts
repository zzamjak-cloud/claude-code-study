// 메인 스토어 - 슬라이스 통합

import { create } from 'zustand'
import { createTeamSlice, TeamSlice } from './slices/teamSlice'
import { createScheduleSlice, ScheduleSlice } from './slices/scheduleSlice'
import { createViewSlice, ViewSlice } from './slices/viewSlice'
import { createEventSlice, EventSlice } from './slices/eventSlice'
import { createAuthSlice, AuthSlice } from './slices/authSlice'

// 통합된 App State 타입
export type AppState = TeamSlice &
  ScheduleSlice &
  ViewSlice &
  EventSlice &
  AuthSlice

// 스토어 생성
export const useAppStore = create<AppState>()((...a) => ({
  ...createTeamSlice(...a),
  ...createScheduleSlice(...a),
  ...createViewSlice(...a),
  ...createEventSlice(...a),
  ...createAuthSlice(...a),
}))
