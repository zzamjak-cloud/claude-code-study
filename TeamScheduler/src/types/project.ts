// 프로젝트 타입 정의

export interface Project {
  id: string
  name: string
  color: string
  description?: string
  order: number  // 순서 (정렬용)
  createdBy: string
  createdAt: number
  updatedAt: number
}
