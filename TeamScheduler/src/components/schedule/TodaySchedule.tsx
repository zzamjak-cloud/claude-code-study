// 오늘의 일정 컴포넌트 (하단 고정 패널용 - Google Calendar 연동)
// Firebase 로그인 시 캘린더 토큰이 자동으로 저장됨

import { useState, useEffect, useCallback } from 'react'
import { Calendar, RefreshCw, ExternalLink, AlertCircle, KeyRound } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { loadCalendarToken, clearCalendarToken, refreshCalendarToken } from '../../lib/firebase/auth'

// Google Calendar 이벤트 타입
interface CalendarEvent {
  id: string
  summary: string
  start: {
    dateTime?: string
    date?: string
  }
  end: {
    dateTime?: string
    date?: string
  }
  htmlLink?: string
}

export function TodaySchedule() {
  const { currentUser } = useAppStore()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasToken, setHasToken] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 오늘의 일정 가져오기 (REST API 직접 호출)
  const fetchTodayEvents = useCallback(async (accessToken: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

      const params = new URLSearchParams({
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        showDeleted: 'false',
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '10',
      })

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        // 에러 응답 본문 확인
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ Calendar API 에러:', response.status, errorData)

        if (response.status === 401 || response.status === 403) {
          // 상세 에러 메시지 출력
          const errorMessage = errorData?.error?.message || '알 수 없는 오류'
          const errorReason = errorData?.error?.errors?.[0]?.reason || ''
          console.error('❌ 상세 에러:', errorMessage, errorReason)

          clearCalendarToken()
          setHasToken(false)
          setError(`캘린더 접근 오류: ${errorReason || errorMessage}`)
          return
        }
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      setEvents(data.items || [])
    } catch (err) {
      console.error('일정 가져오기 실패:', err)
      setError('일정을 가져오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 토큰 갱신 버튼 핸들러
  const handleRefreshToken = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)

    try {
      const newToken = await refreshCalendarToken()
      if (newToken) {
        setHasToken(true)
        await fetchTodayEvents(newToken)
      } else {
        setError('토큰 갱신에 실패했습니다. 다시 시도해주세요.')
      }
    } catch (err) {
      console.error('토큰 갱신 실패:', err)
      setError('토큰 갱신에 실패했습니다.')
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchTodayEvents])

  // 토큰 확인 및 일정 로드
  useEffect(() => {
    if (!currentUser) {
      setHasToken(false)
      setEvents([])
      return
    }

    const token = loadCalendarToken()
    if (token) {
      setHasToken(true)
      fetchTodayEvents(token)
    } else {
      setHasToken(false)
    }
  }, [currentUser, fetchTodayEvents])

  // 새로고침
  const handleRefresh = () => {
    const token = loadCalendarToken()
    if (token) {
      fetchTodayEvents(token)
    } else {
      setHasToken(false)
      setError('토큰이 만료되었습니다. 앱에 다시 로그인해주세요.')
    }
  }

  // 시간 포맷팅
  const formatTime = (event: CalendarEvent) => {
    if (event.start.dateTime) {
      const start = new Date(event.start.dateTime)
      const end = new Date(event.end.dateTime!)
      return `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')} - ${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`
    }
    return '종일'
  }

  // 로그인하지 않은 경우
  if (!currentUser) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border-b border-border flex-shrink-0">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-foreground">오늘의 일정</span>
        </div>
        <div className="flex-1 p-3 flex flex-col items-center justify-center text-center">
          <Calendar className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            로그인 후 Google Calendar<br />일정을 확인할 수 있습니다.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-500/10 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-foreground">오늘의 일정</span>
        </div>
        <div className="flex items-center gap-1">
          {hasToken && (
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="새로고침"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* 내용 */}
      <div className="flex-1 p-3 overflow-auto">
        {!hasToken ? (
          // 토큰 없음 - 권한 갱신 필요
          <div className="h-full flex flex-col items-center justify-center">
            <KeyRound className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-2 text-center">
              캘린더 권한이 필요합니다.
            </p>
            <button
              onClick={handleRefreshToken}
              disabled={isRefreshing}
              className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  갱신 중...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  권한 갱신
                </>
              )}
            </button>
            {error && (
              <p className="mt-2 text-xs text-destructive text-center">{error}</p>
            )}
          </div>
        ) : error ? (
          // 에러 표시
          <div className="h-full flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-8 h-8 text-destructive mb-2" />
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 text-xs text-primary hover:underline"
            >
              다시 시도
            </button>
          </div>
        ) : isLoading ? (
          // 로딩 중
          <div className="h-full flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : events.length === 0 ? (
          // 일정 없음
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Calendar className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">오늘 예정된 일정이 없습니다.</p>
          </div>
        ) : (
          // 일정 목록
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="p-2 bg-muted/50 rounded-md border border-border hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {event.summary || '(제목 없음)'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(event)}
                    </p>
                  </div>
                  {event.htmlLink && (
                    <a
                      href={event.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                      title="Google Calendar에서 보기"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
