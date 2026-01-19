// 헤더 컴포넌트

import { useState, useEffect, useRef } from 'react'
import { Calendar, User, Palette, Settings, Megaphone } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { usePermissions } from '../../lib/hooks/usePermissions'
import { UserSettingsPopup } from '../modals/UserSettingsPopup'

interface HeaderProps {
  onOpenColorPreset: () => void
  onOpenAdminPanel: () => void
  onOpenNoticeManager: () => void
}

export function Header({ onOpenColorPreset, onOpenAdminPanel, onOpenNoticeManager }: HeaderProps) {
  const { projects, selectedProjectId, setSelectedProjectId, selectMember, globalNotices } = useAppStore()
  const { isOwner } = usePermissions() // 최고 관리자만 관리 기능 사용 가능
  const [showUserSettings, setShowUserSettings] = useState(false)
  const [currentNoticeIndex, setCurrentNoticeIndex] = useState(0)
  const userSettingsRef = useRef<HTMLDivElement>(null)

  // 숨김 프로젝트 제외한 목록
  const visibleProjects = projects.filter(p => !p.isHidden)

  // 선택된 프로젝트 이름
  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const projectName = selectedProject?.name || 'TeamScheduler'

  // 프로젝트 변경 핸들러
  const handleProjectChange = (projectId: string | null) => {
    setSelectedProjectId(projectId)
    selectMember(null)  // 통합 탭으로 초기화
  }

  // 공지 자동 순환 (10초마다)
  useEffect(() => {
    if (globalNotices.length <= 1) return

    const interval = setInterval(() => {
      setCurrentNoticeIndex((prev) => (prev + 1) % globalNotices.length)
    }, 10000)

    return () => clearInterval(interval)
  }, [globalNotices.length])

  // 공지 인덱스 리셋 (공지 목록 변경 시)
  useEffect(() => {
    if (currentNoticeIndex >= globalNotices.length) {
      setCurrentNoticeIndex(0)
    }
  }, [globalNotices.length, currentNoticeIndex])

  return (
    <header className="bg-card border-b border-border px-6 py-3">
      <div className="flex items-center justify-between">
        {/* 왼쪽: 로고 및 프로젝트명 */}
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-primary" />
          <div className="flex items-baseline gap-1">
            <h1 className="text-xl font-bold text-foreground">{projectName}</h1>
            <span className="text-sm text-muted-foreground">일정</span>
          </div>
        </div>

        {/* 글로벌 공지 (오른쪽 정렬) */}
        <div className="flex-1 flex items-center justify-end mx-4">
          {globalNotices.length > 0 && (
            <div
              onClick={isOwner ? onOpenNoticeManager : undefined}
              className={`flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 max-w-md ${
                isOwner ? 'cursor-pointer hover:bg-primary/15 transition-colors' : ''
              }`}
              title={isOwner ? '공지 관리' : undefined}
            >
              <Megaphone className="w-4 h-4 text-primary shrink-0" />
              <div className="overflow-hidden relative w-96 h-5">
                <div
                  className="text-sm text-foreground whitespace-nowrap animate-slide-up absolute inset-0"
                  key={currentNoticeIndex}
                >
                  {globalNotices[currentNoticeIndex]?.content}
                </div>
              </div>
              {globalNotices.length > 1 && (
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {currentNoticeIndex + 1}/{globalNotices.length}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 오른쪽: 프로젝트 선택, 내정보, 색상, 관리 */}
        <div className="flex items-center gap-3">
          {/* 프로젝트 선택 드롭다운 (숨김 프로젝트 제외) */}
          {visibleProjects.length > 0 && (
            <select
              value={selectedProjectId || ''}
              onChange={(e) => handleProjectChange(e.target.value || null)}
              className="px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-w-[130px]"
            >
              {visibleProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}

          {/* 구분선 */}
          <div className="w-px h-6 bg-border" />

          {/* 내정보 버튼 */}
          <div className="relative" ref={userSettingsRef}>
            <button
              onClick={() => setShowUserSettings(!showUserSettings)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              title="내 정보"
            >
              <User className="w-5 h-5" />
            </button>
            {showUserSettings && (
              <UserSettingsPopup onClose={() => setShowUserSettings(false)} />
            )}
          </div>

          {/* 최고 관리자 전용 버튼들 */}
          {isOwner && (
            <>
              {/* 색상 설정 버튼 */}
              <button
                onClick={onOpenColorPreset}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                title="일정 기본 색상 설정"
              >
                <Palette className="w-5 h-5" />
              </button>

              {/* 관리 버튼 */}
              <button
                onClick={onOpenAdminPanel}
                className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                title="관리"
              >
                <Settings className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
