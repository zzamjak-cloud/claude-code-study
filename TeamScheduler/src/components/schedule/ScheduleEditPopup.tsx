// 일정 카드 편집 팝업

import { useState, useRef, useEffect, useMemo } from 'react'
import { X, FolderKanban } from 'lucide-react'
import { addDays, format, startOfDay } from 'date-fns'
import { Project } from '../../types/project'
import { TeamMember } from '../../types/team'
import { useAppStore } from '../../store/useAppStore'

interface ScheduleEditPopupProps {
  title: string
  comment?: string
  link?: string
  projectId?: string
  memberId?: string
  members?: TeamMember[]
  startDate?: number
  endDate?: number
  projects?: Project[]
  position: { x: number; y: number }
  onSave: (
    title: string,
    comment: string,
    link: string,
    projectId?: string,
    startDate?: number,
    endDate?: number,
    memberId?: string
  ) => void
  onCancel: () => void
  onDelete?: () => void
}

function toDateInputValue(timestamp?: number, inclusiveEnd = false): string {
  if (!timestamp) return ''
  const source = inclusiveEnd ? new Date(timestamp - 1) : new Date(timestamp)
  return format(startOfDay(source), 'yyyy-MM-dd')
}

function parseDateInputValue(value: string): number | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return startOfDay(parsed).getTime()
}

