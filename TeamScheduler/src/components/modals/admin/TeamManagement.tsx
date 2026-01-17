// 구성원 관리 탭 컴포넌트

import { useState, useMemo } from 'react'
import { Plus, Users, Check, Trash2, Pencil, Filter, Search, Crown, X, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { addTeamMember, updateTeamMember, deleteTeamMember } from '../../../lib/firebase/firestore'
import { ConfirmDialog } from '../../common/ConfirmDialog'
import { MemberStatus } from '../../../types/team'

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

export function TeamManagement() {
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

export default TeamManagement
