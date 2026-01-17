// 일정 타입 정의

export interface Schedule {
  id: string
  memberId: string
  title: string
  comment?: string   // 코멘트
  startDate: number  // timestamp
  endDate: number    // timestamp
  color: string
  textColor?: string
  link?: string
  projectId?: string // 프로젝트 ID
  rowIndex: number   // 행 인덱스 (같은 날짜에 여러 일정)
  createdBy: string
  createdAt: number
  updatedAt: number
}

// UI 계산용 (픽셀 위치)
export interface SchedulePosition {
  x: number      // 좌측 픽셀
  width: number  // 너비 픽셀
  rowIndex: number // 통합 탭에서의 행 인덱스
}
