// 카드 컴포넌트 공통 상호작용 훅
// ScheduleCard, GlobalEventCard에서 공유하는 상태와 이벤트 핸들러

import { useState, useRef, useEffect, RefObject } from 'react'

interface UseCardInteractionsOptions {
  isReadOnly?: boolean
  onDelete?: () => void
  onDuplicate?: () => void  // Ctrl+D 카드 복제 콜백
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
  onDuplicate,
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

  // Ref로 최신 상태 추적 (리스너 재등록 방지)
  const editPopupRef = useRef(editPopup)
  const showDeleteConfirmRef = useRef(showDeleteConfirm)
  const isReadOnlyRef = useRef(isReadOnly)
  const onDuplicateRef = useRef(onDuplicate)

  // ref 동기화 - 상태 변경 시 ref 업데이트
  useEffect(() => { editPopupRef.current = editPopup }, [editPopup])
  useEffect(() => { showDeleteConfirmRef.current = showDeleteConfirm }, [showDeleteConfirm])
  useEffect(() => { isReadOnlyRef.current = isReadOnly }, [isReadOnly])
  useEffect(() => { onDuplicateRef.current = onDuplicate }, [onDuplicate])

  // 키보드 + 외부 클릭: isSelected 변경 시에만 리스너 등록/해제
  // editPopup, showDeleteConfirm 등 변경 시 리스너 재등록하지 않음 (ref로 참조)
  useEffect(() => {
    if (!isSelected) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete/Backspace 키로 삭제
      if ((e.key === 'Delete' || e.key === 'Backspace') && !editPopupRef.current) {
        e.preventDefault()
        setShowDeleteConfirm(true)
      }
      // Enter 키로 편집 팝업 열기 (삭제 확인 다이얼로그가 열려있으면 무시)
      if (e.key === 'Enter' && !editPopupRef.current && !showDeleteConfirmRef.current && !isReadOnlyRef.current) {
        e.preventDefault()
        const rect = cardRef.current?.getBoundingClientRect()
        if (rect) {
          // 스마트 포지셔닝: 화면 크기 기반 위치 계산
          const POPUP_HEIGHT = 320
          const POPUP_WIDTH = 300
          const MARGIN = 8

          const viewportHeight = window.innerHeight
          const viewportWidth = window.innerWidth

          let x = rect.left
          let y = rect.bottom + MARGIN

          // 하단 공간 부족 시 카드 위로 표시
          if (y + POPUP_HEIGHT > viewportHeight) {
            y = rect.top - POPUP_HEIGHT - MARGIN
          }
          if (y < 0) y = MARGIN

          // 좌우 경계 체크
          if (x + POPUP_WIDTH > viewportWidth) {
            x = viewportWidth - POPUP_WIDTH - MARGIN
          }
          if (x < 0) x = MARGIN

          setEditPopup({ x, y })
        }
      }
      // Ctrl+D로 카드 복제
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !editPopupRef.current && !isReadOnlyRef.current) {
        e.preventDefault()  // 브라우저 북마크 기본 동작 방지
        onDuplicateRef.current?.()
      }
      // Escape 키로 선택 해제
      if (e.key === 'Escape') {
        setIsSelected(false)
        setEditPopup(null)
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsSelected(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSelected])  // isSelected만 의존 → 선택/해제 시에만 등록/해제

  // 더블 클릭: 편집 팝업 표시 (스마트 포지셔닝)
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isReadOnly) return
    e.stopPropagation()

    const rect = cardRef.current?.getBoundingClientRect()
    if (rect) {
      // 스마트 포지셔닝: 화면 크기 기반 위치 계산
      const POPUP_HEIGHT = 320
      const POPUP_WIDTH = 300
      const MARGIN = 8

      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth

      let x = rect.left
      let y = rect.bottom + MARGIN

      // 하단 공간 부족 시 카드 위로 표시
      if (y + POPUP_HEIGHT > viewportHeight) {
        y = rect.top - POPUP_HEIGHT - MARGIN
      }
      if (y < 0) y = MARGIN

      // 좌우 경계 체크
      if (x + POPUP_WIDTH > viewportWidth) {
        x = viewportWidth - POPUP_WIDTH - MARGIN
      }
      if (x < 0) x = MARGIN

      setEditPopup({ x, y })
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
    // dragGrid 제거: scale(zoomLevel)과 dragGrid의 상호작용으로 1열 이동 불가 및 마우스 위치 벌어짐 발생
    // handleDragStop에서 snapToGrid로 최종 위치를 정렬하므로 드래그 중에는 자유 이동 허용
    dragGrid: [1, 1] as [number, number],
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
}) {
  const { isReadOnly, isSelected, isDragging, isResizing, isColliding = false } = options

  return `h-full rounded-md border-2 transition-all select-none relative overflow-hidden
    ${isReadOnly ? 'cursor-default' : 'cursor-move'}
    ${isColliding ? 'border-red-500 shadow-lg shadow-red-500/30' : ''}
    ${isSelected ? 'border-white ring-2 ring-primary' : 'border-transparent hover:border-white/30'}
    ${isDragging || isResizing ? 'opacity-90 shadow-xl scale-[1.02]' : ''}
  `
}
