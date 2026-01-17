// 일정 카드 컴포넌트 (Phase 2: 드래그 앤 드롭 + 리사이즈 핸들 + Delete 삭제)

import { useState, useRef, useEffect } from 'react'
import { Rnd, DraggableData, ResizableDelta, Position } from 'react-rnd'
import { Schedule } from '../../types/schedule'
import { CELL_HEIGHT } from '../../lib/constants/grid'
import { dateRangeToWidth, pixelsToDate } from '../../lib/utils/dateUtils'
import { getCellWidth, snapToGrid } from '../../lib/utils/gridUtils'
import { useAppStore } from '../../store/useAppStore'
import {
  updateSchedule as updateScheduleFirebase,
  deleteSchedule as deleteScheduleFirebase,
} from '../../lib/firebase/firestore'
import { hasCollision } from '../../lib/utils/collisionDetection'
import { Link as LinkIcon, ExternalLink } from 'lucide-react'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { ContextMenu } from './ContextMenu'
import { ScheduleEditPopup } from './ScheduleEditPopup'

interface ScheduleCardProps {
  schedule: Schedule
  x: number
  isReadOnly?: boolean
  totalRows?: number
  onCollisionChange?: (isColliding: boolean) => void
  onRowChange?: (newRowIndex: number) => void
}

