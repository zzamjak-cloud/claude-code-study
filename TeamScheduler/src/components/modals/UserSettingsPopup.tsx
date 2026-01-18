// 사용자 설정 팝업 컴포넌트

import { useRef, useEffect, useState, lazy, Suspense } from 'react'
import { LogOut, Shield } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { usePermissions } from '../../lib/hooks/usePermissions'
import { signOut } from '../../lib/firebase/auth'
import { LoadingSpinner } from '../common/LoadingSpinner'

// 최고 관리자 관리 모달 (lazy load)
const SuperAdminManagerModal = lazy(() => import('./SuperAdminManagerModal'))

interface UserSettingsPopupProps {
  onClose: () => void
}

export function UserSettingsPopup({ onClose }: UserSettingsPopupProps) {
  const { currentUser, isAdmin } = useAppStore()
  const { isOwner } = usePermissions()
  const popupRef = useRef<HTMLDivElement>(null)

  // 최고 관리자 관리 모달 상태
  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false)

  // 외부 클릭 시 닫기 (모달이 열려있으면 비활성화)
  useEffect(() => {
    if (showSuperAdminModal) return // 모달이 열려있으면 외부 클릭 무시

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose, showSuperAdminModal])

  // 로그아웃 핸들러
  const handleLogout = async () => {
    try {
      await signOut()
      onClose()
    } catch (error) {
      console.error('로그아웃 실패:', error)
    }
  }

  // 최고 관리자 관리 모달 열기
  const handleOpenSuperAdminModal = () => {
    setShowSuperAdminModal(true)
  }

  return (
    <>
      <div
        ref={popupRef}
        className="absolute top-full right-0 mt-2 bg-card border border-border rounded-lg shadow-xl z-50 w-[300px]"
      >
        {/* 사용자 정보 */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || '사용자'}
                className="w-10 h-10 rounded-full shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-lg shrink-0">
                {currentUser?.displayName?.charAt(0) || 'U'}
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-medium text-foreground truncate">
                {currentUser?.displayName || '사용자'}
              </span>
              <span className="text-sm text-muted-foreground truncate">
                {currentUser?.email}
              </span>
              {isOwner ? (
                <span className="text-xs text-yellow-600 font-medium mt-0.5">
                  최고 관리자
                </span>
              ) : isAdmin && (
                <span className="text-xs text-primary font-medium mt-0.5">
                  관리자
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 메뉴 */}
        <div className="p-2 space-y-1">
          {/* 최고 관리자 관리 (owner만 표시) */}
          {isOwner && (
            <button
              onClick={handleOpenSuperAdminModal}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
            >
              <Shield className="w-4 h-4" />
              최고 관리자 관리
            </button>
          )}

          {/* 로그아웃 버튼 */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-end gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
          >
            로그아웃
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 최고 관리자 관리 모달 */}
      {showSuperAdminModal && (
        <Suspense fallback={<LoadingSpinner size="lg" text="로딩 중..." />}>
          <SuperAdminManagerModal onClose={() => setShowSuperAdminModal(false)} />
        </Suspense>
      )}
    </>
  )
}
