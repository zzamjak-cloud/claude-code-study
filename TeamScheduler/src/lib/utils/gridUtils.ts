// 그리드 유틸리티

import { pixelsToDate } from './dateUtils'
import { CELL_WIDTH_BASE } from '../constants/grid'

/**
 * 픽셀 좌표를 그리드에 스냅
 */
export const snapToGrid = (x: number, cellWidth: number): number => {
  return Math.round(x / cellWidth) * cellWidth
}

/**
 * 드래그 종료 시 날짜 계산
 */
export const calculateScheduleDates = (
  x: number,
  width: number,
  year: number,
  zoomLevel: number
): { startDate: Date; endDate: Date } => {
  const startDate = pixelsToDate(x, year, zoomLevel)
  const endX = x + width
  const endDate = pixelsToDate(endX, year, zoomLevel)

  return { startDate, endDate }
}

/**
 * 셀 너비 계산 (줌 레벨 적용)
 */
export const getCellWidth = (zoomLevel: number): number => {
  return CELL_WIDTH_BASE * zoomLevel
}
