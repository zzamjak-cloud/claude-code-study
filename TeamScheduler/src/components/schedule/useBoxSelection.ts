// 박스 선택(빈 영역 드래그로 여러 카드 선택) 및 다중 카드 드래그 관리 훅

import { useState, useCallback, useRef } from 'react'
import type { Schedule } from '../../types/schedule'

// 선택 사각형 (그리드 내 픽셀 좌표, 스크롤 보정됨)
export interface BoxSelectionRect {
  startX: number
  startY: number
  endX: number
  endY: number
}

export interface UseBoxSelectionOptions {
  cellWidth: number
  cellHeight: number
  schedules: Schedule[]
  memberGroups: Array<{
    memberId: string
    totalRows: number
    schedules: Schedule[]
  }>
  dayIndexToVisibleIndex: Record<number, number>
  currentYear: number
  zoomLevel: number
  columnWidthScale: number
  contentYOffset: number // DateAxis + 특이사항 영역 높이 (스크롤 컨테이너 내 멤버 영역 시작 Y)
}

export interface UseBoxSelectionReturn {
  selectedCardIds: Set<string>
  isBoxSelecting: boolean
  selectionRect: BoxSelectionRect | null
  isMultiDragging: boolean
  multiDragDeltaX: number
  multiDragDeltaY: number
  handleBoxSelectStart: (e: React.MouseEvent, containerEl: HTMLElement) => void
  handleBoxSelectMove: (e: React.MouseEvent, containerEl: HTMLElement) => void
  handleBoxSelectEnd: () => void
  handleMultiDragStart: (leaderScheduleId: string) => void
  handleMultiDragMove: (deltaX: number, deltaY: number) => void
  handleMultiDragEnd: (deltaX: number, deltaY: number) => Schedule[] | null
  clearSelection: () => void
  isCardMultiSelected: (scheduleId: string) => boolean
}

// 연도 시작일 타임스탬프 계산
function getYearStart(year: number): number {
  return new Date(year, 0, 1).getTime()
}

// 날짜 타임스탬프를 dayIndex로 변환
function dateToDayIndex(timestamp: number, yearStart: number): number {
  return Math.floor((timestamp - yearStart) / (24 * 60 * 60 * 1000))
}

// AABB 교차 검사: 선택 사각형과 카드 픽셀 영역 겹침 판정
function rectsIntersect(
  selLeft: number,
  selRight: number,
  selTop: number,
  selBottom: number,
  cardLeft: number,
  cardRight: number,
  cardTop: number,
  cardBottom: number
): boolean {
  return (
    cardLeft < selRight &&
    cardRight > selLeft &&
    cardTop < selBottom &&
    cardBottom > selTop
  )
}

