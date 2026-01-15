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
