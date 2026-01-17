// 관리자 패널 (구성원 관리 + 공휴일 관리 + 프로젝트 관리)

import { useState, useMemo } from 'react'
import { X, Plus, Users, Settings, Calendar, Check, Trash2, RefreshCw, FolderKanban, Pencil, ChevronUp, ChevronDown, Filter, Search, Crown, EyeOff, Eye, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { addTeamMember, updateTeamMember, deleteTeamMember, addEvent, createGlobalEvent, deleteEvent, createProject, updateProject, deleteProject as deleteProjectFirebase } from '../../lib/firebase/firestore'
import { ANNUAL_LEAVE_COLOR } from '../../lib/constants/colors'
import { getHolidaysForYear, KoreanHoliday } from '../../lib/utils/koreanHolidays'
import { startOfDay, endOfDay, format } from 'date-fns'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { ProjectType } from '../../types/project'
import { MemberStatus } from '../../types/team'

// 기본 직군 카테고리
const DEFAULT_JOB_TITLES = ['기획', '기술', '아트', 'QA', '사업', '마케팅', '경영진']

// localStorage에서 커스텀 직군 로드
const getCustomJobTitles = (): string[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('customJobTitles')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
  }
  return []
}

// 커스텀 직군 저장
const saveCustomJobTitles = (titles: string[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('customJobTitles', JSON.stringify(titles))
  }
}

