// 오늘의 일정 컴포넌트 (하단 고정 패널용 - Google Calendar 연동)

import { useState, useEffect, useCallback } from 'react'
import { Calendar, RefreshCw, ExternalLink, AlertCircle, LogIn } from 'lucide-react'

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

// Google API 설정
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'
const TOKEN_STORAGE_KEY = 'google_calendar_token'

// 토큰 저장/로드 유틸리티
const saveToken = (token: { access_token: string; expires_at: number }) => {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token))
}

const loadToken = (): { access_token: string; expires_at: number } | null => {
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (!stored) return null
  try {
    const token = JSON.parse(stored)
    // 토큰 만료 확인 (5분 여유)
    if (token.expires_at && token.expires_at > Date.now() + 300000) {
      return token
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    return null
  } catch {
    return null
  }
}

const clearToken = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export function TodaySchedule() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gisLoaded, setGisLoaded] = useState(false)
  const [tokenClient, setTokenClient] = useState<google.accounts.oauth2.TokenClient | null>(null)

  // 오늘의 일정 가져오기 (REST API 직접 호출)
  const fetchTodayEventsWithToken = useCallback(async (accessToken: string) => {
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
        if (response.status === 401) {
          clearToken()
          setIsSignedIn(false)
          setError('다시 로그인이 필요합니다.')
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

  // 컴포넌트 마운트 시 저장된 토큰 확인
  useEffect(() => {
    const savedToken = loadToken()
    if (savedToken) {
      setIsSignedIn(true)
      fetchTodayEventsWithToken(savedToken.access_token)
    }
  }, [fetchTodayEventsWithToken])

  // GIS (Google Identity Services) 로드
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      return
    }

    // 이미 로드되었으면 스킵
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      setGisLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      setGisLoaded(true)
    }
    document.body.appendChild(script)
  }, [])

  // TokenClient 초기화
  useEffect(() => {
    if (!gisLoaded || !GOOGLE_CLIENT_ID) return

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.error) {
            console.error('토큰 에러:', response.error)
            setError('인증에 실패했습니다.')
            return
          }

          // 토큰 저장 (expires_in은 초 단위)
          const expiresAt = Date.now() + (response.expires_in * 1000)
          saveToken({ access_token: response.access_token, expires_at: expiresAt })

          setIsSignedIn(true)
          setError(null)
          fetchTodayEventsWithToken(response.access_token)
        },
      })
      setTokenClient(client)
    } catch (err) {
      console.error('TokenClient 초기화 실패:', err)
    }
  }, [gisLoaded, fetchTodayEventsWithToken])

  // 로그인 처리
  const handleSignIn = () => {
    if (!tokenClient) {
      setError('Google 인증이 준비되지 않았습니다.')
      return
    }

    try {
      tokenClient.requestAccessToken({ prompt: 'select_account' })
    } catch (err) {
      console.error('로그인 요청 실패:', err)
      setError('로그인 요청에 실패했습니다.')
    }
  }

  // 로그아웃 처리
  const handleSignOut = () => {
    const savedToken = loadToken()
    if (savedToken) {
      try {
        google.accounts.oauth2.revoke(savedToken.access_token, () => {
          clearToken()
          setIsSignedIn(false)
          setEvents([])
        })
      } catch {
        clearToken()
        setIsSignedIn(false)
        setEvents([])
      }
    } else {
      clearToken()
      setIsSignedIn(false)
      setEvents([])
    }
  }

  // 새로고침
  const handleRefresh = () => {
    const savedToken = loadToken()
    if (savedToken) {
      fetchTodayEventsWithToken(savedToken.access_token)
    } else {
      setIsSignedIn(false)
      setError('다시 로그인이 필요합니다.')
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

  // API 설정이 없는 경우
  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border-b border-border flex-shrink-0">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-foreground">오늘의 일정</span>
        </div>
        <div className="flex-1 p-3 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Google Calendar 연동을 위해<br />
            환경 변수 설정이 필요합니다.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            VITE_GOOGLE_CLIENT_ID
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
          {isSignedIn && (
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
        {!isSignedIn ? (
          // 로그인 필요
          <div className="h-full flex flex-col items-center justify-center">
            <Calendar className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-3 text-center">
              Google Calendar의<br />오늘 일정을 확인하세요
            </p>
            <button
              onClick={handleSignIn}
              disabled={!gisLoaded}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              Google 로그인
            </button>
            {error && (
              <p className="mt-2 text-xs text-destructive">{error}</p>
            )}
          </div>
        ) : error ? (
          // 에러 표시
          <div className="h-full flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-8 h-8 text-destructive mb-2" />
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={handleSignIn}
              className="mt-3 text-xs text-primary hover:underline"
            >
              다시 로그인
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
            <button
              onClick={handleSignOut}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground"
            >
              로그아웃
            </button>
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
            <div className="pt-2 border-t border-border mt-3">
              <button
                onClick={handleSignOut}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                로그아웃
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
