// 일정 타입 정의

export interface Schedule {
  id: string
  memberId: string
  title: string
  startDate: number  // timestamp
  endDate: number    // timestamp
  color: string
  textColor?: string
  link?: string
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
