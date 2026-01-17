// 공지사항 타입 정의

export interface Announcement {
  id: string
  projectId?: string  // 프로젝트 ID (없으면 전역 공지사항)
  content: string
  createdBy: string
  createdAt: number
  updatedAt: number
}
