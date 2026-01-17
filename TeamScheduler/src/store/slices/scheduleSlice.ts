// 일정 관리 슬라이스

import { Schedule } from '../../types/schedule'
import { hasCollision } from '../../lib/utils/collisionDetection'

export interface ScheduleSlice {
  // 상태
  schedules: Schedule[]
  selectedScheduleId: string | null
  isDragging: boolean
  draggedSchedule: Schedule | null

  // 메서드
  setSchedules: (schedules: Schedule[]) => void
  addSchedule: (schedule: Schedule) => void
  updateSchedule: (scheduleId: string, updates: Partial<Schedule>) => void
  deleteSchedule: (scheduleId: string) => void
  getSchedulesByMember: (memberId: string) => Schedule[]
  getAllSchedules: () => Schedule[]
  checkCollision: (schedule: Schedule) => boolean
  setDragging: (isDragging: boolean, schedule?: Schedule) => void
  selectSchedule: (scheduleId: string | null) => void
}

export const createScheduleSlice = (set: any, get: any): ScheduleSlice => ({
  // 초기 상태
  schedules: [],
  selectedScheduleId: null,
  isDragging: false,
  draggedSchedule: null,

  // 일정 목록 설정 (Firebase 동기화용)
  setSchedules: (schedules) => set({ schedules }),

  // 일정 추가
  addSchedule: (schedule) =>
    set((state: ScheduleSlice) => ({
      schedules: [...state.schedules, schedule],
    })),

  // 일정 업데이트
  updateSchedule: (scheduleId, updates) =>
    set((state: ScheduleSlice) => ({
      schedules: state.schedules.map((s: Schedule) =>
        s.id === scheduleId ? { ...s, ...updates } : s
      ),
    })),

  // 일정 삭제
  deleteSchedule: (scheduleId) =>
    set((state: ScheduleSlice) => ({
      schedules: state.schedules.filter((s: Schedule) => s.id !== scheduleId),
      selectedScheduleId:
        state.selectedScheduleId === scheduleId
          ? null
          : state.selectedScheduleId,
    })),

  // 특정 팀원의 일정 가져오기
  getSchedulesByMember: (memberId) => {
    const state = get()
    return state.schedules.filter((s: Schedule) => s.memberId === memberId)
  },

  // 모든 일정 가져오기
  getAllSchedules: () => {
    return get().schedules
  },

  // 겹침 검사
  checkCollision: (schedule) => {
    const state = get()
    return hasCollision(schedule, state.schedules)
  },

  // 드래그 상태 설정
  setDragging: (isDragging, schedule) =>
    set({
      isDragging,
      draggedSchedule: schedule || null,
    }),

  // 일정 선택
  selectSchedule: (scheduleId) => set({ selectedScheduleId: scheduleId }),
})
