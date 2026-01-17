// 그리드 유틸리티

import { pixelsToDate } from './dateUtils'
import { CELL_WIDTH_BASE, CELL_HEIGHT_BASE } from '../constants/grid'

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
  zoomLevel: number,
  columnWidthScale: number = 1.0
): { startDate: Date; endDate: Date } => {
  const startDate = pixelsToDate(x, year, zoomLevel, columnWidthScale)
  const endX = x + width
  const endDate = pixelsToDate(endX, year, zoomLevel, columnWidthScale)

  return { startDate, endDate }
}

/**
 * 셀 너비 계산 (줌 레벨 + 열너비 배율 적용)
 */
export const getCellWidth = (zoomLevel: number, columnWidthScale: number = 1.0): number => {
  return CELL_WIDTH_BASE * zoomLevel * columnWidthScale
}

/**
 * 셀 높이 계산 (줌 레벨 적용)
 */
export const getCellHeight = (zoomLevel: number): number => {
  return CELL_HEIGHT_BASE * zoomLevel
}
