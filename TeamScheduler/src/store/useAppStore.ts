// 메인 스토어 - 슬라이스 통합

import { create } from 'zustand'
import { createTeamSlice, TeamSlice } from './slices/teamSlice'
import { createScheduleSlice, ScheduleSlice } from './slices/scheduleSlice'
import { createViewSlice, ViewSlice } from './slices/viewSlice'
import { createEventSlice, EventSlice } from './slices/eventSlice'
import { createAuthSlice, AuthSlice } from './slices/authSlice'
import { createAnnouncementSlice, AnnouncementSlice } from './slices/announcementSlice'
import { createGlobalEventSlice, GlobalEventSlice } from './slices/globalEventSlice'
import { createProjectSlice, ProjectSlice } from './slices/projectSlice'
import { createHistorySlice, HistorySlice } from './slices/historySlice'

// 통합된 App State 타입
export type AppState = TeamSlice &
  ScheduleSlice &
  ViewSlice &
  EventSlice &
  AuthSlice &
  AnnouncementSlice &
  GlobalEventSlice &
  ProjectSlice &
  HistorySlice

// 스토어 생성
export const useAppStore = create<AppState>()((set, get) => ({
  ...createTeamSlice(set),
  ...createScheduleSlice(set, get),
  ...createViewSlice(set),
  ...createEventSlice(set, get),
  ...createAuthSlice(set),
  ...createAnnouncementSlice(set),
  ...createGlobalEventSlice(set),
  ...createProjectSlice(set),
  ...createHistorySlice(set, get),
}))
