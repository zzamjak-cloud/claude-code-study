// 메인 App 컴포넌트

import { useState, useEffect, lazy, Suspense } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from './lib/firebase/config'
import { useAppStore } from './store/useAppStore'
import { useAuth } from './lib/hooks/useAuth'
import { useFirebaseSync } from './lib/hooks/useFirebaseSync'
import { useUndoRedo } from './lib/hooks/useUndoRedo'
import { signInWithGoogle } from './lib/firebase/auth'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { AuthGuard } from './components/AuthGuard'
import { Header } from './components/layout/Header'
import { TeamTabs } from './components/layout/TeamTabs'
import { ScheduleGrid } from './components/schedule/ScheduleGrid'
import { MonthFilter } from './components/layout/MonthFilter'
import { YearSelector } from './components/layout/YearSelector'
import { JobTitleFilter } from './components/layout/JobTitleFilter'
import { LogIn, HelpCircle, ZoomIn, ZoomOut, Columns3, RotateCcw, Minus, Plus } from 'lucide-react'

// 코드 스플리팅: 모달 컴포넌트 lazy 로드 (초기 번들 크기 감소)
const AdminPanel = lazy(() => import('./components/modals/AdminPanel'))
const ColorPresetModal = lazy(() => import('./components/modals/ColorPresetModal'))
const HelpModal = lazy(() => import('./components/modals/HelpModal'))
const GlobalNoticeManagerModal = lazy(() => import('./components/modals/GlobalNoticeManagerModal'))

