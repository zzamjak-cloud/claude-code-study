// 카드 컴포넌트 공통 상호작용 훅
// ScheduleCard, GlobalEventCard에서 공유하는 상태와 이벤트 핸들러

import { useState, useRef, useEffect, RefObject } from 'react'

interface UseCardInteractionsOptions {
  isReadOnly?: boolean
  onDelete?: () => void
}

interface UseCardInteractionsReturn {
  // Refs
  cardRef: RefObject<HTMLDivElement | null>

  // 상태
  isHovered: boolean
  isSelected: boolean
  showTooltip: boolean
  isDragging: boolean
  isResizing: boolean
  showDeleteConfirm: boolean
  contextMenu: { x: number; y: number } | null
  editPopup: { x: number; y: number } | null

  // 상태 설정 함수
  setIsHovered: (value: boolean) => void
  setIsSelected: (value: boolean) => void
  setShowTooltip: (value: boolean) => void
  setIsDragging: (value: boolean) => void
  setIsResizing: (value: boolean) => void
  setShowDeleteConfirm: (value: boolean) => void
  setContextMenu: (value: { x: number; y: number } | null) => void
  setEditPopup: (value: { x: number; y: number } | null) => void

  // 이벤트 핸들러
  handleDoubleClick: (e: React.MouseEvent) => void
  handleClick: (e: React.MouseEvent) => void
  handleContextMenu: (e: React.MouseEvent) => void
  handleMouseEnter: () => void
  handleMouseLeave: () => void
}

// 카드 마진 상수
export const CARD_MARGIN = 3

export function useCardInteractions({
  isReadOnly = false,
}: UseCardInteractionsOptions = {}): UseCardInteractionsReturn {
  const cardRef = useRef<HTMLDivElement>(null)

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

  // 편집 팝업 상태
  const [editPopup, setEditPopup] = useState<{ x: number; y: number } | null>(null)

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

  // 마우스 진입
  const handleMouseEnter = () => {
    setIsHovered(true)
    setShowTooltip(true)
  }

  // 마우스 떠남
  const handleMouseLeave = () => {
    setIsHovered(false)
    setShowTooltip(false)
  }

  return {
    // Refs
    cardRef,

    // 상태
    isHovered,
    isSelected,
    showTooltip,
    isDragging,
    isResizing,
    showDeleteConfirm,
    contextMenu,
    editPopup,

    // 상태 설정 함수
    setIsHovered,
    setIsSelected,
    setShowTooltip,
    setIsDragging,
    setIsResizing,
    setShowDeleteConfirm,
    setContextMenu,
    setEditPopup,

    // 이벤트 핸들러
    handleDoubleClick,
    handleClick,
    handleContextMenu,
    handleMouseEnter,
    handleMouseLeave,
  }
}

// Rnd 공통 설정 생성 함수
export function getRndConfig(options: {
  cellWidth: number
  cellHeight: number
  isReadOnly: boolean
  isHovered: boolean
  isResizing: boolean
  totalRows?: number
}) {
  const { cellWidth, cellHeight, isReadOnly, isHovered, isResizing, totalRows = 1 } = options
  // cellHeight는 드래그 후 행 계산에 사용됨 (각 카드 컴포넌트에서)
  void cellHeight

  return {
    enableResizing: isReadOnly
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
        },
    resizeGrid: [cellWidth, 1] as [number, number],
    dragGrid: [cellWidth, 1] as [number, number],
    dragAxis: totalRows > 1 ? 'both' as const : 'x' as const,
    minWidth: cellWidth - CARD_MARGIN * 2,
    resizeHandleStyles: {
      left: { width: '12px', left: '-4px', cursor: 'ew-resize', zIndex: 50 },
      right: { width: '12px', right: '-4px', cursor: 'ew-resize', zIndex: 50 },
    },
    resizeHandleClasses: {
      left: `transition-opacity ${isHovered || isResizing ? 'opacity-100' : 'opacity-0'}`,
      right: `transition-opacity ${isHovered || isResizing ? 'opacity-100' : 'opacity-0'}`,
    },
  }
}

// 카드 스타일 클래스 생성 함수
export function getCardClassName(options: {
  isReadOnly: boolean
  isSelected: boolean
  isDragging: boolean
  isResizing: boolean
  isColliding?: boolean
  isPast?: boolean
}) {
  const { isReadOnly, isSelected, isDragging, isResizing, isColliding = false, isPast = false } = options

  return `h-full rounded-md border-2 transition-all select-none relative overflow-hidden
    ${isReadOnly ? 'cursor-default' : 'cursor-move'}
    ${isColliding ? 'border-red-500 shadow-lg shadow-red-500/30' : ''}
    ${isSelected ? 'border-white ring-2 ring-primary' : 'border-transparent hover:border-white/30'}
    ${isDragging || isResizing ? 'opacity-90 shadow-xl scale-[1.02]' : ''}
    ${isPast ? 'opacity-60' : ''}
  `
}
