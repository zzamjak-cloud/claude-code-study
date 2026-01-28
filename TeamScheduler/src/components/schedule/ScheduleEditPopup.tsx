// 일정 카드 편집 팝업

import { useState, useRef, useEffect, useMemo } from 'react'
import { X, FolderKanban } from 'lucide-react'
import { Project } from '../../types/project'
import { useAppStore } from '../../store/useAppStore'

interface ScheduleEditPopupProps {
  title: string
  comment?: string
  link?: string
  projectId?: string
  projects?: Project[]
  position: { x: number; y: number }
  onSave: (title: string, comment: string, link: string, projectId?: string) => void
  onCancel: () => void
}

export function ScheduleEditPopup({
  title,
  comment = '',
  link = '',
  projectId = '',
  projects = [],
  position,
  onSave,
  onCancel,
}: ScheduleEditPopupProps) {
  const { lastSelectedProjectId, setLastSelectedProjectId } = useAppStore()

  const [titleValue, setTitleValue] = useState(title)
  const [commentValue, setCommentValue] = useState(comment)
  const [linkValue, setLinkValue] = useState(link)
  // 기존 projectId가 있으면 사용, 없으면 lastSelectedProjectId 사용
  const [projectIdValue, setProjectIdValue] = useState(projectId || lastSelectedProjectId || '')

  // 프로젝트 정렬 및 필터링: 숨김 제외, 프로젝트 타입 먼저 → 조직 타입
  const sortedProjects = useMemo(() => {
    // 숨김 프로젝트 제외
    const visible = projects.filter(p => !p.isHidden)
    // 프로젝트 타입과 조직 타입 분리
    const projectType = visible.filter(p => p.type === 'project' || !p.type)
    const orgType = visible.filter(p => p.type === 'organization')
    return { projectType, orgType }
  }, [projects])

  const titleRef = useRef<HTMLInputElement>(null)
  const commentRef = useRef<HTMLInputElement>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // 포커스 및 선택
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.focus()
      titleRef.current.select()
    }
  }, [])

  // 외부 클릭 시 저장
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        handleSave()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [titleValue, commentValue, linkValue, projectIdValue])

  // Enter 키로 저장, Escape 키로 취소
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      // 현재 입력 필드의 최신 값으로 저장
      if (projectIdValue) {
        setLastSelectedProjectId(projectIdValue)
      }
      onSave(titleValue, commentValue, linkValue, projectIdValue || undefined)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    } else if (e.key === 'Tab') {
      // 탭 키로 다음 필드로 이동
      e.preventDefault()
      if (e.currentTarget === titleRef.current) {
        commentRef.current?.focus()
      } else if (e.currentTarget === commentRef.current) {
        linkRef.current?.focus()
      } else if (e.currentTarget === linkRef.current) {
        titleRef.current?.focus()
      }
    }
  }

  const handleSave = () => {
    // 마지막 선택한 프로젝트 기억
    if (projectIdValue) {
      setLastSelectedProjectId(projectIdValue)
    }
    onSave(titleValue, commentValue, linkValue, projectIdValue || undefined)
  }

  return (
    <div
      ref={popupRef}
      className="fixed bg-card border-2 border-primary rounded-lg shadow-xl p-4 z-[200] min-w-[300px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">일정 편집</h3>
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 프로젝트 */}
      {(sortedProjects.projectType.length > 0 || sortedProjects.orgType.length > 0) && (
        <div className="mb-2">
          <label className="block text-xs text-muted-foreground mb-1">
            <FolderKanban className="w-3 h-3 inline mr-1" />
            프로젝트
          </label>
          <select
            value={projectIdValue}
            onChange={(e) => setProjectIdValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">프로젝트 선택 안함</option>
            {/* 프로젝트 타입 먼저 */}
            {sortedProjects.projectType.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
            {/* 구분선 (프로젝트와 조직이 모두 있을 때만) */}
            {sortedProjects.projectType.length > 0 && sortedProjects.orgType.length > 0 && (
              <option disabled>───────────</option>
            )}
            {/* 조직 타입 */}
            {sortedProjects.orgType.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 일정 제목 */}
      <div className="mb-2">
        <label className="block text-xs text-muted-foreground mb-1">일정</label>
        <input
          ref={titleRef}
          type="text"
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="일정 제목"
          className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* 코멘트 */}
      <div className="mb-2">
        <label className="block text-xs text-muted-foreground mb-1">코멘트</label>
        <input
          ref={commentRef}
          type="text"
          value={commentValue}
          onChange={(e) => setCommentValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="추가 설명"
          className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* 링크 */}
      <div className="mb-3">
        <label className="block text-xs text-muted-foreground mb-1">링크</label>
        <input
          ref={linkRef}
          type="text"
          value={linkValue}
          onChange={(e) => setLinkValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://..."
          className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* 버튼 */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded bg-muted hover:bg-accent text-foreground transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-sm rounded bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
        >
          저장
        </button>
      </div>
    </div>
  )
}
