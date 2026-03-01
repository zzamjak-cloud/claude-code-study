// 일정 카드 컴포넌트 (Phase 2: 드래그 앤 드롭 + 리사이즈 핸들 + Delete 삭제)

import { useState, memo, useCallback, useRef } from 'react'
import { Rnd, DraggableData, ResizableDelta, Position } from 'react-rnd'
import { Schedule } from '../../types/schedule'
import { dateRangeToWidth, pixelsToDate } from '../../lib/utils/dateUtils'
import { getCellWidth, getCellHeight, snapToGrid } from '../../lib/utils/gridUtils'
import { useAppStore } from '../../store/useAppStore'
import {
  updateSchedule as updateScheduleFirebase,
  deleteSchedule as deleteScheduleFirebase,
  updateTeamMember,
  createSchedule as createScheduleFirebase,
} from '../../lib/firebase/firestore'
import { debouncedFirebaseUpdate } from '../../lib/utils/debounce'
import { hasCollision } from '../../lib/utils/collisionDetection'
import { ANNUAL_LEAVE_COLOR } from '../../lib/constants/colors'
import { ExternalLink } from 'lucide-react'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { ContextMenu } from './ContextMenu'
import { ScheduleEditPopup } from './ScheduleEditPopup'
import {
  useCardInteractions,
  getRndConfig,
  getCardClassName,
  CARD_MARGIN,
} from './useCardInteractions'

interface ScheduleCardProps {
  schedule: Schedule
  x: number
  y: number // 행 인덱스 기반 y 좌표
  isReadOnly?: boolean
  totalRows?: number
  visibleWidth?: number // 월 필터링 시 클리핑된 너비
  onCollisionChange?: (isColliding: boolean) => void
  // 다중 선택 관련
  isMultiSelected?: boolean
  multiDragDeltaX?: number | null
  multiDragDeltaY?: number | null
  onMultiDragStart?: () => void
  onMultiDragMove?: (deltaX: number, deltaY: number) => void
  onMultiDragEnd?: (deltaX: number, deltaY: number) => void
}

// React.memo 비교 함수 - props가 같으면 리렌더링 스킵
const areScheduleCardPropsEqual = (
  prev: ScheduleCardProps,
  next: ScheduleCardProps
): boolean => {
  return (
    prev.schedule.id === next.schedule.id &&
    prev.schedule.startDate === next.schedule.startDate &&
    prev.schedule.endDate === next.schedule.endDate &&
    prev.schedule.title === next.schedule.title &&
    prev.schedule.color === next.schedule.color &&
    prev.schedule.textColor === next.schedule.textColor &&
    prev.schedule.comment === next.schedule.comment &&
    prev.schedule.link === next.schedule.link &&
    prev.schedule.rowIndex === next.schedule.rowIndex &&
    prev.schedule.memberId === next.schedule.memberId &&
    prev.schedule.projectId === next.schedule.projectId &&
    prev.x === next.x &&
    prev.y === next.y &&
    prev.isReadOnly === next.isReadOnly &&
    prev.totalRows === next.totalRows &&
    prev.visibleWidth === next.visibleWidth &&
    prev.isMultiSelected === next.isMultiSelected &&
    prev.multiDragDeltaX === next.multiDragDeltaX &&
    prev.multiDragDeltaY === next.multiDragDeltaY
  )
}

