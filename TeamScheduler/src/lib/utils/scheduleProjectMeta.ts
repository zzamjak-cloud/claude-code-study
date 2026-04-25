// 일정 카드의 조직/프로젝트 표시용 메타 (주간 보기 등)
// 조직명(예: Seed, F1)과 "Seed : {프로젝트명}" 형태 프로젝트를 한 그룹으로 표시

import type { Project } from '../../types/project'

export interface ScheduleProjectMeta {
  /** 카드 상단 표시 텍스트 */
  displayText: string
  /** 단순 이름 표기(회색 박스) 여부 */
  isPlainName: boolean
  /** 툴팁용 전체 프로젝트·조직 이름 */
  tooltip?: string
}

/** schedule.projectId 표시 메타: 드롭다운 이름 그대로 표시 */
export function getScheduleProjectMeta(
  projectId: string | undefined,
  projects: Project[]
): ScheduleProjectMeta {
  if (!projectId) {
    return { displayText: '미지정', isPlainName: true, tooltip: undefined }
  }
  const p = projects.find((x) => x.id === projectId)
  if (!p) {
    return { displayText: '알 수 없음', isPlainName: true, tooltip: undefined }
  }
  const full = (p.name || '').trim()

  // 조직/프로젝트 구분 없이 드롭다운에 보이는 이름 그대로 표시
  return { displayText: full || '미지정', isPlainName: true, tooltip: full || undefined }
}
