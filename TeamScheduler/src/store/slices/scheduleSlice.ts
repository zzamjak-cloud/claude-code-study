// 일정 관리 슬라이스

import { Schedule } from '../../types/schedule'
import { hasCollision } from '../../lib/utils/collisionDetection'

export interface ScheduleSlice {
  // 상태
  schedules: Schedule[]
  schedulesByMemberId: Record<string, Schedule[]> // 구성원별 일정 인덱스 (O(1) 조회용)
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
  schedulesByMemberId: {},
  selectedScheduleId: null,
  isDragging: false,
  draggedSchedule: null,

  // 일정 목록 설정 (Firebase 동기화용) - 인덱스도 함께 재구성
  setSchedules: (schedules) => {
    const byMember: Record<string, Schedule[]> = {}
    for (const s of schedules) {
      (byMember[s.memberId] ||= []).push(s)
    }
    set({ schedules, schedulesByMemberId: byMember })
  },

  // 일정 추가 - 인덱스 동기화
  addSchedule: (schedule) =>
    set((state: ScheduleSlice) => {
      const newSchedules = [...state.schedules, schedule]
      const byMember = { ...state.schedulesByMemberId }
      byMember[schedule.memberId] = [...(byMember[schedule.memberId] || []), schedule]
      return { schedules: newSchedules, schedulesByMemberId: byMember }
    }),

  // 일정 업데이트 - 인덱스 동기화 (memberId 변경 시 이전/새 인덱스 모두 갱신)
  updateSchedule: (scheduleId, updates) =>
    set((state: ScheduleSlice) => {
      const oldSchedule = state.schedules.find((s: Schedule) => s.id === scheduleId)
      const newSchedules = state.schedules.map((s: Schedule) =>
        s.id === scheduleId ? { ...s, ...updates } : s
      )
      const byMember = { ...state.schedulesByMemberId }

      if (oldSchedule) {
        const updatedSchedule = { ...oldSchedule, ...updates }

        if (updates.memberId && updates.memberId !== oldSchedule.memberId) {
          // memberId가 변경된 경우: 이전 구성원에서 제거, 새 구성원에 추가
          byMember[oldSchedule.memberId] = (byMember[oldSchedule.memberId] || []).filter(
            (s: Schedule) => s.id !== scheduleId
          )
          byMember[updates.memberId] = [...(byMember[updates.memberId] || []), updatedSchedule]
        } else {
          // memberId 변경 없음: 해당 구성원의 배열만 갱신
          byMember[oldSchedule.memberId] = (byMember[oldSchedule.memberId] || []).map(
            (s: Schedule) => (s.id === scheduleId ? updatedSchedule : s)
          )
        }
      }

      return { schedules: newSchedules, schedulesByMemberId: byMember }
    }),

  // 일정 삭제 - 인덱스 동기화
  deleteSchedule: (scheduleId) =>
    set((state: ScheduleSlice) => {
      const deletedSchedule = state.schedules.find((s: Schedule) => s.id === scheduleId)
      const newSchedules = state.schedules.filter((s: Schedule) => s.id !== scheduleId)
      const byMember = { ...state.schedulesByMemberId }

      if (deletedSchedule) {
        byMember[deletedSchedule.memberId] = (byMember[deletedSchedule.memberId] || []).filter(
          (s: Schedule) => s.id !== scheduleId
        )
      }

      return {
        schedules: newSchedules,
        schedulesByMemberId: byMember,
        selectedScheduleId:
          state.selectedScheduleId === scheduleId
            ? null
            : state.selectedScheduleId,
      }
    }),

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
