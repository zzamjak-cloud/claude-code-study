// 팀원 타입 정의

export interface TeamMember {
  id: string
  name: string
  email?: string
  profileImage?: string
  role: string
  color: string
  isHidden: boolean
  order: number
  rowCount?: number  // 팀원별 행 개수
  memo?: string  // 팀원별 메모 (향후 일정 후보 메모용)
  createdAt: number
  updatedAt: number
}

export interface Workspace {
  id: string
  name: string
  ownerId: string  // 단일 관리자
  createdAt: number
  updatedAt: number
}
