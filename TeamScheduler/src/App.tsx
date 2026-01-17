// 메인 App 컴포넌트

import { useState, useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import { useAuth } from './lib/hooks/useAuth'
import { useFirebaseSync } from './lib/hooks/useFirebaseSync'
import { signInWithGoogle } from './lib/firebase/auth'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { Header } from './components/layout/Header'
import { TeamTabs } from './components/layout/TeamTabs'
import { ScheduleGrid } from './components/schedule/ScheduleGrid'
import { AdminPanel } from './components/modals/AdminPanel'
import { ColorPresetModal } from './components/modals/ColorPresetModal'
import { LogIn, Settings, Palette } from 'lucide-react'

function App() {
  // 인증 및 상태 관리
  useAuth()
  const { currentUser, isLoading, workspaceId, setWorkspace, isAdmin } =
    useAppStore()

  // Firebase 실시간 동기화
  useFirebaseSync(workspaceId)

  // 관리자 패널 상태
  const [showAdminPanel, setShowAdminPanel] = useState(false)

  // 컬러 프리셋 모달 상태
  const [showColorPreset, setShowColorPreset] = useState(false)

  // 임시: 워크스페이스 자동 설정 (실제로는 워크스페이스 선택 화면 필요)
  useEffect(() => {
    console.log('🔍 App useEffect - currentUser:', currentUser?.uid, 'workspaceId:', workspaceId)
    if (currentUser && !workspaceId) {
      console.log('📌 워크스페이스 설정:', currentUser.uid)
      // 임시로 사용자 ID를 워크스페이스 ID로 사용
      setWorkspace(currentUser.uid, true) // 모든 사용자를 관리자로 설정 (테스트용)
    }
  }, [currentUser, workspaceId, setWorkspace])

  // 로그인 핸들러
  const handleLogin = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('로그인 실패:', error)
      alert('로그인에 실패했습니다.')
    }
  }

  // 로딩 중
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="로딩 중..." />
      </div>
    )
  }

  // 로그인 화면
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-xl p-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            TeamScheduler
          </h1>
          <p className="text-muted-foreground mb-8">
            팀원들과 함께 연간 일정을 관리하세요
          </p>

          <button
            onClick={handleLogin}
            className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-3"
          >
            <LogIn className="w-5 h-5" />
            Google 로그인
          </button>

          <p className="text-xs text-muted-foreground mt-4">
            로그인하면 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    )
  }

  // 메인 화면
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background flex flex-col">
        {/* 헤더 */}
        <Header />

        {/* 팀원 탭 */}
        <TeamTabs />

        {/* 툴바 */}
        <div className="bg-card border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-foreground">2026년</span>

            {/* 월 바로가기 */}
            <select
              className="px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground hover:bg-muted transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
              onChange={(e) => {
                const month = parseInt(e.target.value)
                if (month >= 1 && month <= 12) {
                  // 해당 월의 첫날로 스크롤 (대략적인 픽셀 계산)
                  const daysBeforeMonth = new Date(2026, month - 1, 1).getTime() - new Date(2026, 0, 1).getTime()
                  const dayOffset = Math.floor(daysBeforeMonth / (1000 * 60 * 60 * 24))
                  const scrollX = dayOffset * 50 // 기본 셀 너비 50px

                  // 그리드 영역 찾아서 스크롤
                  const gridElement = document.querySelector('.flex-1.overflow-auto')
                  if (gridElement) {
                    gridElement.scrollLeft = scrollX
                  }
                }
                // 선택 초기화
                e.target.value = ''
              }}
              value=""
            >
              <option value="" disabled>월 바로가기</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {month}월
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* 컬러 프리셋 버튼 */}
            <button
              onClick={() => setShowColorPreset(true)}
              className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-accent transition-colors font-medium flex items-center gap-2"
              title="일정 기본 색상 설정"
            >
              <Palette className="w-4 h-4" />
              색상 설정
            </button>

            {/* 관리자 버튼 */}
            {isAdmin && (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                팀원 관리
              </button>
            )}
          </div>
        </div>

        {/* 그리드 영역 */}
        <ScheduleGrid />

        {/* 관리자 패널 모달 */}
        {showAdminPanel && (
          <AdminPanel onClose={() => setShowAdminPanel(false)} />
        )}

        {/* 컬러 프리셋 모달 */}
        {showColorPreset && (
          <ColorPresetModal onClose={() => setShowColorPreset(false)} />
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App
