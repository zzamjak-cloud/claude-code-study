// 일정 카드 우클릭 컨텍스트 메뉴

import { useEffect, useRef, useState } from 'react'
import { Palette, UserCog, ChevronRight } from 'lucide-react'
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
  const [showTransferSubmenu, setShowTransferSubmenu] = useState(false)

  // 이관 가능한 구성원 (현재 구성원 제외)
  const transferableMembers = members?.filter((m) => m.id !== currentMemberId && !m.isHidden) || []

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

  // 확장된 컬러 프리셋 (기본 컬러 포함)
  const colorOptions = [DEFAULT_SCHEDULE_COLOR, ...COLOR_PRESETS]

  return (
    <div
      ref={menuRef}
      className="fixed bg-card border border-border rounded-lg shadow-xl p-3 z-[200]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      {/* 색상 변경 섹션 */}
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
        <Palette className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">색상 변경</span>
      </div>

      {/* 색상 그리드 */}
      <div className="grid grid-cols-6 gap-2">
        {colorOptions.map((color) => (
          <button
            key={color}
            onClick={() => {
              onColorChange(color)
              onClose()
            }}
            className={`w-8 h-8 rounded-md border-2 transition-all hover:scale-110 ${
              currentColor === color
                ? 'border-white ring-2 ring-primary'
                : 'border-transparent hover:border-muted-foreground/50'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* 업무 이관 섹션 (구성원이 있을 때만) */}
      {onTransfer && transferableMembers.length > 0 && (
        <>
          <div className="my-2 border-t border-border" />
          <div
            className="relative"
            onMouseEnter={() => setShowTransferSubmenu(true)}
            onMouseLeave={() => setShowTransferSubmenu(false)}
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
              <div className="absolute left-full top-0 ml-1 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[120px] z-[210]">
                {transferableMembers.map((member) => (
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
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