// 랜덤 색상 생성
const getRandomColor = () => {
  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

interface AdminPanelProps {
  onClose: () => void
}

type TabType = 'team' | 'holiday' | 'project'

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('team')

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
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

        {/* 탭 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'team' && <TeamManagement />}
          {activeTab === 'project' && <ProjectManagement />}
          {activeTab === 'holiday' && <HolidayManagement />}
        </div>
      </div>
    </div>
  )
}

// 구성원 관리 탭
function TeamManagement() {
  const { workspaceId, members } = useAppStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [role, setRole] = useState('')
  const [isLeader, setIsLeader] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterJobTitle, setFilterJobTitle] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // 커스텀 직군 관리
  const [customJobTitles, setCustomJobTitles] = useState<string[]>(getCustomJobTitles)
  const [showAddJobTitle, setShowAddJobTitle] = useState(false)
  const [newJobTitle, setNewJobTitle] = useState('')

  // 전체 직군 목록 (기본 + 커스텀)
  const allJobTitles = useMemo(() => {
    return [...DEFAULT_JOB_TITLES, ...customJobTitles]
  }, [customJobTitles])

  // 커스텀 직군 추가
  const handleAddJobTitle = () => {
    const trimmed = newJobTitle.trim()
    if (!trimmed) return
    if (allJobTitles.includes(trimmed)) {
      alert('이미 존재하는 직군입니다.')
      return
    }
    const updated = [...customJobTitles, trimmed]
    setCustomJobTitles(updated)
    saveCustomJobTitles(updated)
    setNewJobTitle('')
    setShowAddJobTitle(false)
    setJobTitle(trimmed) // 새로 추가한 직군 자동 선택
  }

  // 커스텀 직군 삭제
  const handleRemoveJobTitle = (title: string) => {
    if (DEFAULT_JOB_TITLES.includes(title)) return // 기본 직군은 삭제 불가
    const updated = customJobTitles.filter(t => t !== title)
    setCustomJobTitles(updated)
    saveCustomJobTitles(updated)
    if (jobTitle === title) setJobTitle('')
  }

  // 편집 상태
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editJobTitle, setEditJobTitle] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editIsLeader, setEditIsLeader] = useState(false)
  const [editStatus, setEditStatus] = useState<MemberStatus>(undefined)

  // 삭제 확인 상태 (2단계)
  const [deletingMember, setDeletingMember] = useState<{ id: string; name: string } | null>(null)
  const [showFinalDeleteConfirm, setShowFinalDeleteConfirm] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')

  // 직군별 필터링 + 검색 + 이름순 정렬 + 상태별 정렬
  const filteredMembers = useMemo(() => {
    let result = members

    // 직군 필터
    if (filterJobTitle !== 'all') {
      result = result.filter((m) => m.jobTitle === filterJobTitle)
    }

    // 이름 검색
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((m) => m.name.toLowerCase().includes(query))
    }

    // 정렬: 휴직중/퇴사 구성원을 마지막으로, 그 안에서 이름순
    return result.sort((a, b) => {
      // 상태 순서: undefined(재직중) < 'leave'(휴직중) < 'resigned'(퇴사)
      const statusOrder = (status: MemberStatus) => {
        if (!status) return 0
        if (status === 'leave') return 1
        if (status === 'resigned') return 2
        return 0
      }
      const statusDiff = statusOrder(a.status) - statusOrder(b.status)
      if (statusDiff !== 0) return statusDiff
      return a.name.localeCompare(b.name, 'ko')
    })
  }, [members, filterJobTitle, searchQuery])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!workspaceId || !name.trim()) {
      alert('이름을 입력해주세요.')
      return
    }

    setIsSubmitting(true)

    try {
      const order = members.length

      await addTeamMember(workspaceId, {
        name: name.trim(),
        email: email.trim(),
        jobTitle: jobTitle.trim(),
        role: role.trim(),
        isLeader,
        color: getRandomColor(),
        isHidden: false,
        order,
        rowCount: 1,
      })

      setName('')
      setEmail('')
      setJobTitle('')
      setRole('')
      setIsLeader(false)
      alert('구성원이 추가되었습니다.')
    } catch (error) {
      console.error('구성원 추가 실패:', error)
      alert('구성원 추가에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 편집 시작
  const startEditing = (member: typeof members[0]) => {
    setEditingMember(member.id)
    setEditName(member.name)
    setEditEmail(member.email || '')
    setEditJobTitle(member.jobTitle || '')
    setEditRole(member.role || '')
    setEditIsLeader(member.isLeader || false)
    setEditStatus(member.status)
  }

  // 편집 저장
  const saveEdit = async () => {
    if (!workspaceId || !editingMember || !editName.trim()) return

    setIsSubmitting(true)
    try {
      await updateTeamMember(workspaceId, editingMember, {
        name: editName.trim(),
        email: editEmail.trim(),
        jobTitle: editJobTitle.trim(),
        role: editRole.trim(),
        isLeader: editIsLeader,
        status: editStatus,
      })
      setEditingMember(null)
    } catch (error) {
      console.error('구성원 수정 실패:', error)
      alert('구성원 수정에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 1단계 삭제 확인 → 2단계 확인 다이얼로그 표시
  const handleDeleteConfirm = () => {
    if (!deletingMember) return
    setShowFinalDeleteConfirm(true)
    setDeleteConfirmInput('')
  }

  // 2단계 삭제 취소
  const handleCancelFinalDelete = () => {
    setShowFinalDeleteConfirm(false)
    setDeleteConfirmInput('')
    setDeletingMember(null)
  }

  // 2단계 최종 삭제 실행
  const handleFinalDeleteConfirm = async () => {
    if (!workspaceId || !deletingMember) return
    if (deleteConfirmInput !== '삭제') return

    setIsSubmitting(true)
    try {
      await deleteTeamMember(workspaceId, deletingMember.id)
    } catch (error) {
      console.error('구성원 삭제 실패:', error)
      alert('구성원 삭제에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
      setShowFinalDeleteConfirm(false)
      setDeleteConfirmInput('')
      setDeletingMember(null)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 왼쪽: 구성원 추가 폼 */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4" />
          구성원 추가
        </h4>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              이름 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* 직군 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              직군
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-[72px] overflow-y-auto">
              {allJobTitles.map((title) => {
                const isCustom = !DEFAULT_JOB_TITLES.includes(title)
                const isSelected = jobTitle === title
                return (
                  <div key={title} className="relative group">
                    <button
                      type="button"
                      onClick={() => setJobTitle(isSelected ? '' : title)}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {title}
                    </button>
                    {/* 커스텀 직군 삭제 버튼 */}
                    {isCustom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveJobTitle(title)
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        title="삭제"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
              {/* 추가 버튼 */}
              {showAddJobTitle ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newJobTitle}
                    onChange={(e) => setNewJobTitle(e.target.value)}
                    placeholder="직군명"
                    className="w-20 px-2 py-1 text-xs border border-primary rounded-md bg-background text-foreground focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddJobTitle()
                      } else if (e.key === 'Escape') {
                        setShowAddJobTitle(false)
                        setNewJobTitle('')
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddJobTitle}
                    className="p-1 text-primary hover:bg-primary/10 rounded"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddJobTitle(false)
                      setNewJobTitle('')
                    }}
                    className="p-1 text-muted-foreground hover:bg-muted rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddJobTitle(true)}
                  className="px-2 py-1 text-xs rounded-md border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  추가
                </button>
              )}
            </div>
          </div>

          {/* 역할 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              역할
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="리드, 담당자 등"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* 리더 여부 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isLeader}
              onChange={(e) => setIsLeader(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <Crown className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-foreground">리더 (팀장/서브 관리자)</span>
          </label>

          {/* 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? '추가 중...' : (
              <>
                <Plus className="w-4 h-4" />
                구성원 추가
              </>
            )}
          </button>
        </form>
      </div>

      {/* 오른쪽: 구성원 목록 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">
            등록된 구성원 ({filteredMembers.length}명)
          </h4>

          {/* 직군 필터 */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filterJobTitle}
              onChange={(e) => setFilterJobTitle(e.target.value)}
              className="px-2 py-1 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">전체</option>
              {allJobTitles.map((title) => (
                <option key={title} value={title}>{title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 검색 필드 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름으로 검색..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* 구성원 목록 */}
        <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-thin">
          {filteredMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {filterJobTitle === 'all' && !searchQuery
                ? '등록된 구성원이 없습니다.'
                : '검색 결과가 없습니다.'}
            </p>
          ) : (
            filteredMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border"
              >
                {editingMember === member.id ? (
                  // 편집 모드
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                      placeholder="이름"
                    />
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                      placeholder="이메일"
                    />
                    {/* 직군 카테고리 선택 */}
                    <div>
                      <span className="text-xs text-muted-foreground mb-1 block">직군</span>
                      <div className="flex flex-wrap gap-1 max-h-[56px] overflow-y-auto">
                        {allJobTitles.map((title) => (
                          <button
                            key={title}
                            type="button"
                            onClick={() => setEditJobTitle(editJobTitle === title ? '' : title)}
                            className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                              editJobTitle === title
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            {title}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                      placeholder="역할"
                    />
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editIsLeader}
                        onChange={(e) => setEditIsLeader(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-xs">리더</span>
                    </label>
                    {/* 상태 선택 */}
                    <div>
                      <span className="text-xs text-muted-foreground mb-1 block">상태</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setEditStatus(undefined)}
                          className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                            !editStatus
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          재직중
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditStatus('leave')}
                          className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                            editStatus === 'leave'
                              ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                              : 'border-border hover:border-amber-500/50'
                          }`}
                        >
                          휴직중
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditStatus('resigned')}
                          className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                            editStatus === 'resigned'
                              ? 'border-destructive bg-destructive/10 text-destructive'
                              : 'border-border hover:border-destructive/50'
                          }`}
                        >
                          퇴사
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={isSubmitting}
                        className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingMember(null)}
                        className="px-3 py-1 text-xs bg-muted text-foreground rounded hover:bg-accent"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  // 표시 모드
                  <>
                    {/* 리더 아이콘 */}
                    {member.isLeader && (
                      <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {member.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {member.jobTitle && (
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                            {member.jobTitle}
                          </span>
                        )}
                        {member.role && <span>{member.role}</span>}
                      </div>
                      {member.email && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {member.email}
                        </p>
                      )}
                    </div>
                    {member.status === 'leave' && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 rounded">
                        휴직중
                      </span>
                    )}
                    {member.status === 'resigned' && (
                      <span className="text-xs px-1.5 py-0.5 bg-destructive/10 text-destructive rounded">
                        퇴사
                      </span>
                    )}
                    {member.isHidden && (
                      <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                        숨김
                      </span>
                    )}
                    {/* 편집/삭제 버튼 */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEditing(member)}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors"
                        title="편집"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingMember({ id: member.id, name: member.name })}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 1단계 삭제 확인 다이얼로그 */}
      {deletingMember && !showFinalDeleteConfirm && (
        <ConfirmDialog
          title="구성원 삭제"
          message={`"${deletingMember.name}" 구성원을 삭제하시겠습니까? 해당 구성원의 모든 일정도 함께 삭제됩니다.`}
          confirmText="삭제"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingMember(null)}
          isDestructive
        />
      )}

      {/* 2단계 최종 삭제 확인 다이얼로그 */}
      {showFinalDeleteConfirm && deletingMember && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelFinalDelete()
          }}
        >
          <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">최종 삭제 확인</h3>
                <p className="text-sm text-muted-foreground">이 작업은 되돌릴 수 없습니다</p>
              </div>
            </div>
            <p className="text-sm text-foreground mb-4">
              <span className="font-semibold text-destructive">"{deletingMember.name}"</span> 구성원과 모든 일정이 영구적으로 삭제됩니다.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                확인을 위해 <span className="font-bold text-destructive">"삭제"</span>라고 입력하세요
              </label>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder="삭제"
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-destructive"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelFinalDelete}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-accent transition-colors font-medium"
              >
                취소
              </button>
              <button
                onClick={handleFinalDeleteConfirm}
                disabled={isSubmitting || deleteConfirmInput !== '삭제'}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '삭제 중...' : '영구 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 공휴일 관리 탭
function HolidayManagement() {
  const { workspaceId, currentYear, events, currentUser } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [customHolidayName, setCustomHolidayName] = useState('')
  const [customHolidayDate, setCustomHolidayDate] = useState('')

  // 현재 연도의 대한민국 공휴일 목록
  const koreanHolidays = useMemo(() => getHolidaysForYear(currentYear), [currentYear])

  // 이미 등록된 공휴일 확인 (events에서 holiday 타입)
  const registeredHolidayDates = useMemo(() => {
    return new Set(
      events
        .filter(e => e.type === 'holiday')
        .map(e => format(new Date(e.date), 'yyyy-MM-dd'))
    )
  }, [events])

  // 공휴일을 특이사항(events)에 등록
  const registerHoliday = async (holiday: KoreanHoliday) => {
    if (!workspaceId || !currentUser) return

    setIsLoading(true)
    try {
      const dateTimestamp = new Date(holiday.date).getTime()

      await addEvent(workspaceId, {
        title: holiday.name,
        date: dateTimestamp,
        type: 'holiday',
        color: ANNUAL_LEAVE_COLOR,
        createdBy: currentUser.uid,
      })

      await createGlobalEvent(workspaceId, {
        title: holiday.name,
        startDate: startOfDay(new Date(holiday.date)).getTime(),
        endDate: endOfDay(new Date(holiday.date)).getTime(),
        color: ANNUAL_LEAVE_COLOR,
        rowIndex: 0,
        createdBy: currentUser.uid,
      })

    } catch (error) {
      console.error('공휴일 등록 실패:', error)
      alert('공휴일 등록에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 모든 공휴일 일괄 등록
  const registerAllHolidays = async () => {
    if (!workspaceId || !currentUser) return

    const unregistered = koreanHolidays.filter(h => !registeredHolidayDates.has(h.date))
    if (unregistered.length === 0) {
      alert('모든 공휴일이 이미 등록되어 있습니다.')
      return
    }

    setIsLoading(true)
    try {
      for (const holiday of unregistered) {
        const dateTimestamp = new Date(holiday.date).getTime()

        await addEvent(workspaceId, {
          title: holiday.name,
          date: dateTimestamp,
          type: 'holiday',
          color: ANNUAL_LEAVE_COLOR,
          createdBy: currentUser.uid,
        })

        await createGlobalEvent(workspaceId, {
          title: holiday.name,
          startDate: startOfDay(new Date(holiday.date)).getTime(),
          endDate: endOfDay(new Date(holiday.date)).getTime(),
          color: ANNUAL_LEAVE_COLOR,
          rowIndex: 0,
          createdBy: currentUser.uid,
        })
      }
      alert(`${unregistered.length}개의 공휴일이 등록되었습니다.`)
    } catch (error) {
      console.error('공휴일 일괄 등록 실패:', error)
      alert('공휴일 등록 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 커스텀 휴일 추가
  const addCustomHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceId || !currentUser || !customHolidayName.trim() || !customHolidayDate) return

    setIsLoading(true)
    try {
      const dateTimestamp = new Date(customHolidayDate).getTime()

      await addEvent(workspaceId, {
        title: customHolidayName.trim(),
        date: dateTimestamp,
        type: 'holiday',
        color: ANNUAL_LEAVE_COLOR,
        createdBy: currentUser.uid,
      })

      await createGlobalEvent(workspaceId, {
        title: customHolidayName.trim(),
        startDate: startOfDay(new Date(customHolidayDate)).getTime(),
        endDate: endOfDay(new Date(customHolidayDate)).getTime(),
        color: ANNUAL_LEAVE_COLOR,
        rowIndex: 0,
        createdBy: currentUser.uid,
      })

      setCustomHolidayName('')
      setCustomHolidayDate('')
      alert('휴일이 등록되었습니다.')
    } catch (error) {
      console.error('커스텀 휴일 등록 실패:', error)
      alert('휴일 등록에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 등록된 공휴일 삭제
  const removeHoliday = async (eventId: string) => {
    if (!workspaceId) return

    setIsLoading(true)
    try {
      await deleteEvent(workspaceId, eventId)
    } catch (error) {
      console.error('공휴일 삭제 실패:', error)
      alert('공휴일 삭제에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 왼쪽: 공휴일 등록 */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-foreground">
              {currentYear}년 대한민국 공휴일
            </h4>
            <button
              onClick={registerAllHolidays}
              disabled={isLoading}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              전체 등록
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            공휴일을 등록하면 타임라인에 배경색이 적용됩니다.
          </p>

          <div className="space-y-1 max-h-[280px] overflow-y-auto scrollbar-thin">
            {koreanHolidays.map((holiday) => {
              const isRegistered = registeredHolidayDates.has(holiday.date)
              return (
                <div
                  key={holiday.date}
                  className={`flex items-center justify-between p-2 rounded-md text-sm ${
                    isRegistered ? 'bg-green-50 dark:bg-green-950/30' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isRegistered && <Check className="w-4 h-4 text-green-600" />}
                    <span className={isRegistered ? 'text-green-700 dark:text-green-400' : 'text-foreground'}>
                      {holiday.name}
                    </span>
                    {holiday.isSubstitute && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        대체
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(holiday.date), 'M/d')}
                    </span>
                    {!isRegistered ? (
                      <button
                        onClick={() => registerHoliday(holiday)}
                        disabled={isLoading}
                        className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        등록
                      </button>
                    ) : (
                      <span className="text-xs text-green-600">등록됨</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 커스텀 휴일 추가 */}
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-semibold text-foreground mb-3">
            커스텀 휴일 추가
          </h4>
          <form onSubmit={addCustomHoliday} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={customHolidayName}
                onChange={(e) => setCustomHolidayName(e.target.value)}
                placeholder="휴일명"
                className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <input
                type="date"
                value={customHolidayDate}
                onChange={(e) => setCustomHolidayDate(e.target.value)}
                className="px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !customHolidayName.trim() || !customHolidayDate}
              className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              휴일 추가
            </button>
          </form>
        </div>
      </div>

      {/* 오른쪽: 등록된 휴일 목록 */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-foreground">
          등록된 휴일 ({events.filter(e => e.type === 'holiday').length}개)
        </h4>

        {events.filter(e => e.type === 'holiday').length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            등록된 휴일이 없습니다.
          </p>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto scrollbar-thin">
            {events
              .filter(e => e.type === 'holiday')
              .sort((a, b) => a.date - b.date)
              .map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: event.color }} />
                    <span className="text-foreground">{event.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(event.date), 'yyyy/M/d')}
                    </span>
                    <button
                      onClick={() => removeHoliday(event.id)}
                      disabled={isLoading}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

// 프로젝트 관리 탭
function ProjectManagement() {
  const { workspaceId, projects, currentUser, members, updateProject: updateProjectLocal } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectType, setNewProjectType] = useState<ProjectType>('project')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingType, setEditingType] = useState<ProjectType>('project')
  const [selectedProjectForMembers, setSelectedProjectForMembers] = useState<string | null>(null)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [showHidden, setShowHidden] = useState(false)

  // 정렬된 프로젝트 목록 (숨김 필터 적용)
  const sortedProjects = useMemo(() => {
    let result = [...projects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    if (!showHidden) {
      result = result.filter(p => !p.isHidden)
    }
    return result
  }, [projects, showHidden])

  // 숨겨진 프로젝트 수
  const hiddenCount = projects.filter(p => p.isHidden).length

  // 프로젝트 추가
  const addNewProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceId || !currentUser || !newProjectName.trim()) return

    setIsLoading(true)
    try {
      const maxOrder = projects.length > 0
        ? Math.max(...projects.map(p => p.order ?? 0)) + 1
        : 0

      await createProject(workspaceId, {
        name: newProjectName.trim(),
        color: getRandomColor(),
        type: newProjectType,
        order: maxOrder,
        createdBy: currentUser.uid,
      })

      setNewProjectName('')
      setNewProjectType('project')
    } catch (error) {
      console.error('프로젝트 추가 실패:', error)
      alert('프로젝트 추가에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 프로젝트 삭제
  const removeProject = async (projectId: string) => {
    if (!workspaceId) return

    setIsLoading(true)
    try {
      await deleteProjectFirebase(workspaceId, projectId)
      if (selectedProjectForMembers === projectId) {
        setSelectedProjectForMembers(null)
      }
    } catch (error) {
      console.error('프로젝트 삭제 실패:', error)
      alert('프로젝트 삭제에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 프로젝트 편집 시작
  const startEditing = (projectId: string, currentName: string, currentType: ProjectType) => {
    setEditingId(projectId)
    setEditingName(currentName)
    setEditingType(currentType)
  }

  // 프로젝트 저장
  const saveProject = async () => {
    if (!workspaceId || !editingId || !editingName.trim()) {
      setEditingId(null)
      return
    }

    const updates = {
      name: editingName.trim(),
      type: editingType,
    }

    // 낙관적 업데이트: UI 즉시 반영
    updateProjectLocal(editingId, updates)
    setEditingId(null)
    setEditingName('')

    try {
      await updateProject(workspaceId, editingId, updates)
    } catch (error) {
      console.error('프로젝트 수정 실패:', error)
      alert('프로젝트 수정에 실패했습니다.')
    }
  }

  // 프로젝트 숨김 토글
  const toggleProjectHidden = async (projectId: string, isHidden: boolean) => {
    if (!workspaceId) return

    // 낙관적 업데이트
    updateProjectLocal(projectId, { isHidden: !isHidden })

    try {
      await updateProject(workspaceId, projectId, { isHidden: !isHidden })
    } catch (error) {
      console.error('프로젝트 숨김 변경 실패:', error)
      // 실패 시 원복
      updateProjectLocal(projectId, { isHidden })
    }
  }

  // 프로젝트 순서 변경
  const moveProject = async (projectId: string, direction: 'up' | 'down') => {
    if (!workspaceId) return

    const currentIndex = sortedProjects.findIndex(p => p.id === projectId)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= sortedProjects.length) return

    const currentProject = sortedProjects[currentIndex]
    const targetProject = sortedProjects[targetIndex]

    const newCurrentOrder = targetProject.order ?? targetIndex
    const newTargetOrder = currentProject.order ?? currentIndex

    // 낙관적 업데이트
    updateProjectLocal(currentProject.id, { order: newCurrentOrder })
    updateProjectLocal(targetProject.id, { order: newTargetOrder })

    try {
      await updateProject(workspaceId, currentProject.id, { order: newCurrentOrder })
      await updateProject(workspaceId, targetProject.id, { order: newTargetOrder })
    } catch (error) {
      console.error('프로젝트 순서 변경 실패:', error)
      // 실패 시 원복
      updateProjectLocal(currentProject.id, { order: currentProject.order ?? currentIndex })
      updateProjectLocal(targetProject.id, { order: targetProject.order ?? targetIndex })
    }
  }

  // 프로젝트에 구성원 추가/제거 토글
  const toggleMemberInProject = async (projectId: string, memberId: string) => {
    if (!workspaceId) return

    const project = projects.find((p) => p.id === projectId)
    if (!project) return

    const memberIds = project.memberIds || []
    const newMemberIds = memberIds.includes(memberId)
      ? memberIds.filter((id) => id !== memberId)
      : [...memberIds, memberId]

    // 낙관적 업데이트
    updateProjectLocal(projectId, { memberIds: newMemberIds })

    try {
      await updateProject(workspaceId, projectId, { memberIds: newMemberIds })
    } catch (error) {
      console.error('프로젝트 구성원 변경 실패:', error)
      // 실패 시 원복
      updateProjectLocal(projectId, { memberIds })
    }
  }

  // 선택된 프로젝트
  const selectedProject = selectedProjectForMembers
    ? projects.find((p) => p.id === selectedProjectForMembers)
    : null

  // 구성원 검색 필터링 (숨김 + 휴직중/퇴사 제외)
  const filteredMembers = useMemo(() => {
    // 숨김 구성원과 휴직중/퇴사 구성원 제외
    let result = members.filter((m) => !m.isHidden && !m.status)
    if (memberSearchQuery.trim()) {
      const query = memberSearchQuery.toLowerCase()
      result = result.filter((m) =>
        m.name.toLowerCase().includes(query) ||
        m.jobTitle?.toLowerCase().includes(query)
      )
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [members, memberSearchQuery])

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 왼쪽: 프로젝트 추가 및 목록 */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FolderKanban className="w-4 h-4" />
          프로젝트 관리
        </h4>

        {/* 프로젝트 추가 폼 */}
        <form onSubmit={addNewProject} className="space-y-3">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="프로젝트명 입력"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />

          {/* 타입 선택 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setNewProjectType('project')}
              className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                newProjectType === 'project'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              프로젝트
            </button>
            <button
              type="button"
              onClick={() => setNewProjectType('organization')}
              className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                newProjectType === 'organization'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              조직
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading || !newProjectName.trim()}
            className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" />
            추가
          </button>
        </form>

        {/* 숨김 프로젝트 표시 토글 */}
        {hiddenCount > 0 && (
          <button
            onClick={() => setShowHidden(!showHidden)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {showHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            숨김 프로젝트 {showHidden ? '숨기기' : `보기 (${hiddenCount}개)`}
          </button>
        )}

        {/* 등록된 프로젝트 목록 */}
        <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-thin">
          {sortedProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              등록된 프로젝트가 없습니다.
            </p>
          ) : (
            sortedProjects.map((project, index) => (
              <div
                key={project.id}
                className={`flex items-center justify-between p-2 rounded-md border text-sm cursor-pointer transition-colors ${
                  project.isHidden ? 'opacity-50' : ''
                } ${
                  selectedProjectForMembers === project.id
                    ? 'bg-primary/10 border-primary'
                    : 'bg-muted/50 border-border hover:border-primary/50'
                }`}
                onClick={() => setSelectedProjectForMembers(project.id)}
              >
                {editingId === project.id ? (
                  // 편집 모드
                  <div className="flex-1 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-primary rounded bg-background text-foreground focus:outline-none"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingType('project')}
                        className={`flex-1 px-2 py-1 text-xs rounded border ${
                          editingType === 'project'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border'
                        }`}
                      >
                        프로젝트
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingType('organization')}
                        className={`flex-1 px-2 py-1 text-xs rounded border ${
                          editingType === 'organization'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border'
                        }`}
                      >
                        조직
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveProject}
                        className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 text-xs bg-muted text-foreground rounded hover:bg-accent"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  // 표시 모드
                  <>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                      <span className="text-foreground truncate">{project.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        project.type === 'organization'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                      }`}>
                        {project.type === 'organization' ? '조직' : '프로젝트'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({(project.memberIds || []).length}명)
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveProject(project.id, 'up') }}
                        disabled={isLoading || index === 0}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                        title="위로 이동"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveProject(project.id, 'down') }}
                        disabled={isLoading || index === sortedProjects.length - 1}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                        title="아래로 이동"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleProjectHidden(project.id, project.isHidden) }}
                        disabled={isLoading}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        title={project.isHidden ? '표시하기' : '숨기기'}
                      >
                        {project.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditing(project.id, project.name, project.type) }}
                        disabled={isLoading}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                        title="편집"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeProject(project.id) }}
                        disabled={isLoading}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 오른쪽: 프로젝트 구성원 배정 */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-foreground">
          구성원 배정
        </h4>

        {!selectedProject ? (
          <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-md">
            왼쪽에서 프로젝트를 선택하세요
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: selectedProject.color }} />
              <span className="font-medium text-foreground">{selectedProject.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                selectedProject.type === 'organization'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
              }`}>
                {selectedProject.type === 'organization' ? '조직' : '프로젝트'}
              </span>
              <span className="text-xs text-muted-foreground">
                ({(selectedProject.memberIds || []).length}명 배정됨)
              </span>
            </div>

            {/* 구성원 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                placeholder="이름 또는 직군으로 검색..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 구성원 체크박스 목록 */}
            <div className="space-y-1 max-h-[300px] overflow-y-auto scrollbar-thin">
              {filteredMembers.map((member) => {
                const isAssigned = (selectedProject.memberIds || []).includes(member.id)
                return (
                  <label
                    key={member.id}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                      isAssigned ? 'bg-primary/10' : 'hover:bg-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      onChange={() => toggleMemberInProject(selectedProject.id, member.id)}
                      disabled={isLoading}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    {member.isLeader && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground">{member.name}</span>
                      {member.jobTitle && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                          {member.jobTitle}
                        </span>
                      )}
                    </div>
                    {member.role && (
                      <span className="text-xs text-muted-foreground">{member.role}</span>
                    )}
                  </label>
                )
              })}
              {filteredMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {memberSearchQuery ? '검색 결과가 없습니다.' : '등록된 구성원이 없습니다.'}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
