// 사용자 설정 팝업 컴포넌트

import { useRef, useEffect } from 'react'
import { LogOut } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { signOut } from '../../lib/firebase/auth'

interface UserSettingsPopupProps {
  onClose: () => void
}

export function UserSettingsPopup({ onClose }: UserSettingsPopupProps) {
  const { currentUser, isAdmin } = useAppStore()
  const popupRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // 로그아웃 핸들러
  const handleLogout = async () => {
    try {
      await signOut()
      onClose()
    } catch (error) {
      console.error('로그아웃 실패:', error)
    }
  }

  return (
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
            {isAdmin && (
              <span className="text-xs text-primary font-medium mt-0.5">
                관리자
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 로그아웃 버튼 */}
      <div className="p-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-end gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
        >
          로그아웃
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
