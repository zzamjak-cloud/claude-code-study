// 글로벌 공지 타입 정의

export interface GlobalNotice {
  id: string
  content: string      // 공지 내용 (한 줄)
  order: number        // 순서
  isActive: boolean    // 활성화 여부
  createdBy: string    // 생성자 UID
  createdAt: number
  updatedAt: number
}
