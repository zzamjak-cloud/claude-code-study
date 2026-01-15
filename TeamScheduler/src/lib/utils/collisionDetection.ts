// 겹침 감지 알고리즘

import { Schedule } from '../../types/schedule'

/**
 * 시간 구간 겹침 검사
 */
export const hasCollision = (
  newSchedule: Schedule,
  existingSchedules: Schedule[]
): boolean => {
  return existingSchedules
    .filter(s => s.memberId === newSchedule.memberId && s.id !== newSchedule.id)
    .some(existing => {
      // 겹치지 않는 조건: 새 일정이 기존 일정보다 앞에 끝나거나 뒤에 시작
      const noOverlap = (
        newSchedule.endDate <= existing.startDate ||
        newSchedule.startDate >= existing.endDate
      )
      return !noOverlap
    })
}

/**
 * 겹치는 일정 목록 반환
 */
export const getCollidingSchedules = (
  schedule: Schedule,
  allSchedules: Schedule[]
): Schedule[] => {
  return allSchedules.filter(s => {
    if (s.id === schedule.id || s.memberId !== schedule.memberId) return false

    // 겹침 확인
    return !(schedule.endDate <= s.startDate || schedule.startDate >= s.endDate)
  })
}
