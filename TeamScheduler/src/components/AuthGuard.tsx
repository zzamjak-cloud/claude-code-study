// 인증 가드 컴포넌트 - 등록된 구성원만 접근 허용

import { ReactNode } from 'react'
import { useAppStore } from '../store/useAppStore'
import { usePermissions } from '../lib/hooks/usePermissions'
import { ShieldAlert, LogOut } from 'lucide-react'
import { signOut } from '../lib/firebase/auth'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { currentUser, workspaceId } = useAppStore()
  const { isMember } = usePermissions()

  // 1. 로그인 안 된 경우 - Firebase Auth가 처리 (이미 로그인 페이지 표시)
  if (!currentUser || !workspaceId) {
    return null
  }

  // 2. 로그인했지만 등록되지 않은 구성원인 경우 - 접근 거부
  if (!isMember) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-destructive/10 rounded-full">
              <ShieldAlert className="w-12 h-12 text-destructive" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-3">
            접근 권한 없음
          </h2>

          <p className="text-muted-foreground mb-2">
            현재 로그인한 계정은 이 워크스페이스의 등록된 구성원이 아닙니다.
          </p>

          <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-muted-foreground mb-2">
              <strong className="text-foreground">현재 계정:</strong>
            </p>
            <p className="text-sm font-medium text-foreground">
              {currentUser.email}
            </p>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground mb-6">
            <p>
              <strong className="text-foreground">해결 방법:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 text-left">
              <li>관리자에게 구성원 등록을 요청하세요</li>
              <li>등록된 이메일로 로그인하세요</li>
              <li>다른 계정으로 로그인하세요</li>
            </ul>
          </div>

          <button
            onClick={async () => {
              try {
                await signOut()
              } catch (error) {
                console.error('로그아웃 실패:', error)
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            다른 계정으로 로그인
            <LogOut className="w-4 h-4" />
          </button>

          <p className="text-xs text-muted-foreground mt-4">
            관리자에게 문의하여 이 이메일 주소를 구성원으로 등록해 달라고 요청하세요.
          </p>
        </div>
      </div>
    )
  }

  // 3. 등록된 구성원 - 앱 접근 허용
  return <>{children}</>
}
