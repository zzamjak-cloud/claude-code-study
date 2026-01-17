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
import { HelpModal } from './components/modals/HelpModal'
import { MonthFilter } from './components/layout/MonthFilter'
import { LogIn, Settings, Palette, HelpCircle, ZoomIn, ZoomOut } from 'lucide-react'

function App() {
  // 인증 및 상태 관리
  useAuth()
  const { currentUser, isLoading, workspaceId, setWorkspace, isAdmin, zoomLevel, setZoomLevel } =
    useAppStore()

  // Firebase 실시간 동기화
  useFirebaseSync(workspaceId)

  // 관리자 패널 상태
  const [showAdminPanel, setShowAdminPanel] = useState(false)

  // 컬러 프리셋 모달 상태
  const [showColorPreset, setShowColorPreset] = useState(false)

  // 도움말 모달 상태
  const [showHelp, setShowHelp] = useState(false)

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

            {/* 월 바로가기 + 필터링 */}
            <MonthFilter />
          </div>

          <div className="flex items-center gap-2">
            {/* 줌 컨트롤 */}
            <div className="flex items-center gap-1 bg-muted rounded-md p-1">
              <button
                onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                className="p-1.5 hover:bg-accent rounded transition-colors disabled:opacity-50"
                title="축소"
                disabled={zoomLevel <= 0.5}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium w-12 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel(Math.min(2.0, zoomLevel + 0.25))}
                className="p-1.5 hover:bg-accent rounded transition-colors disabled:opacity-50"
                title="확대"
                disabled={zoomLevel >= 2.0}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* 도움말 버튼 */}
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 bg-muted text-foreground rounded-md hover:bg-accent transition-colors"
              title="사용 가이드"
            >
              <HelpCircle className="w-5 h-5" />
            </button>

            {/* 관리자 전용 버튼들 */}
            {isAdmin && (
              <>
                {/* 컬러 프리셋 버튼 */}
                <button
                  onClick={() => setShowColorPreset(true)}
                  className="p-2 bg-muted text-foreground rounded-md hover:bg-accent transition-colors"
                  title="일정 기본 색상 설정"
                >
                  <Palette className="w-5 h-5" />
                </button>

                {/* 팀원 관리 버튼 */}
                <button
                  onClick={() => setShowAdminPanel(true)}
                  className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  title="팀원 관리"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </>
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

        {/* 도움말 모달 */}
        {showHelp && (
          <HelpModal onClose={() => setShowHelp(false)} />
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App