export function useBoxSelection(options: UseBoxSelectionOptions): UseBoxSelectionReturn {
  const {
    cellWidth,
    cellHeight,
    memberGroups,
    dayIndexToVisibleIndex,
    currentYear,
    zoomLevel,
    contentYOffset,
  } = options

  // 선택된 카드 ID 집합
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())

  // 박스 선택 상태
  const [isBoxSelecting, setIsBoxSelecting] = useState(false)
  const [selectionRect, setSelectionRect] = useState<BoxSelectionRect | null>(null)

  // 다중 드래그 상태
  const [isMultiDragging, setIsMultiDragging] = useState(false)
  const [multiDragDeltaX, setMultiDragDeltaX] = useState(0)
  const [multiDragDeltaY, setMultiDragDeltaY] = useState(0)

  // 리더 스케줄 ID (드래그 시작점)
  const leaderIdRef = useRef<string | null>(null)

  // 선택 사각형 내 카드 ID 수집 (AABB 교차 검사)
  const getCardsInRect = useCallback(
    (rect: BoxSelectionRect): Set<string> => {
      const result = new Set<string>()
      const yearStart = getYearStart(currentYear)

      // 선택 사각형의 정규화 (start < end 보장)
      const selLeft = Math.min(rect.startX, rect.endX)
      const selRight = Math.max(rect.startX, rect.endX)
      const selTop = Math.min(rect.startY, rect.endY)
      const selBottom = Math.max(rect.startY, rect.endY)

      // 멤버 그룹을 순회하면서 Y 오프셋 누적
      // contentYOffset: 스크롤 컨테이너 내에서 멤버 영역이 시작되는 Y 좌표
      let groupYOffset = contentYOffset

      for (const group of memberGroups) {
        for (const schedule of group.schedules) {
          // 스케줄의 시작/종료 dayIndex 계산
          const startDayIndex = dateToDayIndex(schedule.startDate, yearStart)
          const endDayIndex = dateToDayIndex(schedule.endDate, yearStart)

          // visibleIndex로 변환
          const startVisibleIndex = dayIndexToVisibleIndex[startDayIndex]
          const endVisibleIndex = dayIndexToVisibleIndex[endDayIndex]

          // visibleIndex가 없으면 (범위 밖) 건너뛰기
          if (startVisibleIndex === undefined || endVisibleIndex === undefined) continue

          // 카드 픽셀 영역 계산
          const cardLeft = startVisibleIndex * cellWidth
          const cardRight = (endVisibleIndex + 1) * cellWidth
          const cardTop = groupYOffset + schedule.rowIndex * cellHeight
          const cardBottom = cardTop + cellHeight

          // AABB 교차 검사
          if (rectsIntersect(selLeft, selRight, selTop, selBottom, cardLeft, cardRight, cardTop, cardBottom)) {
            result.add(schedule.id)
          }
        }

        // 다음 그룹의 Y 오프셋 누적
        groupYOffset += group.totalRows * cellHeight
      }

      return result
    },
    [memberGroups, dayIndexToVisibleIndex, currentYear, cellWidth, cellHeight, contentYOffset]
  )

  // 박스 선택 시작
  const handleBoxSelectStart = useCallback(
    (e: React.MouseEvent, containerEl: HTMLElement) => {
      const rect = containerEl.getBoundingClientRect()
      // 스크롤 보정된 좌표 계산
      const x = e.clientX - rect.left + containerEl.scrollLeft
      const y = e.clientY - rect.top + containerEl.scrollTop

      setIsBoxSelecting(true)
      setSelectionRect({ startX: x, startY: y, endX: x, endY: y })
      setSelectedCardIds(new Set())
    },
    []
  )

  // 박스 선택 이동 (실시간 업데이트)
  const handleBoxSelectMove = useCallback(
    (e: React.MouseEvent, containerEl: HTMLElement) => {
      if (!isBoxSelecting) return

      const rect = containerEl.getBoundingClientRect()
      const x = e.clientX - rect.left + containerEl.scrollLeft
      const y = e.clientY - rect.top + containerEl.scrollTop

      const newRect: BoxSelectionRect = {
        startX: selectionRect?.startX ?? x,
        startY: selectionRect?.startY ?? y,
        endX: x,
        endY: y,
      }

      setSelectionRect(newRect)

      // 실시간으로 사각형 내 카드 선택
      const cardsInRect = getCardsInRect(newRect)
      setSelectedCardIds(cardsInRect)
    },
    [isBoxSelecting, selectionRect?.startX, selectionRect?.startY, getCardsInRect]
  )

  // 박스 선택 종료 (선택된 카드 ID는 유지)
  const handleBoxSelectEnd = useCallback(() => {
    setIsBoxSelecting(false)
    setSelectionRect(null)
  }, [])

  // 다중 드래그 시작
  const handleMultiDragStart = useCallback(
    (leaderScheduleId: string) => {
      // 선택된 카드 중 하나를 드래그 시작점으로 설정
      if (!selectedCardIds.has(leaderScheduleId)) return

      leaderIdRef.current = leaderScheduleId
      setIsMultiDragging(true)
      setMultiDragDeltaX(0)
      setMultiDragDeltaY(0)
    },
    [selectedCardIds]
  )

  // 다중 드래그 이동 (deltaX, deltaY 업데이트)
  const handleMultiDragMove = useCallback((deltaX: number, deltaY: number) => {
    if (!isMultiDragging) return
    setMultiDragDeltaX(deltaX)
    setMultiDragDeltaY(deltaY)
  }, [isMultiDragging])

  // 다중 드래그 종료: 업데이트된 스케줄 배열 반환 (충돌 시 null)
  const handleMultiDragEnd = useCallback(
    (deltaX: number, deltaY: number): Schedule[] | null => {
      setIsMultiDragging(false)
      setMultiDragDeltaX(0)
      setMultiDragDeltaY(0)
      leaderIdRef.current = null

      // 픽셀을 일수/행으로 변환 (deltaX/Y는 transform 내부 좌표이므로 줌 미적용 셀 크기로 변환)
      const baseCellWidth = cellWidth / zoomLevel
      const baseCellHeight = cellHeight / zoomLevel
      const daysMove = Math.round(deltaX / baseCellWidth)
      const rowDelta = Math.round(deltaY / baseCellHeight)
      if (daysMove === 0 && rowDelta === 0) return null

      // 밀리초 변환
      const deltaMs = daysMove * 24 * 60 * 60 * 1000

      // 선택된 카드들의 원본 스케줄 찾기
      const selectedSchedules: Schedule[] = []
      const allSchedules: Schedule[] = []

      for (const group of memberGroups) {
        for (const schedule of group.schedules) {
          allSchedules.push(schedule)
          if (selectedCardIds.has(schedule.id)) {
            selectedSchedules.push(schedule)
          }
        }
      }

      // 각 선택된 카드의 날짜 + 행 업데이트
      const updatedSchedules: Schedule[] = selectedSchedules.map((s) => {
        // 같은 멤버 그룹의 totalRows로 행 범위 제한
        const group = memberGroups.find(g => g.memberId === s.memberId)
        const maxRow = (group?.totalRows || 1) - 1
        const newRowIndex = Math.max(0, Math.min(maxRow, (s.rowIndex || 0) + rowDelta))

        return {
          ...s,
          startDate: s.startDate + deltaMs,
          endDate: s.endDate + deltaMs,
          rowIndex: newRowIndex,
        }
      })

      // 충돌 검사: 선택되지 않은 카드들과 비교
      const nonSelectedSchedules = allSchedules.filter(
        (s) => !selectedCardIds.has(s.id)
      )

      for (const updated of updatedSchedules) {
        for (const other of nonSelectedSchedules) {
          // 같은 멤버 + 같은 행에서 날짜 겹침 검사
          if (
            updated.memberId === other.memberId &&
            updated.rowIndex === other.rowIndex &&
            updated.startDate < other.endDate &&
            updated.endDate > other.startDate
          ) {
            // 충돌 발생 → 전체 취소
            return null
          }
        }
      }

      return updatedSchedules
    },
    [cellWidth, cellHeight, zoomLevel, memberGroups, selectedCardIds]
  )

  // 선택 해제
  const clearSelection = useCallback(() => {
    setSelectedCardIds(new Set())
    setIsBoxSelecting(false)
    setSelectionRect(null)
    setIsMultiDragging(false)
    setMultiDragDeltaX(0)
    setMultiDragDeltaY(0)
    leaderIdRef.current = null
  }, [])

  // 특정 카드가 다중 선택에 포함되어 있는지 확인
  const isCardMultiSelected = useCallback(
    (scheduleId: string): boolean => {
      return selectedCardIds.has(scheduleId)
    },
    [selectedCardIds]
  )

  return {
    selectedCardIds,
    isBoxSelecting,
    selectionRect,
    isMultiDragging,
    multiDragDeltaX,
    multiDragDeltaY,
    handleBoxSelectStart,
    handleBoxSelectMove,
    handleBoxSelectEnd,
    handleMultiDragStart,
    handleMultiDragMove,
    handleMultiDragEnd,
    clearSelection,
    isCardMultiSelected,
  }
}
