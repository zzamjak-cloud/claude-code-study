// 연도 선택 드롭다운 컴포넌트

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, CalendarDays, Plus, Loader2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { getHolidaysForYear } from '../../lib/utils/koreanHolidays'
import { createGlobalEvent } from '../../lib/firebase/firestore'
import { ANNUAL_LEAVE_COLOR } from '../../lib/constants/colors'
import { storage, STORAGE_KEYS } from '../../lib/utils/storage'
import { startOfDay, endOfDay } from 'date-fns'

// 기본 연도 범위
const DEFAULT_YEARS = [2026, 2027, 2028]

// localStorage에서 연도 목록 로드
const getAvailableYears = (): number[] => {
  if (typeof window !== 'undefined') {
    const saved = storage.get<number[]>(STORAGE_KEYS.AVAILABLE_YEARS, [])
    if (Array.isArray(saved) && saved.length > 0) {
      return saved.sort((a, b) => a - b)
    }
  }
  return DEFAULT_YEARS
}

// localStorage에 연도 목록 저장
const saveAvailableYears = (years: number[]) => {
  if (typeof window !== 'undefined') {
    storage.set(STORAGE_KEYS.AVAILABLE_YEARS, years.sort((a, b) => a - b))
  }
}

export function YearSelector() {
  const { currentYear, setCurrentYear, workspaceId, currentUser } = useAppStore()
  const [isOpen, setIsOpen] = useState(false)
  const [availableYears, setAvailableYears] = useState<number[]>(getAvailableYears)
  const [isAddingYear, setIsAddingYear] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const realCurrentYear = new Date().getFullYear()

  // 다음 추가할 연도 계산
  const nextYear = useMemo(() => {
    return Math.max(...availableYears) + 1
  }, [availableYears])

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

  // 연도 선택 핸들러
  const handleSelectYear = (year: number) => {
    setCurrentYear(year)
    setIsOpen(false)
  }

  // 현재(실제 연도)로 돌아가기
  const handleGoToCurrent = () => {
    // 실제 현재 연도가 선택 가능 범위에 있으면 그 연도로, 없으면 가장 가까운 연도로
    if (availableYears.includes(realCurrentYear)) {
      setCurrentYear(realCurrentYear)
    } else if (realCurrentYear < availableYears[0]) {
      setCurrentYear(availableYears[0])
    } else {
      setCurrentYear(availableYears[availableYears.length - 1])
    }
    setIsOpen(false)
  }

  // 현재 보고 있는 연도가 실제 현재 연도인지 확인
  const isViewingCurrentYear = currentYear === realCurrentYear ||
    (!availableYears.includes(realCurrentYear) &&
      ((realCurrentYear < availableYears[0] && currentYear === availableYears[0]) ||
       (realCurrentYear > availableYears[availableYears.length - 1] && currentYear === availableYears[availableYears.length - 1])))

  // 연도 추가 핸들러
  const handleAddYear = async () => {
    if (!workspaceId || !currentUser || isAddingYear) return

    setIsAddingYear(true)
    try {
      // 연도 목록에 추가
      const newYears = [...availableYears, nextYear]
      setAvailableYears(newYears)
      saveAvailableYears(newYears)

      // 해당 연도 공휴일 자동 등록
      const holidays = getHolidaysForYear(nextYear)

      for (const holiday of holidays) {
        await createGlobalEvent(workspaceId, {
          title: holiday.name,
          startDate: startOfDay(new Date(holiday.date)).getTime(),
          endDate: endOfDay(new Date(holiday.date)).getTime(),
          color: ANNUAL_LEAVE_COLOR,
          rowIndex: 0,
          createdBy: currentUser.uid,
        })
      }

      console.log(`✅ ${nextYear}년 추가 완료 (공휴일 ${holidays.length}개 등록)`)
    } catch (error) {
      console.error('연도 추가 실패:', error)
      // 실패 시 롤백
      setAvailableYears(availableYears)
      saveAvailableYears(availableYears)
    } finally {
      setIsAddingYear(false)
    }
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* 드롭다운 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-sm font-medium border border-border rounded-md bg-background text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center gap-2"
      >
        <span>{currentYear}년</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 min-w-[120px]">
          {/* 현재(오늘 연도) 버튼 */}
          <button
            onClick={handleGoToCurrent}
            className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors font-medium ${
              isViewingCurrentYear ? 'text-muted-foreground' : 'text-primary'
            }`}
            disabled={isViewingCurrentYear}
          >
            <CalendarDays className="w-4 h-4" />
            <span className="text-sm">현재</span>
          </button>
          <div className="border-b border-border mx-2 my-1" />

          {/* 연도 리스트 */}
          <div className="py-1">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => handleSelectYear(year)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                  currentYear === year
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground'
                }`}
              >
                {year}년
              </button>
            ))}
          </div>

          {/* 연도 추가 버튼 */}
          <div className="border-t border-border mx-2 my-1" />
          <button
            onClick={handleAddYear}
            disabled={isAddingYear}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors text-muted-foreground hover:text-primary disabled:opacity-50"
          >
            {isAddingYear ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span className="text-sm">+ {nextYear}</span>
          </button>
        </div>
      )}
    </div>
  )
}
