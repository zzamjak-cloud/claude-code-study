// 월 필터링 컴포넌트 (월 바로가기 + 가시성 토글)

import { useState, useRef, useEffect } from 'react'
import { Eye, EyeOff, ChevronDown, CalendarDays } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { getCellWidth } from '../../lib/utils/gridUtils'

const MONTH_NAMES = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
]

export function MonthFilter() {
  const { monthVisibility, toggleMonthVisibility, zoomLevel, currentYear } = useAppStore()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const cellWidth = getCellWidth(zoomLevel)

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // 해당 월로 스크롤
  const scrollToMonth = (month: number) => {
    const daysBeforeMonth = new Date(currentYear, month - 1, 1).getTime() - new Date(currentYear, 0, 1).getTime()
    const dayOffset = Math.floor(daysBeforeMonth / (1000 * 60 * 60 * 24))
    const scrollX = dayOffset * cellWidth

    const gridElement = document.querySelector('.flex-1.overflow-auto')
    if (gridElement) {
      gridElement.scrollLeft = scrollX
    }
  }

  // 숨겨진 월 개수
  const hiddenCount = Object.values(monthVisibility).filter((v) => !v).length

  return (
    <div ref={dropdownRef} className="relative">
      {/* 드롭다운 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center gap-2"
      >
        <span>월 바로가기</span>
        {hiddenCount > 0 && (
          <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded">
            {hiddenCount}개 숨김
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 min-w-[200px]">
          {/* 헤더 */}
          <div className="px-3 py-2 border-b border-border">
            <span className="text-xs text-muted-foreground">월을 클릭하면 해당 월로 이동, 눈 아이콘으로 표시/숨김</span>
          </div>

          {/* 월 리스트 */}
          <div className="py-1 max-h-[300px] overflow-y-auto">
            {/* 현재(오늘) 버튼 */}
            <button
              onClick={() => {
                const today = new Date()
                const currentMonth = today.getMonth() + 1
                scrollToMonth(currentMonth)
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors text-primary font-medium"
            >
              <CalendarDays className="w-4 h-4" />
              <span className="text-sm">현재</span>
            </button>
            <div className="border-b border-border mx-2 my-1" />
            {MONTH_NAMES.map((name, index) => {
              const month = index + 1
              const isVisible = monthVisibility[month]

              return (
                <div
                  key={month}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors"
                >
                  {/* 가시성 토글 버튼 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleMonthVisibility(month)
                    }}
                    className={`p-1 rounded transition-colors ${
                      isVisible
                        ? 'text-primary hover:text-primary/80 hover:bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                    title={isVisible ? '숨기기' : '표시하기'}
                  >
                    {isVisible ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>

                  {/* 월 이름 (클릭 시 스크롤) */}
                  <button
                    onClick={() => {
                      scrollToMonth(month)
                      setIsOpen(false)
                    }}
                    className={`flex-1 text-left text-sm ${
                      isVisible ? 'text-foreground' : 'text-muted-foreground line-through'
                    }`}
                  >
                    {name}
                  </button>
                </div>
              )
            })}
          </div>

          {/* 푸터 (전체 표시/숨김) */}
          <div className="px-3 py-2 border-t border-border flex gap-2">
            <button
              onClick={() => {
                const { setAllMonthsVisible } = useAppStore.getState()
                setAllMonthsVisible(true)
              }}
              className="flex-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              전체 표시
            </button>
            <button
              onClick={() => {
                const { setAllMonthsVisible } = useAppStore.getState()
                setAllMonthsVisible(false)
              }}
              className="flex-1 px-2 py-1 text-xs bg-muted text-foreground rounded hover:bg-accent transition-colors"
            >
              전체 숨김
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
