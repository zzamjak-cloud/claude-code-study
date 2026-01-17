// 컬러 프리셋 설정 모달

import { useState } from 'react'
import { X, Check, Palette } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { COLOR_PRESETS, DEFAULT_SCHEDULE_COLOR } from '../../lib/constants/colors'

interface ColorPresetModalProps {
  onClose: () => void
}

// 확장된 컬러 프리셋 (기본 컬러 포함)
const EXTENDED_PRESETS = [DEFAULT_SCHEDULE_COLOR, ...COLOR_PRESETS]

export function ColorPresetModal({ onClose }: ColorPresetModalProps) {
  const { selectedScheduleColor, setSelectedScheduleColor } = useAppStore()
  const [tempColor, setTempColor] = useState(selectedScheduleColor || DEFAULT_SCHEDULE_COLOR)
  const [customColor, setCustomColor] = useState(selectedScheduleColor || DEFAULT_SCHEDULE_COLOR)

  // 색상 선택 핸들러
  const handleColorSelect = (color: string) => {
    setTempColor(color)
    setCustomColor(color)
  }

  // 저장 핸들러
  const handleSave = () => {
    setSelectedScheduleColor(tempColor)
    onClose()
  }

  // 텍스트 색상 계산 (밝기 기반)
  const getTextColor = (bgColor: string): string => {
    const hex = bgColor.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#000000' : '#ffffff'
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">일정 색상 설정</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 설명 */}
        <p className="text-sm text-muted-foreground mb-4">
          새 일정 생성 시 기본으로 적용될 색상을 선택하세요.
        </p>

        {/* 미리보기 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            미리보기
          </label>
          <div
            className="h-12 rounded-md flex items-center justify-center font-medium transition-colors"
            style={{
              backgroundColor: tempColor,
              color: getTextColor(tempColor),
            }}
          >
            일정 제목 예시
          </div>
        </div>

        {/* 프리셋 색상 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            프리셋 색상
          </label>
          <div className="grid grid-cols-6 gap-2">
            {EXTENDED_PRESETS.map((color) => (
              <button
                key={color}
                onClick={() => handleColorSelect(color)}
                className={`w-10 h-10 rounded-md border-2 transition-all flex items-center justify-center ${
                  tempColor === color
                    ? 'border-primary ring-2 ring-primary ring-offset-2'
                    : 'border-transparent hover:border-muted-foreground/50'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              >
                {tempColor === color && (
                  <Check className="w-5 h-5" style={{ color: getTextColor(color) }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 커스텀 색상 입력 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            커스텀 색상
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value)
                setTempColor(e.target.value)
              }}
              className="w-12 h-10 rounded-md border border-border cursor-pointer"
            />
            <input
              type="text"
              value={customColor}
              onChange={(e) => {
                const value = e.target.value
                setCustomColor(value)
                // 유효한 hex 색상인 경우에만 적용
                if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                  setTempColor(value)
                }
              }}
              placeholder="#000000"
              className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-muted hover:bg-accent text-foreground transition-colors font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
