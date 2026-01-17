// 글로벌 이벤트 카드 컴포넌트 (통합 탭에서만 편집 가능)

import { useState, useRef, useEffect } from 'react'
import { Rnd, DraggableData, ResizableDelta, Position } from 'react-rnd'
import { ExternalLink } from 'lucide-react'
import { GlobalEvent } from '../../types/globalEvent'
import { dateRangeToWidth, pixelsToDate } from '../../lib/utils/dateUtils'
import { getCellWidth, getCellHeight, snapToGrid } from '../../lib/utils/gridUtils'
import { useAppStore } from '../../store/useAppStore'
import {
  updateGlobalEvent as updateGlobalEventFirebase,
  deleteGlobalEvent as deleteGlobalEventFirebase,
} from '../../lib/firebase/firestore'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { ScheduleEditPopup } from './ScheduleEditPopup'
import { ContextMenu } from './ContextMenu'

interface GlobalEventCardProps {
  event: GlobalEvent
  x: number
  isReadOnly?: boolean
  totalRows?: number
  visibleWidth?: number // 월 필터링 시 클리핑된 너비
}

export function GlobalEventCard({
  event,
  x,
  isReadOnly = false,
  totalRows = 1,
  visibleWidth,
}: GlobalEventCardProps) {
  const { zoomLevel, columnWidthScale, currentYear, workspaceId, globalEvents, pushHistory } = useAppStore()
  const cellWidth = getCellWidth(zoomLevel, columnWidthScale)
  const cellHeight = getCellHeight(zoomLevel)
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

  // 삭제 확인 다이얼로그 상태
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // 현재 위치/크기 (event 데이터 기반으로 계산, 또는 월 필터링 시 visibleWidth 사용)
  const calculatedWidth = dateRangeToWidth(
    new Date(event.startDate),
    new Date(event.endDate),
    zoomLevel,
    columnWidthScale
  )

  // 카드 마진 (상하좌우 동일) - 상단에 정의
  const cardMargin = 3
  // 월 필터링 적용 시 visibleWidth 사용, 그렇지 않으면 계산된 너비 사용
  const currentWidth = visibleWidth !== undefined ? visibleWidth : calculatedWidth

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
        y: rect.bottom + 8,
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
    const { updateGlobalEvent } = useAppStore.getState()
    updateGlobalEvent(event.id, { color })

    // Firebase 업데이트
    try {
      await updateGlobalEventFirebase(workspaceId, event.id, { color })
    } catch (error) {
      console.error('색상 변경 실패:', error)
      // 실패 시 롤백
      updateGlobalEvent(event.id, { color: event.color })
    }
  }

  // 편집 팝업 저장
  const handleEditSave = async (title: string, comment: string, link: string) => {
    setEditPopup(null)

    if (workspaceId) {
      try {
        await updateGlobalEventFirebase(workspaceId, event.id, { title, comment, link })
      } catch (error) {
        console.error('글로벌 이벤트 수정 실패:', error)
      }
    }
  }

  // 편집 팝업 취소
  const handleEditCancel = () => {
    setEditPopup(null)
  }

  // 이벤트 삭제
  const handleDelete = async () => {
    if (!workspaceId) return
    try {
      // 삭제 전 데이터 저장 (Undo용)
      const eventData = {
        projectId: event.projectId,
        title: event.title,
        comment: event.comment,
        link: event.link,
        startDate: event.startDate,
        endDate: event.endDate,
        color: event.color,
        textColor: event.textColor,
        rowIndex: event.rowIndex,
        createdBy: event.createdBy,
      }

      await deleteGlobalEventFirebase(workspaceId, event.id)

      // 히스토리 기록
      pushHistory({
        type: 'global_event_delete',
        description: '특이사항 삭제',
        undoData: { event: eventData },
        redoData: { eventId: event.id },
      })

      setShowDeleteConfirm(false)
      setIsSelected(false)
    } catch (error) {
      console.error('글로벌 이벤트 삭제 실패:', error)
    }
  }

  // 겹침 검사
  const checkCollision = (newStartDate: number, newEndDate: number, newRowIndex: number): boolean => {
    return globalEvents.some((other) => {
      if (other.id === event.id) return false
      if ((other.rowIndex || 0) !== newRowIndex) return false
      return newStartDate < other.endDate && newEndDate > other.startDate
    })
  }

  // 드래그 시작
  const handleDragStart = () => {
    if (isReadOnly) return
    setIsDragging(true)
    setIsSelected(true)
  }

  // 드래그 종료
  const handleDragStop = (_e: any, data: DraggableData) => {
    if (isReadOnly) return
    setIsDragging(false)

    // 마진을 제외한 실제 위치로 보정
    const adjustedX = data.x - cardMargin
    const snappedX = snapToGrid(adjustedX, cellWidth)
    const newStartDate = pixelsToDate(snappedX, currentYear, zoomLevel, columnWidthScale)
    const duration = event.endDate - event.startDate
    const newEndDate = new Date(newStartDate.getTime() + duration)

    // Y 위치 기반으로 새 rowIndex 계산
    const currentRowIndex = event.rowIndex || 0
    const rowDelta = Math.round(data.y / cellHeight)
    const newRowIndex = Math.max(0, Math.min(totalRows - 1, currentRowIndex + rowDelta))

    // 위치가 변경되지 않았으면 업데이트하지 않음 (클릭만 한 경우)
    if (newStartDate.getTime() === event.startDate && newRowIndex === currentRowIndex) {
      return
    }

    // 겹침 검사
    if (checkCollision(newStartDate.getTime(), newEndDate.getTime(), newRowIndex)) {
      return
    }

    const updates: Partial<GlobalEvent> = {
      startDate: newStartDate.getTime(),
      endDate: newEndDate.getTime(),
    }

    if (newRowIndex !== currentRowIndex) {
      updates.rowIndex = newRowIndex
    }

    // 낙관적 업데이트
    const { updateGlobalEvent } = useAppStore.getState()
    updateGlobalEvent(event.id, updates)

    // Firebase 업데이트 (fire and forget)
    if (workspaceId) {
      updateGlobalEventFirebase(workspaceId, event.id, updates).catch((error) => {
        console.error('글로벌 이벤트 업데이트 실패:', error)
        updateGlobalEvent(event.id, {
          startDate: event.startDate,
          endDate: event.endDate,
          rowIndex: event.rowIndex,
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

    // 마진 보정
    const newWidth = snapToGrid(parseInt(ref.style.width) + cardMargin * 2, cellWidth)
    const adjustedPosition = position.x - cardMargin
    const newX = direction.includes('left')
      ? snapToGrid(adjustedPosition, cellWidth)
      : x

    const newStartDate = pixelsToDate(newX, currentYear, zoomLevel, columnWidthScale)
    const newEndDate = pixelsToDate(newX + newWidth, currentYear, zoomLevel, columnWidthScale)

    // 겹침 검사
    if (checkCollision(newStartDate.getTime(), newEndDate.getTime(), event.rowIndex || 0)) {
      return
    }

    const updates = {
      startDate: newStartDate.getTime(),
      endDate: newEndDate.getTime(),
    }

    // 낙관적 업데이트
    const { updateGlobalEvent } = useAppStore.getState()
    updateGlobalEvent(event.id, updates)

    // Firebase 업데이트 (fire and forget)
    if (workspaceId) {
      updateGlobalEventFirebase(workspaceId, event.id, updates).catch((error) => {
        console.error('글로벌 이벤트 리사이즈 실패:', error)
        updateGlobalEvent(event.id, {
          startDate: event.startDate,
          endDate: event.endDate,
        })
      })
    }
  }

  return (
    <>
      <Rnd
        key={`${event.id}-${event.startDate}-${event.endDate}-${event.rowIndex}`}
        position={{ x: x + cardMargin, y: cardMargin }}
        size={{ width: currentWidth - cardMargin * 2, height: cellHeight - cardMargin * 2 }}
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
        resizeGrid={[cellWidth, cellHeight]}
        dragGrid={[cellWidth, cellHeight]}
        minWidth={cellWidth - cardMargin * 2}
        className="!absolute global-event-card"
        style={{ zIndex: isDragging || isResizing || isSelected ? 100 : 10 }}
        resizeHandleStyles={{
          left: { width: '6px', left: '0', cursor: 'ew-resize' },
          right: { width: '6px', right: '0', cursor: 'ew-resize' },
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
            ${isSelected ? 'border-white ring-2 ring-primary' : 'border-transparent hover:border-white/30'}
            ${isDragging || isResizing ? 'opacity-90 shadow-xl scale-[1.02]' : ''}
          `}
          style={{
            backgroundColor: event.color || '#f59e0b',
            color: event.textColor || '#ffffff',
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
              className={`absolute left-0 top-0 h-full w-1 flex items-center justify-center transition-opacity ${isHovered || isResizing ? 'opacity-100' : 'opacity-0'}`}
              style={{ backgroundColor: 'rgba(255,255,255,0.4)' }}
            >
              <div className="w-0.5 h-3 bg-white/80 rounded" />
            </div>
          )}

          {/* 콘텐츠 영역 */}
          <div className="flex items-center gap-1 h-full px-1.5">
            <span className="text-sm font-medium truncate flex-1">
              {event.title || '제목 없음'}
            </span>
            {event.link && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (event.link) {
                    window.open(event.link, '_blank', 'noopener,noreferrer')
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
              className={`absolute right-0 top-0 h-full w-1 flex items-center justify-center transition-opacity ${isHovered || isResizing ? 'opacity-100' : 'opacity-0'}`}
              style={{ backgroundColor: 'rgba(255,255,255,0.4)' }}
            >
              <div className="w-0.5 h-3 bg-white/80 rounded" />
            </div>
          )}
        </div>
      </Rnd>

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          currentColor={event.color}
          onColorChange={handleColorChange}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 삭제 확인 다이얼로그 */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="글로벌 이벤트 삭제"
          message={`"${event.title || '제목 없음'}" 이벤트를 삭제하시겠습니까?`}
          confirmText="삭제"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          isDestructive
        />
      )}

      {/* 호버 툴팁 */}
      {showTooltip && (event.comment || event.title) && (() => {
        const rect = cardRef.current?.getBoundingClientRect()
        if (!rect) return null

        // 툴팁 높이 계산 (제목 + 코멘트 유무에 따라)
        const tooltipHeight = event.comment ? 52 : 28

        return (
          <div
            className="fixed bg-card border border-border rounded-md shadow-lg px-3 py-2 z-[250] max-w-xs pointer-events-none"
            style={{
              left: `${rect.left}px`,
              top: `${rect.top - tooltipHeight - 2}px`,
            }}
          >
            <div className="text-sm font-semibold text-foreground mb-1">
              {event.title || '제목 없음'}
            </div>
            {event.comment && (
              <div className="text-xs text-muted-foreground">
                {event.comment}
              </div>
            )}
          </div>
        )
      })()}

      {/* 편집 팝업 */}
      {editPopup && (
        <ScheduleEditPopup
          title={event.title}
          comment={event.comment}
          link={event.link || ''}
          position={editPopup}
          onSave={handleEditSave}
          onCancel={handleEditCancel}
        />
      )}
    </>
  )
}
