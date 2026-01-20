// 공휴일 관리 탭 컴포넌트

import { useState, useMemo } from 'react'
import { Plus, Check, Trash2, RefreshCw } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { addEvent, createGlobalEvent, deleteEvent, batchAddEvents, batchCreateGlobalEvents } from '../../../lib/firebase/firestore'
import { ANNUAL_LEAVE_COLOR } from '../../../lib/constants/colors'
import { getHolidaysForYear, KoreanHoliday } from '../../../lib/utils/koreanHolidays'
import { startOfDay, endOfDay, format } from 'date-fns'

export function HolidayManagement() {
  const { workspaceId, currentYear, events, currentUser } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [customHolidayName, setCustomHolidayName] = useState('')
  const [customHolidayDate, setCustomHolidayDate] = useState('')

  // 현재 연도의 대한민국 공휴일 목록
  const koreanHolidays = useMemo(() => getHolidaysForYear(currentYear), [currentYear])

  // 이미 등록된 공휴일 확인 (events에서 holiday 타입)
  const registeredHolidayDates = useMemo(() => {
    return new Set(
      events
        .filter(e => e.type === 'holiday')
        .map(e => format(new Date(e.date), 'yyyy-MM-dd'))
    )
  }, [events])

  // 공휴일을 특이사항(events)에 등록
  const registerHoliday = async (holiday: KoreanHoliday) => {
    if (!workspaceId || !currentUser) return

    setIsLoading(true)
    try {
      const dateTimestamp = new Date(holiday.date).getTime()

      await addEvent(workspaceId, {
        title: holiday.name,
        date: dateTimestamp,
        type: 'holiday',
        color: ANNUAL_LEAVE_COLOR,
        createdBy: currentUser.uid,
      })

      await createGlobalEvent(workspaceId, {
        title: holiday.name,
        startDate: startOfDay(new Date(holiday.date)).getTime(),
        endDate: endOfDay(new Date(holiday.date)).getTime(),
        color: ANNUAL_LEAVE_COLOR,
        rowIndex: 0,
        createdBy: currentUser.uid,
      })

    } catch (error) {
      console.error('공휴일 등록 실패:', error)
      alert('공휴일 등록에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 모든 공휴일 일괄 등록 (배치 쓰기로 최적화)
  const registerAllHolidays = async () => {
    if (!workspaceId || !currentUser) return

    const unregistered = koreanHolidays.filter(h => !registeredHolidayDates.has(h.date))
    if (unregistered.length === 0) {
      alert('모든 공휴일이 이미 등록되어 있습니다.')
      return
    }

    setIsLoading(true)
    try {
      // 특이사항 데이터 준비
      const eventData = unregistered.map(holiday => ({
        title: holiday.name,
        date: new Date(holiday.date).getTime(),
        type: 'holiday' as const,
        color: ANNUAL_LEAVE_COLOR,
        createdBy: currentUser.uid,
      }))

      // 글로벌 이벤트 데이터 준비
      const globalEventData = unregistered.map(holiday => ({
        title: holiday.name,
        startDate: startOfDay(new Date(holiday.date)).getTime(),
        endDate: endOfDay(new Date(holiday.date)).getTime(),
        color: ANNUAL_LEAVE_COLOR,
        rowIndex: 0,
        createdBy: currentUser.uid,
      }))

      // 배치 쓰기로 한 번에 등록 (Firebase 쓰기 비용 절감)
      await Promise.all([
        batchAddEvents(workspaceId, eventData),
        batchCreateGlobalEvents(workspaceId, globalEventData),
      ])

      alert(`${unregistered.length}개의 공휴일이 등록되었습니다.`)
    } catch (error) {
      console.error('공휴일 일괄 등록 실패:', error)
      alert('공휴일 등록 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 커스텀 휴일 추가
  const addCustomHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceId || !currentUser || !customHolidayName.trim() || !customHolidayDate) return

    setIsLoading(true)
    try {
      const dateTimestamp = new Date(customHolidayDate).getTime()

      await addEvent(workspaceId, {
        title: customHolidayName.trim(),
        date: dateTimestamp,
        type: 'holiday',
        color: ANNUAL_LEAVE_COLOR,
        createdBy: currentUser.uid,
      })

      await createGlobalEvent(workspaceId, {
        title: customHolidayName.trim(),
        startDate: startOfDay(new Date(customHolidayDate)).getTime(),
        endDate: endOfDay(new Date(customHolidayDate)).getTime(),
        color: ANNUAL_LEAVE_COLOR,
        rowIndex: 0,
        createdBy: currentUser.uid,
      })

      setCustomHolidayName('')
      setCustomHolidayDate('')
      alert('휴일이 등록되었습니다.')
    } catch (error) {
      console.error('커스텀 휴일 등록 실패:', error)
      alert('휴일 등록에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 등록된 공휴일 삭제
  const removeHoliday = async (eventId: string) => {
    if (!workspaceId) return

    setIsLoading(true)
    try {
      await deleteEvent(workspaceId, eventId)
    } catch (error) {
      console.error('공휴일 삭제 실패:', error)
      alert('공휴일 삭제에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
      {/* 왼쪽: 커스텀 휴일 추가 (상단 고정) + 공휴일 등록 */}
      <div className="flex flex-col space-y-4 h-full overflow-hidden">
        {/* 커스텀 휴일 추가 - 상단 고정 */}
        <div className="pb-4 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground mb-3">
            커스텀 휴일 추가
          </h4>
          <form onSubmit={addCustomHoliday} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={customHolidayName}
                onChange={(e) => setCustomHolidayName(e.target.value)}
                placeholder="휴일명"
                className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <input
                type="date"
                value={customHolidayDate}
                onChange={(e) => setCustomHolidayDate(e.target.value)}
                className="px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !customHolidayName.trim() || !customHolidayDate}
              className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              휴일 추가
            </button>
          </form>
        </div>

        {/* 공휴일 등록 - 스크롤 영역 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-foreground">
              {currentYear}년 대한민국 공휴일
            </h4>
            <button
              onClick={registerAllHolidays}
              disabled={isLoading}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              전체 등록
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            공휴일을 등록하면 타임라인에 배경색이 적용됩니다.
          </p>

          <div className="flex-1 space-y-1 overflow-y-auto scrollbar-thin min-h-0">
            {koreanHolidays.map((holiday) => {
              const isRegistered = registeredHolidayDates.has(holiday.date)
              return (
                <div
                  key={holiday.date}
                  className={`flex items-center justify-between p-2 rounded-md text-sm ${
                    isRegistered ? 'bg-green-50 dark:bg-green-950/30' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isRegistered && <Check className="w-4 h-4 text-green-600" />}
                    <span className={isRegistered ? 'text-green-700 dark:text-green-400' : 'text-foreground'}>
                      {holiday.name}
                    </span>
                    {holiday.isSubstitute && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        대체
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(holiday.date), 'M/d')}
                    </span>
                    {!isRegistered ? (
                      <button
                        onClick={() => registerHoliday(holiday)}
                        disabled={isLoading}
                        className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        등록
                      </button>
                    ) : (
                      <span className="text-xs text-green-600">등록됨</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 오른쪽: 등록된 휴일 목록 */}
      <div className="flex flex-col space-y-4 h-full overflow-hidden">
        <h4 className="text-sm font-semibold text-foreground">
          등록된 휴일 ({events.filter(e => e.type === 'holiday').length}개)
        </h4>

        {events.filter(e => e.type === 'holiday').length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            등록된 휴일이 없습니다.
          </p>
        ) : (
          <div className="flex-1 space-y-1 overflow-y-auto scrollbar-thin min-h-0">
            {events
              .filter(e => e.type === 'holiday')
              .sort((a, b) => a.date - b.date)
              .map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: event.color }} />
                    <span className="text-foreground">{event.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(event.date), 'yyyy/M/d')}
                    </span>
                    <button
                      onClick={() => removeHoliday(event.id)}
                      disabled={isLoading}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default HolidayManagement
