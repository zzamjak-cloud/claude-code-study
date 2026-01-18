// 최고 관리자 타입 정의

export interface SuperAdmin {
  id: string
  name: string
  email: string
  isPrimary: boolean  // 최초 관리자 여부 (삭제 불가)
  createdAt: number
  createdBy: string
}

// 최고 관리자 생성 입력
export interface CreateSuperAdminInput {
  name: string
  email: string
}
