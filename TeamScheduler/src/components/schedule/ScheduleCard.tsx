// 일정 카드 컴포넌트 (Phase 2: 드래그 앤 드롭 + 리사이즈 핸들 + Delete 삭제)

import { useState, memo } from 'react'
import { Rnd, DraggableData, ResizableDelta, Position } from 'react-rnd'
import { Schedule } from '../../types/schedule'
import { dateRangeToWidth, pixelsToDate } from '../../lib/utils/dateUtils'
import { getCellWidth, getCellHeight, snapToGrid } from '../../lib/utils/gridUtils'
import { useAppStore } from '../../store/useAppStore'
import {
  updateSchedule as updateScheduleFirebase,
  deleteSchedule as deleteScheduleFirebase,
  updateTeamMember,
} from '../../lib/firebase/firestore'
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
  isReadOnly?: boolean
  totalRows?: number
  visibleWidth?: number // 월 필터링 시 클리핑된 너비
  onCollisionChange?: (isColliding: boolean) => void
  onRowChange?: (newRowIndex: number) => void
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
    prev.isReadOnly === next.isReadOnly &&
    prev.totalRows === next.totalRows &&
    prev.visibleWidth === next.visibleWidth
  )
}

export const ScheduleCard = memo(function ScheduleCard({
  schedule,
  x,
  isReadOnly = false,
  totalRows = 1,
  visibleWidth,
  onCollisionChange,
}: ScheduleCardProps) {
  // Zustand 선택적 구독
  const zoomLevel = useAppStore(state => state.zoomLevel)
  const columnWidthScale = useAppStore(state => state.columnWidthScale)
  const currentYear = useAppStore(state => state.currentYear)
  const workspaceId = useAppStore(state => state.workspaceId)
  const schedules = useAppStore(state => state.schedules)
  const setDragging = useAppStore(state => state.setDragging)
  const members = useAppStore(state => state.members)
  const projects = useAppStore(state => state.projects)
  const pushHistory = useAppStore(state => state.pushHistory)

  const cellWidth = getCellWidth(zoomLevel, columnWidthScale)
  const cellHeight = getCellHeight(zoomLevel)

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
  } = useCardInteractions({ isReadOnly })

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
      try {
        await updateScheduleFirebase(workspaceId, schedule.id, { title, comment, link, projectId })
      } catch (error) {
        console.error('일정 수정 실패:', error)
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
  const handleDragStart = () => {
    if (isReadOnly) return
    setIsDragging(true)
    setDragging(true, schedule)
    setIsSelected(true)
  }

  // 드래그 종료
  const handleDragStop = (_e: any, data: DraggableData) => {
    if (isReadOnly) return
    setIsDragging(false)
    setDragging(false)

    const adjustedX = data.x - CARD_MARGIN
    const snappedX = snapToGrid(adjustedX, cellWidth)
    const newStartDate = pixelsToDate(snappedX, currentYear, zoomLevel, columnWidthScale)
    const duration = schedule.endDate - schedule.startDate
    const newEndDate = new Date(newStartDate.getTime() + duration)

    const currentRowIndex = schedule.rowIndex || 0
    const rowDelta = Math.round(data.y / cellHeight)
    const newRowIndex = Math.max(0, Math.min(totalRows - 1, currentRowIndex + rowDelta))

    if (newStartDate.getTime() === schedule.startDate && newRowIndex === currentRowIndex) {
      return
    }

    const colliding = checkCollisionAt(snappedX, currentWidth, newRowIndex)
    setIsColliding(colliding)
    onCollisionChange?.(colliding)

    if (colliding) {
      return
    }

    const updates: Partial<Schedule> = {
      startDate: newStartDate.getTime(),
      endDate: newEndDate.getTime(),
    }

    if (newRowIndex !== currentRowIndex) {
      updates.rowIndex = newRowIndex
    }

    const { updateSchedule } = useAppStore.getState()
    updateSchedule(schedule.id, updates)

    if (workspaceId) {
      updateScheduleFirebase(workspaceId, schedule.id, updates).catch((error) => {
        console.error('일정 업데이트 실패:', error)
        updateSchedule(schedule.id, {
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          rowIndex: schedule.rowIndex,
        })
      })
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

    if (workspaceId) {
      updateScheduleFirebase(workspaceId, schedule.id, updates).catch((error) => {
        console.error('일정 리사이즈 실패:', error)
        updateSchedule(schedule.id, {
          startDate: schedule.startDate,
          endDate: schedule.endDate,
        })
      })
    }
  }

  // Rnd 공통 설정
  const rndConfig = getRndConfig({
    cellWidth,
    cellHeight,
    isReadOnly,
    isHovered,
    isResizing,
  })

  // 카드 스타일 클래스
  const cardClassName = getCardClassName({
    isReadOnly,
    isSelected,
    isDragging,
    isResizing,
    isColliding,
    isPast,
  })

  return (
    <>
      <Rnd
        key={`${schedule.id}-${schedule.startDate}-${schedule.endDate}-${schedule.rowIndex}`}
        position={{ x: x + CARD_MARGIN, y: CARD_MARGIN }}
        size={{ width: currentWidth - CARD_MARGIN * 2, height: cellHeight - CARD_MARGIN * 2 }}
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onResizeStart={() => !isReadOnly && setIsResizing(true)}
        onResizeStop={handleResizeStop}
        disableDragging={isReadOnly}
        {...rndConfig}
        className="!absolute schedule-card"
        style={{ zIndex: isDragging || isResizing || isSelected ? 100 : 10 }}
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
              {/* columnWidthScale 0.5 이하일 때는 프로젝트명 숨김 */}
              {columnWidthScale > 0.5 && schedule.projectId && (() => {
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
        let tooltipHeight = 28
        if (project) tooltipHeight += 18
        if (schedule.comment) tooltipHeight += 20

        return (
          <div
            className="fixed bg-card border border-border rounded-md shadow-lg px-3 py-2 z-[250] max-w-xs pointer-events-none"
            style={{
              left: `${rect.left}px`,
              top: `${rect.top - tooltipHeight - 2}px`,
            }}
          >
            {project && (
              <div className="text-[10px] text-muted-foreground mb-0.5">
                {project.name}
              </div>
            )}
            <div className="text-sm font-semibold text-foreground">
              {schedule.title || '제목 없음'}
            </div>
            {schedule.comment && (
              <div className="text-xs text-muted-foreground mt-0.5">
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