export function ScheduleEditPopup({
  title,
  comment = '',
  link = '',
  projectId = '',
  memberId,
  members = [],
  startDate,
  endDate,
  projects = [],
  position,
  onSave,
  onCancel,
  onDelete,
}: ScheduleEditPopupProps) {
  const { lastSelectedProjectId, setLastSelectedProjectId } = useAppStore()

  const [titleValue, setTitleValue] = useState(title)
  const [commentValue, setCommentValue] = useState(comment)
  const [linkValue, setLinkValue] = useState(link)
  const [startDateValue, setStartDateValue] = useState(toDateInputValue(startDate))
  const [endDateValue, setEndDateValue] = useState(toDateInputValue(endDate, true))
  const initialMemberName = memberId ? members.find((m) => m.id === memberId)?.name || '' : ''
  const [memberIdValue, setMemberIdValue] = useState(memberId || '')
  const [workerQuery, setWorkerQuery] = useState(initialMemberName)
  const [workerHighlightIndex, setWorkerHighlightIndex] = useState(-1)
  const [showWorkerSuggest, setShowWorkerSuggest] = useState(false)
  // 기존 projectId가 있으면 사용, 없으면 lastSelectedProjectId 사용
  const [projectIdValue, setProjectIdValue] = useState(projectId || lastSelectedProjectId || '')

  // 프로젝트 정렬 및 필터링: 숨김 제외, 그룹별 알파벳순 정렬
  const sortedProjects = useMemo(() => {
    const visible = projects.filter(p => !p.isHidden)
    const alphabetSort = (a: Project, b: Project) => a.name.localeCompare(b.name, 'ko')
    const projectType = visible.filter(p => p.type === 'project' || !p.type).sort(alphabetSort)
    const orgType = visible.filter(p => p.type === 'organization').sort(alphabetSort)
    return { projectType, orgType }
  }, [projects])

  const titleRef = useRef<HTMLInputElement>(null)
  const commentRef = useRef<HTMLInputElement>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const workerRef = useRef<HTMLInputElement>(null)
  const workerSuggestRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const workerCandidates = useMemo(() => {
    const q = workerQuery.trim()
    const visible = members.filter((m) => !m.isHidden)
    if (!q) return visible.slice(0, 8)
    return visible
      .filter((m) => m.name.startsWith(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      .slice(0, 8)
  }, [members, workerQuery])

  useEffect(() => {
    if (!showWorkerSuggest) return
    if (workerHighlightIndex < 0) return
    const container = workerSuggestRef.current
    if (!container) return
    const selectedEl = container.querySelector<HTMLElement>(`[data-worker-idx="${workerHighlightIndex}"]`)
    selectedEl?.scrollIntoView({ block: 'nearest' })
  }, [showWorkerSuggest, workerHighlightIndex])


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
  }, [titleValue, commentValue, linkValue, projectIdValue, startDateValue, endDateValue, memberIdValue])

  // Enter 키로 저장, Escape 키로 취소
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      // 현재 입력 필드의 최신 값으로 저장
      if (projectIdValue) {
        setLastSelectedProjectId(projectIdValue)
      }
      const parsedStartDate = parseDateInputValue(startDateValue)
      const parsedEndDate = parseDateInputValue(endDateValue)
      if ((startDateValue && parsedStartDate === null) || (endDateValue && parsedEndDate === null)) return
      if (parsedStartDate !== null && parsedEndDate !== null && parsedStartDate > parsedEndDate) {
        window.alert('종료일은 시작일보다 빠를 수 없습니다.')
        return
      }
      const normalizedStartDate = parsedStartDate ?? undefined
      const normalizedEndDate =
        parsedEndDate !== null ? addDays(new Date(parsedEndDate), 1).getTime() : undefined
      onSave(
        titleValue,
        commentValue,
        linkValue,
        projectIdValue || undefined,
        normalizedStartDate,
        normalizedEndDate,
        memberIdValue || undefined
      )
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
    const parsedStartDate = parseDateInputValue(startDateValue)
    const parsedEndDate = parseDateInputValue(endDateValue)
    if ((startDateValue && parsedStartDate === null) || (endDateValue && parsedEndDate === null)) return
    if (parsedStartDate !== null && parsedEndDate !== null && parsedStartDate > parsedEndDate) {
      window.alert('종료일은 시작일보다 빠를 수 없습니다.')
      return
    }
    const normalizedStartDate = parsedStartDate ?? undefined
    const normalizedEndDate = parsedEndDate !== null ? addDays(new Date(parsedEndDate), 1).getTime() : undefined
    onSave(
      titleValue,
      commentValue,
      linkValue,
      projectIdValue || undefined,
      normalizedStartDate,
      normalizedEndDate,
      memberIdValue || undefined
    )
  }

  return (
    <div
      ref={popupRef}
      className="fixed bg-card border-2 border-primary rounded-lg shadow-xl p-4 z-[200] min-w-[300px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={(e) => e.stopPropagation()}
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
            조직 · 프로젝트
          </label>
          <select
            value={projectIdValue}
            onChange={(e) => setProjectIdValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">조직/프로젝트 선택 안함</option>
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

      {/* 작업자 */}
      {members.length > 0 && (
        <div className="mb-2 relative">
          <label className="block text-xs text-muted-foreground mb-1">작업자</label>
          <input
            ref={workerRef}
            type="text"
            value={workerQuery}
            onChange={(e) => {
              setWorkerQuery(e.target.value)
              setShowWorkerSuggest(true)
              setWorkerHighlightIndex(0)
              if (!e.target.value.trim()) {
                setMemberIdValue('')
              }
            }}
            onFocus={() => setShowWorkerSuggest(true)}
            onKeyDown={(e) => {
              if (!showWorkerSuggest || workerCandidates.length === 0) {
                handleKeyDown(e)
                return
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setWorkerHighlightIndex((idx) => Math.min(workerCandidates.length - 1, idx + 1))
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setWorkerHighlightIndex((idx) => Math.max(0, idx - 1))
                return
              }
              if (e.key === 'Enter') {
                const picked = workerCandidates[Math.max(0, workerHighlightIndex)]
                if (picked) {
                  e.preventDefault()
                  setMemberIdValue(picked.id)
                  setWorkerQuery(picked.name)
                  setShowWorkerSuggest(false)
                }
                return
              }
              handleKeyDown(e)
            }}
            placeholder="작업자 이름 검색"
            className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {showWorkerSuggest && workerCandidates.length > 0 && (
            <div
              ref={workerSuggestRef}
              className="absolute left-0 right-0 top-[calc(100%+2px)] z-[260] rounded border border-border bg-card shadow-lg max-h-40 overflow-auto"
            >
              {workerCandidates.map((m, idx) => (
                <button
                  type="button"
                  key={m.id}
                  data-worker-idx={idx}
                  className={`w-full text-left px-2 py-1.5 text-sm hover:bg-accent transition-colors ${
                    idx === workerHighlightIndex
                      ? 'bg-primary/15 border-l-2 border-primary text-foreground font-semibold'
                      : 'border-l-2 border-transparent'
                  }`}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    setMemberIdValue(m.id)
                    setWorkerQuery(m.name)
                    setShowWorkerSuggest(false)
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* 시작일 / 종료일 */}
      {startDate !== undefined && endDate !== undefined && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">시작일</label>
            <input
              type="date"
              value={startDateValue}
              onChange={(e) => setStartDateValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">종료일</label>
            <input
              type="date"
              value={endDateValue}
              onChange={(e) => setEndDateValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex gap-2 justify-end">
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-sm rounded bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors mr-auto"
          >
            삭제
          </button>
        )}
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
