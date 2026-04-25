// 일정 카드의 조직/프로젝트 표시용 메타 (주간 보기 등)
// 조직명(예: Seed, F1)과 "Seed : {프로젝트명}" 형태 프로젝트를 한 그룹으로 표시

import type { Project } from '../../types/project'

export interface ScheduleProjectMeta {
  /** UI 뱃지: 통합 시 조직명(Seed, F1) / 그 외 조직·프로젝트·미지정 등 */
  categoryLabel: string
  /** 부가 표시: 통합 시 프로젝트명만(콜론 뒤) 또는 전체 이름 */
  displayName: string
  /** 툴팁용 전체 프로젝트·조직 이름 */
  tooltip?: string
}

/** 프로젝트 이름이 `조직명 : …` 패턴이면 콜론 뒤 문자열, 아니면 null */
function suffixAfterOrgPrefix(projectName: string, orgName: string): string | null {
  const p = projectName.trim()
  const o = orgName.trim()
  if (!o || p.length < o.length + 1) return null
  const spaced = `${o} : `
  if (p.startsWith(spaced)) {
    return p.slice(spaced.length).trim()
  }
  const tight = `${o}:`
  if (p.startsWith(tight)) {
    return p.slice(tight.length).replace(/^\s+/, '').replace(/^:\s*/, '').trim()
  }
  return null
}

/**
 * schedule.projectId 로 표시 메타를 반환합니다.
 * type=organization 인 항목 이름(Seed, F1 등)과 동일 접두의 "이름 : 프로젝트" 프로젝트는
 * 뱃지에 조직명만, displayName에는 콜론 뒤(프로젝트명)만 넣어 하나의 그룹으로 봅니다.
 */
export function getScheduleProjectMeta(
  projectId: string | undefined,
  projects: Project[]
): ScheduleProjectMeta {
  if (!projectId) {
    return { categoryLabel: '미지정', displayName: '', tooltip: undefined }
  }
  const p = projects.find((x) => x.id === projectId)
  if (!p) {
    return { categoryLabel: '알 수 없음', displayName: '', tooltip: undefined }
  }
  const full = (p.name || '').trim()

  const orgs = projects
    .filter((o) => o.type === 'organization' && (o.name || '').trim())
    .sort((a, b) => (b.name || '').length - (a.name || '').length)

  if (p.type === 'organization') {
    return { categoryLabel: full, displayName: '', tooltip: full || undefined }
  }

  for (const org of orgs) {
    const on = (org.name || '').trim()
    if (!on) continue
    const rest = suffixAfterOrgPrefix(full, on)
    if (rest !== null) {
      return {
        categoryLabel: on,
        displayName: rest || full,
        tooltip: full || undefined,
      }
    }
    if (full === on) {
      return { categoryLabel: on, displayName: '', tooltip: full || undefined }
    }
  }

  return { categoryLabel: '프로젝트', displayName: full, tooltip: full || undefined }
}
