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
