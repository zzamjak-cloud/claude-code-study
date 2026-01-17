// 날짜 계산 유틸리티

import { startOfYear, differenceInDays, addDays } from 'date-fns'
import { CELL_WIDTH_BASE } from '../constants/grid'

/**
 * 날짜 → 픽셀 X 좌표 변환
 */
export const dateToPixels = (date: Date, year: number, zoomLevel: number): number => {
  const yearStart = startOfYear(new Date(year, 0, 1))
  const dayOffset = differenceInDays(date, yearStart)
  return dayOffset * CELL_WIDTH_BASE * zoomLevel
}

/**
 * 픽셀 X 좌표 → 날짜 변환
 */
export const pixelsToDate = (x: number, year: number, zoomLevel: number): Date => {
  const yearStart = startOfYear(new Date(year, 0, 1))
  const dayOffset = Math.floor(x / (CELL_WIDTH_BASE * zoomLevel))
  return addDays(yearStart, dayOffset)
}

/**
 * 두 날짜 사이의 픽셀 너비 계산
 */
export const dateRangeToWidth = (
  startDate: Date,
  endDate: Date,
  zoomLevel: number
): number => {
  const days = differenceInDays(endDate, startDate)
  return Math.max(days, 1) * CELL_WIDTH_BASE * zoomLevel
}

/**
 * 현재 연도 가져오기
 */
export const getCurrentYear = (): number => {
  return new Date().getFullYear()
}

/**
 * 월별 가시성에 따라 표시할 날짜 인덱스 배열 반환
 * @param year - 연도
 * @param monthVisibility - 월별 가시성 (1~12)
 * @returns 표시할 날짜 인덱스 배열 (0-based)
 */
export const getVisibleDayIndices = (
  year: number,
  monthVisibility: Record<number, boolean>
): number[] => {
  const yearStart = startOfYear(new Date(year, 0, 1))
  const indices: number[] = []

  for (let dayIndex = 0; dayIndex < 366; dayIndex++) {
    const date = addDays(yearStart, dayIndex)
    if (date.getFullYear() !== year) break // 다음 해로 넘어가면 중단

    const month = date.getMonth() + 1 // 1-12
    if (monthVisibility[month]) {
      indices.push(dayIndex)
    }
  }

  return indices
}

/**
 * 일정 날짜 범위에서 표시할 부분 계산 (클리핑)
 * @param startDate - 일정 시작일
 * @param endDate - 일정 종료일
 * @param year - 연도
 * @param monthVisibility - 월별 가시성
 * @returns 클리핑된 날짜 범위 배열 (연속된 세그먼트 별로)
 */
export const getVisibleScheduleSegments = (
  startDate: Date,
  endDate: Date,
  year: number,
  monthVisibility: Record<number, boolean>
): Array<{ startDayIndex: number; endDayIndex: number }> => {
  const yearStart = startOfYear(new Date(year, 0, 1))
  const startDayIndex = Math.max(0, differenceInDays(startDate, yearStart))
  const endDayIndex = Math.max(0, differenceInDays(endDate, yearStart))

  const segments: Array<{ startDayIndex: number; endDayIndex: number }> = []
  let currentSegmentStart: number | null = null

  for (let dayIndex = startDayIndex; dayIndex < endDayIndex; dayIndex++) {
    const date = addDays(yearStart, dayIndex)
    const month = date.getMonth() + 1

    if (monthVisibility[month]) {
      if (currentSegmentStart === null) {
        currentSegmentStart = dayIndex
      }
    } else {
      if (currentSegmentStart !== null) {
        segments.push({ startDayIndex: currentSegmentStart, endDayIndex: dayIndex })
        currentSegmentStart = null
      }
    }
  }

  // 마지막 세그먼트 처리
  if (currentSegmentStart !== null) {
    segments.push({ startDayIndex: currentSegmentStart, endDayIndex: endDayIndex })
  }

  return segments
}

/**
 * 원본 날짜 인덱스를 표시 인덱스로 변환 (숨겨진 날짜 제외)
 * @param originalDayIndex - 원본 날짜 인덱스
 * @param visibleDayIndices - 표시할 날짜 인덱스 배열
 * @returns 표시 인덱스 (-1이면 숨겨진 날짜)
 */
export const originalToVisibleIndex = (
  originalDayIndex: number,
  visibleDayIndices: number[]
): number => {
  const visibleIndex = visibleDayIndices.indexOf(originalDayIndex)
  return visibleIndex
}

/**
 * 날짜가 특정 월에 속하는지 확인
 */
export const getMonthFromDayIndex = (dayIndex: number, year: number): number => {
  const yearStart = startOfYear(new Date(year, 0, 1))
  const date = addDays(yearStart, dayIndex)
  return date.getMonth() + 1 // 1-12
}
