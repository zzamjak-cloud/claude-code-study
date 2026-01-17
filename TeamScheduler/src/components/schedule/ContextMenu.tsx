// 일정 카드 우클릭 컨텍스트 메뉴

import { useEffect, useRef } from 'react'
import { Palette } from 'lucide-react'
import { COLOR_PRESETS, DEFAULT_SCHEDULE_COLOR } from '../../lib/constants/colors'

interface ContextMenuProps {
  x: number
  y: number
  onColorChange: (color: string) => void
  onClose: () => void
  currentColor: string
}

export function ContextMenu({
  x,
  y,
  onColorChange,
  onClose,
  currentColor,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

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
    </div>
  )
}