function App() {
  // 인증 및 상태 관리
  useAuth()
  const { currentUser, isLoading, workspaceId, setWorkspace, zoomLevel, setZoomLevel, columnWidthScale, setColumnWidthScale, resetColumnWidthScale, projects, selectedProjectId, setSelectedProjectId, currentYear } =
    useAppStore()

  // Firebase 실시간 동기화 (연도별 페이지네이션 적용)
  useFirebaseSync(workspaceId, currentYear)

  // Undo/Redo 기능 (Ctrl+Z, Ctrl+Shift+Z)
  useUndoRedo()

  // 관리자 패널 상태
  const [showAdminPanel, setShowAdminPanel] = useState(false)

  // 컬러 프리셋 모달 상태
  const [showColorPreset, setShowColorPreset] = useState(false)

  // 도움말 모달 상태
  const [showHelp, setShowHelp] = useState(false)

  // 글로벌 공지 관리 모달 상태
  const [showNoticeManager, setShowNoticeManager] = useState(false)

  // 워크스페이스 자동 설정 및 권한 확인
  // 사용자가 바뀔 때마다 권한을 다시 확인해야 함
  useEffect(() => {
    const initWorkspace = async () => {
      console.log('🔍 App useEffect - currentUser:', currentUser?.uid, 'workspaceId:', workspaceId)

      // 로그인하지 않은 경우 처리하지 않음
      if (!currentUser) {
        return
      }

      // 고정 workspace ID 사용 (모든 팀원이 같은 workspace 공유)
      const wsId = import.meta.env.VITE_WORKSPACE_ID || 'default-workspace'
      console.log('📌 워크스페이스 설정:', wsId)

      try {
        const userEmail = currentUser.email?.toLowerCase() || ''

        // 환경 변수에서 관리자 이메일 확인
        const adminEmailsEnv = import.meta.env.VITE_ADMIN_EMAILS || ''
        const adminEmails = adminEmailsEnv
          .split(',')
          .map((email: string) => email.trim().toLowerCase())
          .filter((email: string) => email.length > 0)

        const isAdminEmail = adminEmails.includes(userEmail)

        if (isAdminEmail) {
          console.log('✅ 환경 변수 관리자 이메일:', userEmail)
        }

        // Firestore에서 workspace 정보 가져오기
        const workspaceRef = doc(db, 'workspaces', wsId)
        const workspaceSnap = await getDoc(workspaceRef)

        let isOwner = false
        if (workspaceSnap.exists()) {
          // workspace가 있으면 ownerId 확인 또는 환경 변수 이메일 확인
          const workspaceData = workspaceSnap.data()
          isOwner = workspaceData.ownerId === currentUser.uid || isAdminEmail
          console.log('✅ Workspace 존재 - isOwner:', isOwner, 'ownerId:', workspaceData.ownerId, 'currentUID:', currentUser.uid, 'isAdminEmail:', isAdminEmail)
        } else {
          // workspace가 없으면 첫 로그인 사용자 → 최고 관리자로 설정하고 생성
          isOwner = true
          console.log('🆕 새 Workspace - 첫 사용자를 최고 관리자로 설정')

          // Firestore에 workspace 생성
          const { setDoc } = await import('firebase/firestore')
          await setDoc(workspaceRef, {
            id: wsId,
            name: 'Loadcomplete',
            ownerId: currentUser.uid,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
          console.log('✅ Workspace 생성 완료 - ownerId:', currentUser.uid)
        }

        setWorkspace(wsId, isOwner)
      } catch (error) {
        console.error('❌ Workspace 확인 실패:', error)
        // 오류 발생 시 일반 사용자로 설정
        setWorkspace(wsId, false)
      }
    }

    initWorkspace()
  }, [currentUser, setWorkspace])  // workspaceId 의존성 제거 - 사용자가 바뀔 때만 실행

  // 프로젝트 기본값 설정 (저장된 값이 없거나 유효하지 않으면 "기타" 프로젝트 선택)
  useEffect(() => {
    if (projects.length === 0) return

    // 현재 선택된 프로젝트가 유효한지 확인
    const isValidProject = selectedProjectId && projects.some(p => p.id === selectedProjectId)

    if (!isValidProject) {
      // "기타" 프로젝트 찾기
      const defaultProject = projects.find(p => p.name === '기타')
      if (defaultProject) {
        setSelectedProjectId(defaultProject.id)
      } else {
        // "기타"가 없으면 첫 번째 프로젝트 선택
        setSelectedProjectId(projects[0].id)
      }
    }
  }, [projects, selectedProjectId, setSelectedProjectId])

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
            구성원들과 함께 연간 일정을 관리하세요
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
      <AuthGuard>
        <div className="h-screen bg-background flex flex-col overflow-hidden">
          {/* 헤더 */}
          <Header
            onOpenColorPreset={() => setShowColorPreset(true)}
            onOpenAdminPanel={() => setShowAdminPanel(true)}
            onOpenNoticeManager={() => setShowNoticeManager(true)}
          />

          {/* 구성원 탭 */}
          <TeamTabs />

        {/* 툴바 */}
        <div className="bg-card border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* 연도 선택 드롭다운 */}
            <YearSelector />

            {/* 월 바로가기 + 필터링 */}
            <MonthFilter />

            {/* 직군 필터링 */}
            <JobTitleFilter />
          </div>

          <div className="flex items-center gap-2">
            {/* 열너비 컨트롤 */}
            <div className="flex items-center gap-1 bg-muted rounded-md p-1">
              <Columns3 className="w-4 h-4 text-muted-foreground ml-1" />
              <button
                onClick={() => setColumnWidthScale(Math.max(0.5, columnWidthScale - 0.25))}
                className="p-1.5 hover:bg-accent rounded transition-colors disabled:opacity-50"
                title="열너비 축소"
                disabled={columnWidthScale <= 0.5}
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs font-medium w-10 text-center" title="열너비 배율">
                {Math.round(columnWidthScale * 100)}%
              </span>
              <button
                onClick={() => setColumnWidthScale(Math.min(4.0, columnWidthScale + 0.25))}
                className="p-1.5 hover:bg-accent rounded transition-colors disabled:opacity-50"
                title="열너비 확대"
                disabled={columnWidthScale >= 4.0}
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={resetColumnWidthScale}
                className="p-1.5 hover:bg-accent rounded transition-colors disabled:opacity-50"
                title="열너비 초기화 (100%)"
                disabled={columnWidthScale === 1.0}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

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
          </div>
        </div>

        {/* 그리드 영역 */}
        <ScheduleGrid />

        {/* 관리자 패널 모달 (lazy loaded) */}
        {showAdminPanel && (
          <Suspense fallback={<LoadingSpinner size="lg" text="로딩 중..." />}>
            <AdminPanel onClose={() => setShowAdminPanel(false)} />
          </Suspense>
        )}

        {/* 컬러 프리셋 모달 (lazy loaded) */}
        {showColorPreset && (
          <Suspense fallback={<LoadingSpinner size="lg" text="로딩 중..." />}>
            <ColorPresetModal onClose={() => setShowColorPreset(false)} />
          </Suspense>
        )}

        {/* 도움말 모달 (lazy loaded) */}
        {showHelp && (
          <Suspense fallback={<LoadingSpinner size="lg" text="로딩 중..." />}>
            <HelpModal onClose={() => setShowHelp(false)} />
          </Suspense>
        )}

        {/* 글로벌 공지 관리 모달 (lazy loaded) */}
        {showNoticeManager && (
          <Suspense fallback={<LoadingSpinner size="lg" text="로딩 중..." />}>
            <GlobalNoticeManagerModal onClose={() => setShowNoticeManager(false)} />
          </Suspense>
        )}
      </div>
      </AuthGuard>
    </ErrorBoundary>
  )
}

export default App
