// 일정 카드 우클릭 컨텍스트 메뉴

import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { Palette, UserCog, ChevronRight, Search } from 'lucide-react'
import { COLOR_PRESETS, DEFAULT_SCHEDULE_COLOR } from '../../lib/constants/colors'
import { TeamMember } from '../../types/team'

interface ContextMenuProps {
  x: number
  y: number
  onColorChange: (color: string) => void
  onClose: () => void
  currentColor: string
  // 업무 이관 관련
  members?: TeamMember[]
  currentMemberId?: string
  onTransfer?: (targetMemberId: string) => void
}

export function ContextMenu({
  x,
  y,
  onColorChange,
  onClose,
  currentColor,
  members,
  currentMemberId,
  onTransfer,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showTransferSubmenu, setShowTransferSubmenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 이관 가능한 구성원 (현재 구성원 제외)
  const transferableMembers = members?.filter((m) => m.id !== currentMemberId && !m.isHidden) || []

  // 검색 필터링된 구성원
  const filteredMembers = searchQuery
    ? transferableMembers.filter((m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : transferableMembers

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // 커스텀 컬러 상태
  const [customColor, setCustomColor] = useState(currentColor)

  // 스마트 포지셔닝: 화면 경계를 벗어나지 않도록 위치 보정
  const [adjustedPos, setAdjustedPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const MARGIN = 8

    let left = x
    let top = y

    // 하단 벗어남 → 위로 올림
    if (top + rect.height > window.innerHeight - MARGIN) {
      top = y - rect.height
    }
    if (top < MARGIN) top = MARGIN

    // 우측 벗어남 → 좌로 이동
    if (left + rect.width > window.innerWidth - MARGIN) {
      left = window.innerWidth - rect.width - MARGIN
    }
    if (left < MARGIN) left = MARGIN

    setAdjustedPos({ left, top })
  }, [x, y])

  // 확장된 컬러 프리셋 (기본 컬러 포함)
  const colorOptions = [DEFAULT_SCHEDULE_COLOR, ...COLOR_PRESETS]

  return (
    <div
      ref={menuRef}
      className="fixed bg-card border border-border rounded-lg shadow-xl p-3 z-[200]"
      style={{
        left: `${adjustedPos.left}px`,
        top: `${adjustedPos.top}px`,
      }}
    >
      {/* 색상 변경 섹션 */}
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
        <Palette className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">색상 변경</span>
      </div>

      {/* 색상 그리드 */}
      <div className="grid grid-cols-6 gap-1.5">
        {colorOptions.map((color) => (
          <button
            key={color}
            onClick={() => {
              onColorChange(color)
              onClose()
            }}
            className={`w-7 h-7 rounded-md border-2 transition-all hover:scale-110 ${
              currentColor === color
                ? 'border-white ring-2 ring-primary'
                : 'border-transparent hover:border-muted-foreground/50'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* 커스텀 컬러 피커 */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
        <input
          type="color"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          className="w-7 h-7 rounded-md border border-border cursor-pointer p-0"
        />
        <input
          type="text"
          value={customColor}
          onChange={(e) => {
            setCustomColor(e.target.value)
          }}
          className="flex-1 px-2 py-1 border border-border rounded-md bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary w-20"
        />
        <button
          onClick={() => {
            if (/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
              onColorChange(customColor)
              onClose()
            }
          }}
          className="px-2 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          적용
        </button>
      </div>

      {/* 업무 이관 섹션 (구성원이 있을 때만) */}
      {onTransfer && transferableMembers.length > 0 && (
        <>
          <div className="my-2 border-t border-border" />
          <div
            className="relative"
            onMouseEnter={() => {
              setShowTransferSubmenu(true)
              // 서브메뉴가 열리면 검색 필드에 포커스
              setTimeout(() => searchInputRef.current?.focus(), 50)
            }}
            onMouseLeave={() => {
              setShowTransferSubmenu(false)
              setSearchQuery('')
            }}
          >
            <button className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-md hover:bg-accent transition-colors">
              <div className="flex items-center gap-2">
                <UserCog className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">업무 이관</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* 구성원 서브메뉴 */}
            {showTransferSubmenu && (
              <div className="absolute left-full top-0 ml-1 bg-card border border-border rounded-lg shadow-xl min-w-[160px] z-[210]">
                {/* 검색 필드 */}
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="이름 검색..."
                      className="w-full pl-7 pr-2 py-1.5 text-sm bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                {/* 구성원 목록 */}
                <div className="max-h-[200px] overflow-y-auto py-1">
                  {filteredMembers.length > 0 ? (
                    filteredMembers.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => {
                          onTransfer(member.id)
                          onClose()
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors"
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: member.color }}
                        />
                        <span className="text-sm text-foreground truncate">{member.name}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                      검색 결과 없음
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
