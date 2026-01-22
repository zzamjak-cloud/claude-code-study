// 글로벌 이벤트 카드 컴포넌트 (통합 탭에서만 편집 가능)

import { memo } from 'react'
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
import { debouncedFirebaseUpdate } from '../../lib/utils/debounce'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { ScheduleEditPopup } from './ScheduleEditPopup'
import { ContextMenu } from './ContextMenu'
import {
  useCardInteractions,
  getRndConfig,
  getCardClassName,
  CARD_MARGIN,
} from './useCardInteractions'

interface GlobalEventCardProps {
  event: GlobalEvent
  x: number
  y: number // 행 인덱스 기반 y 좌표
  isReadOnly?: boolean
  totalRows?: number
  visibleWidth?: number // 월 필터링 시 클리핑된 너비
  containerHeight: number // 전체 컨테이너 높이
}

// React.memo 비교 함수 - props가 같으면 리렌더링 스킵
const areGlobalEventCardPropsEqual = (
  prev: GlobalEventCardProps,
  next: GlobalEventCardProps
): boolean => {
  return (
    prev.event.id === next.event.id &&
    prev.event.startDate === next.event.startDate &&
    prev.event.endDate === next.event.endDate &&
    prev.event.title === next.event.title &&
    prev.event.color === next.event.color &&
    prev.event.textColor === next.event.textColor &&
    prev.event.comment === next.event.comment &&
    prev.event.link === next.event.link &&
    prev.event.rowIndex === next.event.rowIndex &&
    prev.event.projectId === next.event.projectId &&
    prev.x === next.x &&
    prev.y === next.y &&
    prev.isReadOnly === next.isReadOnly &&
    prev.totalRows === next.totalRows &&
    prev.visibleWidth === next.visibleWidth &&
    prev.containerHeight === next.containerHeight
  )
}

export const GlobalEventCard = memo(function GlobalEventCard({
  event,
  x,
  y,
  isReadOnly = false,
  totalRows = 1,
  visibleWidth,
  containerHeight,
}: GlobalEventCardProps) {
  // containerHeight는 향후 bounds 계산에 사용 예정
  void containerHeight

  // Zustand 선택적 구독
  const zoomLevel = useAppStore(state => state.zoomLevel)
  const columnWidthScale = useAppStore(state => state.columnWidthScale)
  const currentYear = useAppStore(state => state.currentYear)
  const workspaceId = useAppStore(state => state.workspaceId)
  const globalEvents = useAppStore(state => state.globalEvents)
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

  // 현재 위치/크기 계산
  const calculatedWidth = dateRangeToWidth(
    new Date(event.startDate),
    new Date(event.endDate),
    zoomLevel,
    columnWidthScale
  )
  const currentWidth = visibleWidth !== undefined ? visibleWidth : calculatedWidth

  // 색상 변경
  const handleColorChange = async (color: string) => {
    if (!workspaceId) return

    const { updateGlobalEvent } = useAppStore.getState()
    updateGlobalEvent(event.id, { color })

    try {
      await updateGlobalEventFirebase(workspaceId, event.id, { color })
    } catch (error) {
      console.error('색상 변경 실패:', error)
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

  // 이벤트 삭제
  const handleDelete = async () => {
    if (!workspaceId) return
    try {
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

    // x 좌표 계산 (그리드 스냅)
    const adjustedX = data.x - CARD_MARGIN
    const snappedX = snapToGrid(adjustedX, cellWidth)
    const newStartDate = pixelsToDate(snappedX, currentYear, zoomLevel, columnWidthScale)
    const duration = event.endDate - event.startDate
    const newEndDate = new Date(newStartDate.getTime() + duration)

    // y 좌표에서 새 행 인덱스 계산
    const currentRowIndex = event.rowIndex || 0
    const adjustedY = data.y - CARD_MARGIN
    const newRowIndex = Math.max(0, Math.min(totalRows - 1, Math.round(adjustedY / cellHeight)))

    if (newStartDate.getTime() === event.startDate && newRowIndex === currentRowIndex) {
      return
    }

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

    const { updateGlobalEvent } = useAppStore.getState()
    updateGlobalEvent(event.id, updates)

    // Firebase 쓰기는 debounce 적용 (500ms)
    if (workspaceId) {
      debouncedFirebaseUpdate(
        `global-event-drag-${event.id}`,
        async () => {
          await updateGlobalEventFirebase(workspaceId, event.id, updates)
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

    if (checkCollision(newStartDate.getTime(), newEndDate.getTime(), event.rowIndex || 0)) {
      return
    }

    const updates = {
      startDate: newStartDate.getTime(),
      endDate: newEndDate.getTime(),
    }

    const { updateGlobalEvent } = useAppStore.getState()
    updateGlobalEvent(event.id, updates)

    // Firebase 쓰기는 debounce 적용 (500ms)
    if (workspaceId) {
      debouncedFirebaseUpdate(
        `global-event-resize-${event.id}`,
        async () => {
          await updateGlobalEventFirebase(workspaceId, event.id, updates)
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

  // 카드 스타일 클래스
  const cardClassName = getCardClassName({
    isReadOnly,
    isSelected,
    isDragging,
    isResizing,
  })

  return (
    <>
      <Rnd
        key={`${event.id}-${event.rowIndex}-${event.startDate}-${event.endDate}`}
        default={{
          x: x + CARD_MARGIN,
          y: y + CARD_MARGIN,
          width: currentWidth - CARD_MARGIN * 2,
          height: cellHeight - CARD_MARGIN * 2,
        }}
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onResizeStart={() => !isReadOnly && setIsResizing(true)}
        onResizeStop={handleResizeStop}
        disableDragging={isReadOnly}
        {...rndConfig}
        className="!absolute global-event-card"
        style={{ zIndex: isDragging || isResizing || isSelected ? 100 : 10 }}
      >
        <div
          ref={cardRef}
          className={cardClassName}
          style={{
            backgroundColor: event.color || '#f59e0b',
            color: event.textColor || '#ffffff',
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
          onCancel={() => setEditPopup(null)}
        />
      )}
    </>
  )
}, areGlobalEventCardPropsEqual)