export const ScheduleCard = memo(function ScheduleCard({
  schedule,
  x,
  y,
  isReadOnly = false,
  totalRows = 1,
  visibleWidth,
  onCollisionChange,
  isMultiSelected = false,
  multiDragDeltaX = null,
  multiDragDeltaY = null,
  onMultiDragStart,
  onMultiDragMove,
  onMultiDragEnd,
}: ScheduleCardProps) {
  // Zustand 선택적 구독
  const zoomLevel = useAppStore(state => state.zoomLevel)
  const columnWidthScale = useAppStore(state => state.columnWidthScale)
  const currentYear = useAppStore(state => state.currentYear)
  const workspaceId = useAppStore(state => state.workspaceId)
  const schedules = useAppStore(state => state.schedules)
  const setDragging = useAppStore(state => state.setDragging)
  const members = useAppStore(state => state.members)
  const currentUser = useAppStore(state => state.currentUser)
  const projects = useAppStore(state => state.projects)
  const pushHistory = useAppStore(state => state.pushHistory)

  const cellWidth = getCellWidth(zoomLevel, columnWidthScale)
  const cellHeight = getCellHeight(zoomLevel)

  // Ctrl+D 카드 복제
  const handleDuplicate = useCallback(async () => {
    if (!workspaceId || !currentUser) return

    const memberId = schedule.memberId
    const member = members.find(m => m.id === memberId)
    const memberSchedules = schedules.filter(s => s.memberId === memberId)
    const currentRowCount = member?.rowCount || 1

    // 빈 행 탐색: 같은 날짜 범위에서 겹치지 않는 행 찾기
    let targetRowIndex = -1
    for (let rowIdx = 0; rowIdx < currentRowCount; rowIdx++) {
      const rowSchedules = memberSchedules.filter(s => (s.rowIndex || 0) === rowIdx)
      const hasConflict = rowSchedules.some(existing =>
        !(schedule.endDate <= existing.startDate || schedule.startDate >= existing.endDate)
      )
      if (!hasConflict) {
        targetRowIndex = rowIdx
        break
      }
    }

    // 빈 행이 없으면 행 추가
    let needsNewRow = false
    if (targetRowIndex === -1) {
      targetRowIndex = currentRowCount
      needsNewRow = true
    }

    try {
      if (needsNewRow) {
        await updateTeamMember(workspaceId, memberId, {
          rowCount: currentRowCount + 1,
        })
        const { updateMember } = useAppStore.getState()
        updateMember(memberId, { rowCount: currentRowCount + 1 })
      }

      // 기존 일정 생성 패턴과 동일: 필수 필드만 포함, optional 필드는 값이 있을 때만
      const scheduleData: Record<string, any> = {
        memberId: schedule.memberId,
        title: schedule.title,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        color: schedule.color,
        rowIndex: targetRowIndex,
        createdBy: currentUser.uid,
      }
      if (schedule.comment) scheduleData.comment = schedule.comment
      if (schedule.link) scheduleData.link = schedule.link
      if (schedule.textColor) scheduleData.textColor = schedule.textColor
      if (schedule.projectId) scheduleData.projectId = schedule.projectId

      const newId = await createScheduleFirebase(workspaceId, scheduleData as any)

      pushHistory({
        type: 'schedule_create',
        description: `${member?.name || '구성원'} 일정 복제`,
        undoData: { scheduleId: newId },
        redoData: { schedule: scheduleData },
      })
    } catch (error) {
      console.error('일정 복제 실패:', error)
    }
  }, [workspaceId, currentUser, schedule, members, schedules, pushHistory])

  // Shift+드래그 복제용 Shift 키 상태 추적
  const isShiftDragRef = useRef(false)
  const [isShiftDragging, setIsShiftDragging] = useState(false)

  // 공통 상호작용 훅 사용
  const {
    cardRef,
    isHovered,
    isSelected,
    showTooltip,
    isDragging,
    isResizing,
    showDeleteConfirm,
    contextMenu,
    editPopup,
    setIsDragging,
    setIsResizing,
    setShowDeleteConfirm,
    setContextMenu,
    setEditPopup,
    setIsSelected,
    handleDoubleClick,
    handleClick,
    handleContextMenu,
    handleMouseEnter,
    handleMouseLeave,
  } = useCardInteractions({ isReadOnly, onDuplicate: handleDuplicate })

  // 충돌 상태 (ScheduleCard 전용)
  const [isColliding, setIsColliding] = useState(false)

  // 현재 위치/크기 계산
  const calculatedWidth = dateRangeToWidth(
    new Date(schedule.startDate),
    new Date(schedule.endDate),
    zoomLevel,
    columnWidthScale
  )
  const currentWidth = visibleWidth !== undefined ? visibleWidth : calculatedWidth

  // 과거 일정 여부 확인 (연차는 제외 - 항상 원래 색상 유지)
  const isAnnualLeave = schedule.color === ANNUAL_LEAVE_COLOR
  const isPast = !isAnnualLeave && schedule.endDate < Date.now()

  // 편집 팝업 저장
  const handleEditSave = async (title: string, comment: string, link: string, projectId?: string) => {
    setEditPopup(null)

    if (workspaceId) {
      // undefined 값 제거 (Firestore는 undefined 값을 허용하지 않음)
      const updates: Record<string, any> = { title, comment: comment || '', link: link || '' }
      if (projectId !== undefined) {
        updates.projectId = projectId
      }

      // 로컬 상태 즉시 반영
      const { updateSchedule } = useAppStore.getState()
      updateSchedule(schedule.id, updates)

      try {
        await updateScheduleFirebase(workspaceId, schedule.id, updates)
      } catch (error) {
        console.error('일정 수정 실패:', error)
        // 실패 시 원래 값으로 롤백
        updateSchedule(schedule.id, {
          title: schedule.title,
          comment: schedule.comment,
          link: schedule.link,
          projectId: schedule.projectId,
        })
      }
    }
  }

  // 일정 삭제
  const handleDelete = async () => {
    if (!workspaceId) return
    try {
      const scheduleData = {
        memberId: schedule.memberId,
        title: schedule.title,
        comment: schedule.comment,
        link: schedule.link,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        color: schedule.color,
        textColor: schedule.textColor,
        projectId: schedule.projectId,
        rowIndex: schedule.rowIndex,
        createdBy: schedule.createdBy,
      }

      await deleteScheduleFirebase(workspaceId, schedule.id)

      const member = members.find((m) => m.id === schedule.memberId)
      pushHistory({
        type: 'schedule_delete',
        description: `${member?.name || '구성원'} 일정 삭제`,
        undoData: { schedule: scheduleData },
        redoData: { scheduleId: schedule.id },
      })

      setShowDeleteConfirm(false)
      setIsSelected(false)
    } catch (error) {
      console.error('일정 삭제 실패:', error)
    }
  }

  // 색상 변경
  const handleColorChange = async (color: string) => {
    if (!workspaceId) return

    const { updateSchedule } = useAppStore.getState()
    updateSchedule(schedule.id, { color })

    try {
      await updateScheduleFirebase(workspaceId, schedule.id, { color })
    } catch (error) {
      console.error('색상 변경 실패:', error)
      updateSchedule(schedule.id, { color: schedule.color })
    }
  }

  // 업무 이관
  const handleTransfer = async (targetMemberId: string) => {
    if (!workspaceId) return

    const targetMember = members.find((m) => m.id === targetMemberId)
    if (!targetMember) return

    const targetSchedules = schedules.filter((s) => s.memberId === targetMemberId)
    const targetRowCount = targetMember.rowCount || 1

    let availableRowIndex = -1
    for (let rowIdx = 0; rowIdx < targetRowCount; rowIdx++) {
      const rowSchedules = targetSchedules.filter((s) => (s.rowIndex || 0) === rowIdx)
      const hasConflict = rowSchedules.some((existingSchedule) => {
        return (
          schedule.startDate < existingSchedule.endDate &&
          schedule.endDate > existingSchedule.startDate
        )
      })

      if (!hasConflict) {
        availableRowIndex = rowIdx
        break
      }
    }

    let newRowIndex = availableRowIndex
    let needsNewRow = false
    if (availableRowIndex === -1) {
      newRowIndex = targetRowCount
      needsNewRow = true
    }

    try {
      if (needsNewRow) {
        await updateTeamMember(workspaceId, targetMemberId, {
          rowCount: targetRowCount + 1,
        })
      }

      const updates = {
        memberId: targetMemberId,
        rowIndex: newRowIndex,
      }

      const { updateSchedule } = useAppStore.getState()
      updateSchedule(schedule.id, updates)
      await updateScheduleFirebase(workspaceId, schedule.id, updates)
    } catch (error) {
      console.error('업무 이관 실패:', error)
      const { updateSchedule } = useAppStore.getState()
      updateSchedule(schedule.id, {
        memberId: schedule.memberId,
        rowIndex: schedule.rowIndex,
      })
    }
  }

  // 겹침 검사
  const checkCollisionAt = (newX: number, newWidth: number, newRowIndex?: number): boolean => {
    const newStartDate = pixelsToDate(newX, currentYear, zoomLevel, columnWidthScale)
    const newEndDate = pixelsToDate(newX + newWidth, currentYear, zoomLevel, columnWidthScale)

    const tempSchedule: Schedule = {
      ...schedule,
      startDate: newStartDate.getTime(),
      endDate: newEndDate.getTime(),
      rowIndex: newRowIndex !== undefined ? newRowIndex : schedule.rowIndex,
    }

    return hasCollision(tempSchedule, schedules)
  }

  // 드래그 시작
  const handleDragStart = (e: any) => {
    if (isReadOnly) return
    setIsDragging(true)
    setDragging(true, schedule)
    setIsSelected(true)

    // Shift 키 감지 (Shift+드래그 = 복제)
    const shiftPressed = !!(e as MouseEvent)?.shiftKey
    isShiftDragRef.current = shiftPressed
    setIsShiftDragging(shiftPressed)

    // 다중 선택 상태에서 드래그 시작하면 다중 드래그 모드
    if (isMultiSelected && onMultiDragStart) {
      onMultiDragStart()
    }
  }

  // 드래그 중: 다중 선택 시 리더 카드의 deltaX/deltaY를 팔로워에 전달
  const handleDrag = (_e: any, data: DraggableData) => {
    if (isMultiSelected && onMultiDragMove) {
      const adjustedX = data.x - CARD_MARGIN
      const snappedX = snapToGrid(adjustedX, cellWidth)
      const deltaX = snappedX - x
      const deltaY = data.y - CARD_MARGIN - y
      onMultiDragMove(deltaX, deltaY)
    }
  }

  // 드래그 종료
  const handleDragStop = (_e: any, data: DraggableData) => {
    if (isReadOnly) return
    const wasShiftDrag = isShiftDragRef.current
    isShiftDragRef.current = false
    setIsShiftDragging(false)
    setIsDragging(false)
    setDragging(false)

    // 다중 드래그 모드일 때: deltaX/deltaY 계산 후 콜백 호출
    if (isMultiSelected && onMultiDragEnd) {
      const adjustedX = data.x - CARD_MARGIN
      const snappedX = snapToGrid(adjustedX, cellWidth)
      const deltaX = snappedX - x
      const deltaY = data.y - CARD_MARGIN - y
      onMultiDragEnd(deltaX, deltaY)
      return  // 개별 업데이트 건너뜀
    }

    // x 좌표 계산 (그리드 스냅)
    const adjustedX = data.x - CARD_MARGIN
    const snappedX = snapToGrid(adjustedX, cellWidth)
    const newStartDate = pixelsToDate(snappedX, currentYear, zoomLevel, columnWidthScale)
    const duration = schedule.endDate - schedule.startDate
    const newEndDate = new Date(newStartDate.getTime() + duration)

    // y 좌표에서 새 행 인덱스 계산
    const currentRowIndex = schedule.rowIndex || 0
    const adjustedY = data.y - CARD_MARGIN
    const newRowIndex = Math.max(0, Math.min(totalRows - 1, Math.round(adjustedY / cellHeight)))

    if (newStartDate.getTime() === schedule.startDate && newRowIndex === currentRowIndex) {
      return
    }

    const colliding = checkCollisionAt(snappedX, currentWidth, newRowIndex)
    setIsColliding(colliding)
    onCollisionChange?.(colliding)

    if (colliding) {
      return
    }

    // Shift+드래그: 원본은 그대로 두고, 드래그 위치에 복제본 생성
    if (wasShiftDrag && workspaceId && currentUser) {
      const scheduleData: Record<string, any> = {
        memberId: schedule.memberId,
        title: schedule.title,
        startDate: newStartDate.getTime(),
        endDate: newEndDate.getTime(),
        color: schedule.color,
        rowIndex: newRowIndex,
        createdBy: currentUser.uid,
      }
      if (schedule.comment) scheduleData.comment = schedule.comment
      if (schedule.link) scheduleData.link = schedule.link
      if (schedule.textColor) scheduleData.textColor = schedule.textColor
      if (schedule.projectId) scheduleData.projectId = schedule.projectId

      createScheduleFirebase(workspaceId, scheduleData as any).then((newId) => {
        const member = members.find(m => m.id === schedule.memberId)
        pushHistory({
          type: 'schedule_create',
          description: `${member?.name || '구성원'} 일정 복제 (Shift+드래그)`,
          undoData: { scheduleId: newId },
          redoData: { schedule: scheduleData },
        })
      }).catch((error) => {
        console.error('Shift+드래그 복제 실패:', error)
      })
      return  // 원본 이동 건너뜀
    }

    // 일반 드래그: 원본 위치 업데이트
    const updates: Partial<Schedule> = {
      startDate: newStartDate.getTime(),
      endDate: newEndDate.getTime(),
    }

    if (newRowIndex !== currentRowIndex) {
      updates.rowIndex = newRowIndex
    }

    const { updateSchedule } = useAppStore.getState()
    updateSchedule(schedule.id, updates)

    // Firebase 쓰기는 debounce 적용 (500ms)
    if (workspaceId) {
      debouncedFirebaseUpdate(
        `schedule-drag-${schedule.id}`,
        async () => {
          await updateScheduleFirebase(workspaceId, schedule.id, updates)
        },
        500
      )
    }
  }

  // 리사이즈 종료
  const handleResizeStop = (
    _e: any,
    direction: string,
    ref: HTMLElement,
    _delta: ResizableDelta,
    position: Position
  ) => {
    if (isReadOnly) return
    setIsResizing(false)

    const newWidth = snapToGrid(parseInt(ref.style.width) + CARD_MARGIN * 2, cellWidth)
    const adjustedPosition = position.x - CARD_MARGIN
    const newX = direction.includes('left')
      ? snapToGrid(adjustedPosition, cellWidth)
      : x

    const newStartDate = pixelsToDate(newX, currentYear, zoomLevel, columnWidthScale)
    const newEndDate = pixelsToDate(newX + newWidth, currentYear, zoomLevel, columnWidthScale)

    const colliding = checkCollisionAt(newX, newWidth)
    setIsColliding(colliding)
    onCollisionChange?.(colliding)

    if (colliding) {
      return
    }

    const updates = {
      startDate: newStartDate.getTime(),
      endDate: newEndDate.getTime(),
    }

    const { updateSchedule } = useAppStore.getState()
    updateSchedule(schedule.id, updates)

    // Firebase 쓰기는 debounce 적용 (500ms)
    if (workspaceId) {
      debouncedFirebaseUpdate(
        `schedule-resize-${schedule.id}`,
        async () => {
          await updateScheduleFirebase(workspaceId, schedule.id, updates)
        },
        500
      )
    }
  }

  // Rnd 공통 설정
  const rndConfig = getRndConfig({
    cellWidth,
    cellHeight,
    isReadOnly,
    isHovered,
    isResizing,
    totalRows,
  })

  // 카드 스타일 클래스 (다중 선택 시 isSelected 활성화)
  const cardClassName = getCardClassName({
    isReadOnly,
    isSelected: isSelected || isMultiSelected,
    isDragging,
    isResizing,
    isColliding,
  })

  // 팔로워 카드는 multiDragDelta로 오프셋 적용
  const effectiveX = multiDragDeltaX != null ? x + multiDragDeltaX : x
  const effectiveY = multiDragDeltaY != null ? y + multiDragDeltaY : y

  return (
    <>
      {/* Shift+드래그 시 원본 카드 팬텀 (제자리에 유지) */}
      {isShiftDragging && (
        <div
          className="!absolute pointer-events-none"
          style={{
            left: `${x + CARD_MARGIN}px`,
            top: `${y + CARD_MARGIN}px`,
            width: `${currentWidth - CARD_MARGIN * 2}px`,
            height: `${cellHeight - CARD_MARGIN * 2}px`,
            zIndex: 9,
          }}
        >
          <div
            className="h-full rounded-md border-2 border-transparent select-none relative overflow-hidden"
            style={{
              backgroundColor: isPast ? '#9ca3af' : schedule.color,
              color: schedule.textColor || '#ffffff',
            }}
          >
            <div className="flex items-center h-full px-1.5 overflow-hidden">
              <span className="text-sm font-medium leading-tight overflow-hidden whitespace-nowrap">
                {schedule.title || '제목 없음'}
              </span>
            </div>
          </div>
        </div>
      )}

      <Rnd
        key={`${schedule.id}-${schedule.startDate}-${schedule.endDate}-${schedule.rowIndex}`}
        position={{ x: effectiveX + CARD_MARGIN, y: effectiveY + CARD_MARGIN }}
        size={{ width: currentWidth - CARD_MARGIN * 2, height: cellHeight - CARD_MARGIN * 2 }}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        onResizeStart={() => !isReadOnly && setIsResizing(true)}
        onResizeStop={handleResizeStop}
        disableDragging={isReadOnly || (multiDragDeltaX != null)}
        {...rndConfig}
        className="!absolute schedule-card"
        style={{
          zIndex: isDragging || isResizing || isSelected ? 100 : 10,
          opacity: isShiftDragging ? 0.55 : undefined,
        }}
      >
        <div
          ref={cardRef}
          className={cardClassName}
          style={{
            backgroundColor: isPast ? '#9ca3af' : schedule.color,
            color: schedule.textColor || '#ffffff',
          }}
          onDoubleClick={handleDoubleClick}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* 좌측 리사이즈 핸들 */}
          {!isReadOnly && (
            <div
              className={`absolute left-0 top-0 h-full w-1 flex items-center justify-center transition-opacity ${isHovered || isResizing ? 'opacity-100' : 'opacity-0'}`}
              style={{ backgroundColor: 'rgba(255,255,255,0.4)' }}
            >
              <div className="w-0.5 h-3 bg-white/80 rounded" />
            </div>
          )}

          {/* 콘텐츠 영역 */}
          <div className="flex items-center h-full px-1.5 overflow-hidden">
            <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
              <span className="text-sm font-medium leading-tight overflow-hidden whitespace-nowrap">
                {schedule.title || '제목 없음'}
              </span>
              {/* columnWidthScale 또는 zoomLevel이 0.75 미만일 때는 프로젝트명 숨김 */}
              {columnWidthScale >= 0.75 && zoomLevel >= 0.75 && schedule.projectId && (() => {
                const project = projects.find(p => p.id === schedule.projectId)
                return project ? (
                  <span className="text-[10px] opacity-80 leading-tight overflow-hidden whitespace-nowrap">
                    {project.name}
                  </span>
                ) : null
              })()}
            </div>
          </div>

          {/* 링크 버튼 */}
          {schedule.link && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (schedule.link) {
                  window.open(schedule.link, '_blank', 'noopener,noreferrer')
                }
              }}
              className="absolute bottom-0.5 right-0.5 p-0.5 rounded bg-black/30 opacity-70 hover:opacity-100 transition-opacity"
              title="링크 열기"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          )}

          {/* 우측 리사이즈 핸들 */}
          {!isReadOnly && (
            <div
              className={`absolute right-0 top-0 h-full w-1 flex items-center justify-center transition-opacity ${isHovered || isResizing ? 'opacity-100' : 'opacity-0'}`}
              style={{ backgroundColor: 'rgba(255,255,255,0.4)' }}
            >
              <div className="w-0.5 h-3 bg-white/80 rounded" />
            </div>
          )}
        </div>
      </Rnd>

      {/* 삭제 확인 다이얼로그 */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="일정 삭제"
          message={`"${schedule.title || '제목 없음'}" 일정을 삭제하시겠습니까?`}
          confirmText="삭제"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          isDestructive
        />
      )}

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          currentColor={schedule.color}
          onColorChange={handleColorChange}
          onClose={() => setContextMenu(null)}
          members={members}
          currentMemberId={schedule.memberId}
          onTransfer={handleTransfer}
        />
      )}

      {/* 호버 툴팁 */}
      {showTooltip && (schedule.comment || schedule.title || schedule.projectId) && (() => {
        const rect = cardRef.current?.getBoundingClientRect()
        if (!rect) return null

        const project = schedule.projectId ? projects.find(p => p.id === schedule.projectId) : null
        // 각 요소별 높이를 넉넉하게 계산
        let tooltipHeight = 36  // 기본 패딩 + 제목 높이
        if (project) tooltipHeight += 20
        if (schedule.comment) tooltipHeight += 24
        const TOOLTIP_GAP = 6  // 카드와 툴팁 사이 간격

        // 카드 위에 표시 (카드를 가리지 않도록 간격 확보)
        let tooltipTop = rect.top - tooltipHeight - TOOLTIP_GAP
        // 화면 상단을 넘어가면 카드 아래에 표시
        if (tooltipTop < 4) {
          tooltipTop = rect.bottom + TOOLTIP_GAP
        }

        return (
          <div
            className="fixed bg-card border border-border rounded-md shadow-lg px-3 py-2.5 z-[250] max-w-xs pointer-events-none"
            style={{
              left: `${rect.left}px`,
              top: `${tooltipTop}px`,
            }}
          >
            {project && (
              <div className="text-[10px] text-muted-foreground mb-1">
                {project.name}
              </div>
            )}
            <div className="text-sm font-semibold text-foreground leading-snug">
              {schedule.title || '제목 없음'}
            </div>
            {schedule.comment && (
              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {schedule.comment}
              </div>
            )}
          </div>
        )
      })()}

      {/* 편집 팝업 */}
      {editPopup && (
        <ScheduleEditPopup
          title={schedule.title}
          comment={schedule.comment}
          link={schedule.link}
          projectId={schedule.projectId}
          projects={projects}
          position={editPopup}
          onSave={handleEditSave}
          onCancel={() => setEditPopup(null)}
        />
      )}
    </>
  )
}, areScheduleCardPropsEqual)
