// 구성원 타입 정의

// 구성원 상태 타입 (없음 = 재직중, leave = 휴직중, resigned = 퇴사)
export type MemberStatus = 'leave' | 'resigned' | undefined

export interface TeamMember {
  id: string
  name: string
  email?: string  // 이메일 (서브 관리자 매칭용)
  profileImage?: string
  jobTitle: string  // 직군 (예: 기획, 개발, 디자인, QA 등)
  role: string  // 역할 (예: 리드, 담당자 등)
  isLeader: boolean  // 리더 여부 (팀장/서브 관리자)
  status?: MemberStatus  // 상태 (undefined = 재직중, leave = 휴직중, resigned = 퇴사)
  color: string
  isHidden: boolean
  order: number
  rowCount?: number  // 구성원별 행 개수
  memo?: string  // 구성원별 메모 (향후 일정 후보 메모용)
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
