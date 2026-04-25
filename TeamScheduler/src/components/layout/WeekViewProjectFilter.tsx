// 주간 보기 — 업무 카드용 조직/프로젝트 선택 (헤더 컨텍스트와 별도로 좁힘)

import { useMemo } from 'react'
import { FolderKanban } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { Project } from '../../types/project'

export function WeekViewProjectFilter() {
  const { projects, weekViewScheduleProjectId, setWeekViewScheduleProjectId } = useAppStore()

  const { projectRows, orgRows } = useMemo(() => {
    const visible = projects.filter((p) => !p.isHidden)
    const byName = (a: Project, b: Project) => a.name.localeCompare(b.name, 'ko')
    const projectRows = visible.filter((p) => p.type === 'project' || !p.type).sort(byName)
    const orgRows = visible.filter((p) => p.type === 'organization').sort(byName)
    return { projectRows, orgRows }
  }, [projects])

  if (projectRows.length === 0 && orgRows.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="week-view-project-filter" className="sr-only">
        주간 업무 프로젝트 필터
      </label>
      <FolderKanban className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" aria-hidden />
      <select
        id="week-view-project-filter"
        value={weekViewScheduleProjectId ?? ''}
        onChange={(e) => {
          const v = e.target.value
          setWeekViewScheduleProjectId(v === '' ? null : v)
        }}
        className="px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-w-[160px] max-w-[240px]"
        title="선택한 조직·프로젝트에 태그된 주간 업무만 표시합니다"
      >
        <option value="">전체 (필터 없음)</option>
        {projectRows.length > 0 && (
          <optgroup label="프로젝트">
            {projectRows.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
        {orgRows.length > 0 && (
          <optgroup label="조직">
            {orgRows.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  )
}
