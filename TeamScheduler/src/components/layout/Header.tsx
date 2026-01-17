// 헤더 컴포넌트

import { Calendar, Settings, LogOut, FolderKanban } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { signOut } from '../../lib/firebase/auth'

export function Header() {
  const { currentUser, isAdmin, projects, selectedProjectId, setSelectedProjectId } = useAppStore()

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('로그아웃 실패:', error)
    }
  }

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* 로고 및 프로젝트 선택 */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">TeamScheduler</h1>
          </div>

          {/* 프로젝트 선택 드롭다운 */}
          {projects.length > 0 && (
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-muted-foreground" />
              <select
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value || null)}
                className="px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-w-[150px]"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 우측 메뉴 */}
        <div className="flex items-center gap-4">
          {/* 사용자 정보 */}
          {currentUser && (
            <div className="flex items-center gap-3">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || '사용자'}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                  {currentUser.displayName?.charAt(0) || 'U'}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {currentUser.displayName || '사용자'}
                </span>
                {isAdmin && (
                  <span className="text-xs text-muted-foreground">관리자</span>
                )}
              </div>
            </div>
          )}

          {/* 설정 버튼 (관리자만) */}
          {isAdmin && (
            <button
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              title="설정"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}

          {/* 로그아웃 버튼 */}
          <button
            onClick={handleLogout}
            className="p-2 text-muted-foreground hover:text-destructive transition-colors"
            title="로그아웃"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
