// 관리자 패널 (구성원 관리 + 공휴일 관리 + 프로젝트 관리)

import { useState, useEffect } from 'react'
import { X, Users, Settings, Calendar, FolderKanban } from 'lucide-react'
import { TeamManagement } from './admin/TeamManagement'
import { HolidayManagement } from './admin/HolidayManagement'
import { ProjectManagement } from './admin/ProjectManagement'

interface AdminPanelProps {
  onClose: () => void
  onRefreshTeamMembers?: () => void
  onRefreshProjects?: () => void
  onRefreshSuperAdmins?: () => void
}

type TabType = 'team' | 'holiday' | 'project'

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('team')

  // 모달 열릴 때 배경 스크롤 방지
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-4xl w-full h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">관리</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'team'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            구성원
          </button>
          <button
            onClick={() => setActiveTab('project')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'project'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            프로젝트
          </button>
          <button
            onClick={() => setActiveTab('holiday')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'holiday'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="w-4 h-4" />
            공휴일
          </button>
        </div>

        {/* 탭 컨텐츠 - 개별 스크롤을 위해 overflow-hidden, 내부 h-full 래퍼 */}
        <div className="flex-1 overflow-hidden p-4 min-h-0">
          <div className="h-full">
            {activeTab === 'team' && <TeamManagement />}
            {activeTab === 'project' && <ProjectManagement />}
            {activeTab === 'holiday' && <HolidayManagement />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPanel
