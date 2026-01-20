// 프로젝트 관리 탭 컴포넌트

import { useState, useMemo } from 'react'
import { Plus, Trash2, Pencil, ChevronUp, ChevronDown, Eye, EyeOff, FolderKanban, Search, Crown } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { createProject, updateProject, deleteProject as deleteProjectFirebase } from '../../../lib/firebase/firestore'
import { ProjectType } from '../../../types/project'

// 랜덤 색상 생성
const getRandomColor = () => {
  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

export function ProjectManagement() {
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

    // 프로젝트 이름 중복 검사
    const trimmedName = newProjectName.trim()
    const duplicateProject = projects.find(
      (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
    )
    if (duplicateProject) {
      alert(`"${trimmedName}" 이름의 프로젝트가 이미 존재합니다.`)
      return
    }

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
    <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
      {/* 왼쪽: 프로젝트 추가 및 목록 */}
      <div className="flex flex-col space-y-4 h-full overflow-hidden">
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

        {/* 등록된 프로젝트 목록 (flex-1로 남은 공간 채움) */}
        <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin min-h-0">
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
      <div className="flex flex-col space-y-4 h-full overflow-hidden">
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

            {/* 구성원 체크박스 목록 (flex-1로 남은 공간 채움) */}
            <div className="flex-1 space-y-1 overflow-y-auto scrollbar-thin min-h-0">
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

export default ProjectManagement