export function ScheduleCard({
  schedule,
  x,
  isReadOnly = false,
  totalRows = 1,
  onCollisionChange,
}: ScheduleCardProps) {
  const { zoomLevel, currentYear, workspaceId, schedules, setDragging } = useAppStore()
  const cellWidth = getCellWidth(zoomLevel)
  const cardRef = useRef<HTMLDivElement>(null)

  // 편집 팝업 상태
  const [editPopup, setEditPopup] = useState<{ x: number; y: number } | null>(null)

  // 호버/선택 상태
  const [isHovered, setIsHovered] = useState(false)
  const [isSelected, setIsSelected] = useState(false)

  // 툴팁 상태
  const [showTooltip, setShowTooltip] = useState(false)

  // 드래그/리사이즈 상태
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isColliding, setIsColliding] = useState(false)

  // 삭제 확인 다이얼로그 상태
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // 현재 위치/크기 (schedule 데이터 기반으로 계산)
  const currentWidth = dateRangeToWidth(
    new Date(schedule.startDate),
    new Date(schedule.endDate),
    zoomLevel
  )

  // 과거 일정 여부 확인 (종료 날짜가 오늘 이전)
  const isPast = schedule.endDate < Date.now()

  // Delete 키 이벤트 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSelected && (e.key === 'Delete' || e.key === 'Backspace') && !editPopup) {
        e.preventDefault()
        setShowDeleteConfirm(true)
      }
      // Escape 키로 선택 해제
      if (e.key === 'Escape') {
        setIsSelected(false)
        setEditPopup(null)
      }
    }

    if (isSelected) {
      window.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSelected, editPopup])

  // 카드 외부 클릭 시 선택 해제
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsSelected(false)
      }
    }

    if (isSelected) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSelected])

  // 더블 클릭: 편집 팝업 표시
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isReadOnly) return
    e.stopPropagation()

    // 카드 위치 계산
    const rect = cardRef.current?.getBoundingClientRect()
    if (rect) {
      setEditPopup({
        x: rect.left,
        y: rect.bottom + 8, // 카드 아래 8px 간격
      })
    }
  }

  // 클릭: 카드 선택
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isReadOnly) {
      setIsSelected(true)
    }
  }

  // 편집 팝업 저장
  const handleEditSave = async (title: string, comment: string, link: string) => {
    setEditPopup(null)

    if (workspaceId) {
      try {
        await updateScheduleFirebase(workspaceId, schedule.id, { title, comment, link })
      } catch (error) {
        console.error('일정 수정 실패:', error)
      }
    }
  }

  // 편집 팝업 취소
  const handleEditCancel = () => {
    setEditPopup(null)
  }

  // 일정 삭제
  const handleDelete = async () => {
    if (!workspaceId) return
    try {
      await deleteScheduleFirebase(workspaceId, schedule.id)
      setShowDeleteConfirm(false)
      setIsSelected(false)
    } catch (error) {
      console.error('일정 삭제 실패:', error)
    }
  }

  // 우클릭 메뉴
  const handleContextMenu = (e: React.MouseEvent) => {
    if (isReadOnly) return
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  // 색상 변경
  const handleColorChange = async (color: string) => {
    if (!workspaceId) return

    // 낙관적 업데이트
    const { updateSchedule } = useAppStore.getState()
    updateSchedule(schedule.id, { color })

    // Firebase 업데이트
    try {
      await updateScheduleFirebase(workspaceId, schedule.id, { color })
    } catch (error) {
      console.error('색상 변경 실패:', error)
      // 실패 시 롤백
      updateSchedule(schedule.id, { color: schedule.color })
    }
  }

  // 겹침 검사 (rowIndex도 고려)
  const checkCollisionAt = (newX: number, newWidth: number, newRowIndex?: number): boolean => {
    const newStartDate = pixelsToDate(newX, currentYear, zoomLevel)
    const newEndDate = pixelsToDate(newX + newWidth, currentYear, zoomLevel)

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
  const handleDragStop = async (_e: any, data: DraggableData) => {
    if (isReadOnly) return
    setIsDragging(false)
    setDragging(false)

    const snappedX = snapToGrid(data.x, cellWidth)
    const newStartDate = pixelsToDate(snappedX, currentYear, zoomLevel)
    const duration = schedule.endDate - schedule.startDate
    const newEndDate = new Date(newStartDate.getTime() + duration)

    // Y 위치 기반으로 새 rowIndex 계산
    const currentRowIndex = schedule.rowIndex || 0
    const rowDelta = Math.round(data.y / CELL_HEIGHT)
    const newRowIndex = Math.max(0, Math.min(totalRows - 1, currentRowIndex + rowDelta))

    // 겹침 검사 (새 rowIndex 포함)
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

    // rowIndex가 변경된 경우만 업데이트
    if (newRowIndex !== currentRowIndex) {
      updates.rowIndex = newRowIndex
    }

    // 낙관적 업데이트: Firebase 전에 로컬 상태 먼저 업데이트 (깜빡임 방지)
    const { updateSchedule } = useAppStore.getState()
    updateSchedule(schedule.id, updates)

    // Firebase 업데이트 (비동기)
    if (workspaceId) {
      try {
        await updateScheduleFirebase(workspaceId, schedule.id, updates)
      } catch (error) {
        console.error('일정 업데이트 실패:', error)
        // 실패 시 롤백 (옵션)
        updateSchedule(schedule.id, {
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          rowIndex: schedule.rowIndex,
        })
      }
    }
  }

  // 리사이즈 종료
  const handleResizeStop = async (
    _e: any,
    direction: string,
    ref: HTMLElement,
    delta: ResizableDelta,
    position: Position
  ) => {
    if (isReadOnly) return
    setIsResizing(false)

    const newWidth = snapToGrid(parseInt(ref.style.width), cellWidth)
    const newX = direction.includes('left')
      ? snapToGrid(position.x, cellWidth)
      : x

    const newStartDate = pixelsToDate(newX, currentYear, zoomLevel)
    const newEndDate = pixelsToDate(newX + newWidth, currentYear, zoomLevel)

    // 겹침 검사
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

    // 낙관적 업데이트: Firebase 전에 로컬 상태 먼저 업데이트 (깜빡임 방지)
    const { updateSchedule } = useAppStore.getState()
    updateSchedule(schedule.id, updates)

    // Firebase 업데이트 (비동기)
    if (workspaceId) {
      try {
        await updateScheduleFirebase(workspaceId, schedule.id, updates)
      } catch (error) {
        console.error('일정 리사이즈 실패:', error)
        // 실패 시 롤백
        updateSchedule(schedule.id, {
          startDate: schedule.startDate,
          endDate: schedule.endDate,
        })
      }
    }
  }

  return (
    <>
      <Rnd
        key={`${schedule.id}-${schedule.startDate}-${schedule.endDate}-${schedule.rowIndex}`}
        position={{ x, y: 0 }}
        size={{ width: currentWidth, height: CELL_HEIGHT - 8 }}
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onResizeStart={() => !isReadOnly && setIsResizing(true)}
        onResizeStop={handleResizeStop}
        disableDragging={isReadOnly}
        enableResizing={
          isReadOnly
            ? false
            : {
                left: true,
                right: true,
                top: false,
                bottom: false,
                topLeft: false,
                topRight: false,
                bottomLeft: false,
                bottomRight: false,
              }
        }
        resizeGrid={[cellWidth, CELL_HEIGHT]}
        dragGrid={[cellWidth, CELL_HEIGHT]}
        minWidth={cellWidth}
        className="!absolute !top-1 schedule-card"
        style={{ zIndex: isDragging || isResizing || isSelected ? 100 : 10 }}
        resizeHandleStyles={{
          left: { width: '12px', left: '0', cursor: 'ew-resize' },
          right: { width: '12px', right: '0', cursor: 'ew-resize' },
        }}
        resizeHandleClasses={{
          left: `transition-opacity ${isHovered || isResizing ? 'opacity-100' : 'opacity-0'}`,
          right: `transition-opacity ${isHovered || isResizing ? 'opacity-100' : 'opacity-0'}`,
        }}
      >
        <div
          ref={cardRef}
          className={`h-full rounded-md border-2 transition-all select-none relative overflow-hidden
            ${isReadOnly ? 'cursor-default' : 'cursor-move'}
            ${isColliding ? 'border-red-500 shadow-lg shadow-red-500/30' : ''}
            ${isSelected ? 'border-white ring-2 ring-primary' : 'border-transparent hover:border-white/30'}
            ${isDragging || isResizing ? 'opacity-90 shadow-xl scale-[1.02]' : ''}
            ${isPast ? 'opacity-60' : ''}
          `}
          style={{
            backgroundColor: isPast ? '#9ca3af' : schedule.color,
            color: schedule.textColor || '#ffffff',
          }}
          onDoubleClick={handleDoubleClick}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onMouseEnter={() => {
            setIsHovered(true)
            setShowTooltip(true)
          }}
          onMouseLeave={() => {
            setIsHovered(false)
            setShowTooltip(false)
          }}
        >
          {/* 좌측 리사이즈 핸들 */}
          {!isReadOnly && (
            <div
              className={`absolute left-0 top-0 h-full w-2 flex items-center justify-center transition-opacity ${isHovered || isResizing ? 'opacity-100' : 'opacity-0'}`}
              style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
            >
              <div className="w-0.5 h-4 bg-white/70 rounded" />
            </div>
          )}

          {/* 콘텐츠 영역 */}
          <div className="flex items-center gap-2 h-full px-4">
            <span className="text-sm font-medium truncate flex-1">
              {schedule.title || '제목 없음'}
            </span>
            {schedule.link && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (schedule.link) {
                    window.open(schedule.link, '_blank', 'noopener,noreferrer')
                  }
                }}
                className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                title="링크 열기"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 우측 리사이즈 핸들 */}
          {!isReadOnly && (
            <div
              className={`absolute right-0 top-0 h-full w-2 flex items-center justify-center transition-opacity ${isHovered || isResizing ? 'opacity-100' : 'opacity-0'}`}
              style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
            >
              <div className="w-0.5 h-4 bg-white/70 rounded" />
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
        />
      )}

      {/* 호버 툴팁 */}
      {showTooltip && (schedule.comment || schedule.title) && (() => {
        const rect = cardRef.current?.getBoundingClientRect()
        if (!rect) return null

        return (
          <div
            className="fixed bg-card border border-border rounded-md shadow-lg px-3 py-2 z-[250] max-w-xs pointer-events-none"
            style={{
              left: `${rect.left}px`,
              top: `${rect.top - 65}px`,
            }}
          >
            <div className="text-sm font-semibold text-foreground mb-1">
              {schedule.title || '제목 없음'}
            </div>
            {schedule.comment && (
              <div className="text-xs text-muted-foreground">
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
          position={editPopup}
          onSave={handleEditSave}
          onCancel={handleEditCancel}
        />
      )}
    </>
  )
}
