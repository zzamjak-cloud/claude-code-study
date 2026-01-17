// 컬러 프리셋 설정 모달

import { useState } from 'react'
import { X, Check, Palette } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { COLOR_PRESETS, DEFAULT_SCHEDULE_COLOR, DEFAULT_WEEKEND_COLOR } from '../../lib/constants/colors'

interface ColorPresetModalProps {
  onClose: () => void
}

// 확장된 컬러 프리셋 (기본 컬러 포함)
const EXTENDED_PRESETS = [DEFAULT_SCHEDULE_COLOR, ...COLOR_PRESETS]

// 주말 색상 프리셋 (연한 파스텔 톤)
const WEEKEND_PRESETS = [
  DEFAULT_WEEKEND_COLOR, // 기본
  '#fde2e4', // 연한 핑크
  '#e2e8f0', // 연한 그레이
  '#dbeafe', // 연한 블루
  '#dcfce7', // 연한 그린
  '#fef3c7', // 연한 옐로우
  '#f3e8ff', // 연한 퍼플
  '#ffedd5', // 연한 오렌지
]

export function ColorPresetModal({ onClose }: ColorPresetModalProps) {
  const {
    selectedScheduleColor, setSelectedScheduleColor,
    weekendColor, setWeekendColor
  } = useAppStore()

  // 일정 색상 상태
  const [tempScheduleColor, setTempScheduleColor] = useState(selectedScheduleColor || DEFAULT_SCHEDULE_COLOR)
  const [customScheduleColor, setCustomScheduleColor] = useState(selectedScheduleColor || DEFAULT_SCHEDULE_COLOR)

  // 주말 색상 상태
  const [tempWeekendColor, setTempWeekendColor] = useState(weekendColor || DEFAULT_WEEKEND_COLOR)
  const [customWeekendColor, setCustomWeekendColor] = useState(weekendColor || DEFAULT_WEEKEND_COLOR)

  // 일정 색상 선택 핸들러
  const handleScheduleColorSelect = (color: string) => {
    setTempScheduleColor(color)
    setCustomScheduleColor(color)
  }

  // 주말 색상 선택 핸들러
  const handleWeekendColorSelect = (color: string) => {
    setTempWeekendColor(color)
    setCustomWeekendColor(color)
  }

  // 저장 핸들러
  const handleSave = () => {
    setSelectedScheduleColor(tempScheduleColor)
    setWeekendColor(tempWeekendColor)
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
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">색상 설정</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ===== 일정 색상 섹션 ===== */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">
            📅 일정 기본 색상
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            새 일정 생성 시 기본으로 적용될 색상입니다.
          </p>

          {/* 일정 미리보기 */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-muted-foreground mb-1">미리보기</label>
            <div
              className="h-10 rounded-md flex items-center justify-center font-medium text-sm transition-colors"
              style={{
                backgroundColor: tempScheduleColor,
                color: getTextColor(tempScheduleColor),
              }}
            >
              일정 제목 예시
            </div>
          </div>

          {/* 일정 프리셋 */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-muted-foreground mb-1">프리셋</label>
            <div className="grid grid-cols-6 gap-2">
              {EXTENDED_PRESETS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleScheduleColorSelect(color)}
                  className={`w-8 h-8 rounded-md border-2 transition-all flex items-center justify-center ${
                    tempScheduleColor === color
                      ? 'border-primary ring-2 ring-primary ring-offset-1'
                      : 'border-transparent hover:border-muted-foreground/50'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {tempScheduleColor === color && (
                    <Check className="w-4 h-4" style={{ color: getTextColor(color) }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 일정 커스텀 색상 */}
          <div className="flex gap-2">
            <input
              type="color"
              value={customScheduleColor}
              onChange={(e) => {
                setCustomScheduleColor(e.target.value)
                setTempScheduleColor(e.target.value)
              }}
              className="w-10 h-8 rounded-md border border-border cursor-pointer"
            />
            <input
              type="text"
              value={customScheduleColor}
              onChange={(e) => {
                const value = e.target.value
                setCustomScheduleColor(value)
                if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                  setTempScheduleColor(value)
                }
              }}
              placeholder="#000000"
              className="flex-1 px-2 py-1 border border-border rounded-md bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* ===== 주말/공휴일 색상 섹션 ===== */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">
            🗓️ 주말/공휴일 배경 색상
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            타임라인에서 주말 및 공휴일 셀의 배경 색상입니다.
          </p>

          {/* 주말 미리보기 */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-muted-foreground mb-1">미리보기</label>
            <div className="flex gap-1">
              {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
                <div
                  key={day}
                  className="flex-1 h-8 rounded-md flex items-center justify-center text-xs font-medium border border-border"
                  style={{
                    backgroundColor: i >= 5 ? tempWeekendColor : undefined,
                    color: i >= 5 ? '#666' : '#999',
                  }}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* 주말 프리셋 */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-muted-foreground mb-1">프리셋</label>
            <div className="grid grid-cols-8 gap-2">
              {WEEKEND_PRESETS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleWeekendColorSelect(color)}
                  className={`w-8 h-8 rounded-md border-2 transition-all flex items-center justify-center ${
                    tempWeekendColor === color
                      ? 'border-primary ring-2 ring-primary ring-offset-1'
                      : 'border-transparent hover:border-muted-foreground/50'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {tempWeekendColor === color && (
                    <Check className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 주말 커스텀 색상 */}
          <div className="flex gap-2">
            <input
              type="color"
              value={customWeekendColor}
              onChange={(e) => {
                setCustomWeekendColor(e.target.value)
                setTempWeekendColor(e.target.value)
              }}
              className="w-10 h-8 rounded-md border border-border cursor-pointer"
            />
            <input
              type="text"
              value={customWeekendColor}
              onChange={(e) => {
                const value = e.target.value
                setCustomWeekendColor(value)
                if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                  setTempWeekendColor(value)
                }
              }}
              placeholder="#fcc3b6"
              className="flex-1 px-2 py-1 border border-border rounded-md bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 justify-end pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-muted hover:bg-accent text-foreground transition-colors font-medium text-sm"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium text-sm"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
