// 프로젝트 타입 정의

// 프로젝트 타입: 조직(organization) 또는 프로젝트(project)
export type ProjectType = 'organization' | 'project'

export interface Project {
  id: string
  name: string
  color: string
  description?: string
  type: ProjectType  // 조직 또는 프로젝트
  memberIds: string[]  // 프로젝트에 참여하는 구성원 ID 배열
  memberOrder?: string[]  // 프로젝트 내 구성원 표시 순서 (구성원 ID 배열, 순서대로)
  isHidden: boolean  // 숨김 여부 (종료된 프로젝트)
  order: number  // 순서 (정렬용)
  createdBy: string
  createdAt: number
  updatedAt: number
}
