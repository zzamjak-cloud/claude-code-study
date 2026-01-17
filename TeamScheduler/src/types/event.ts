// 특이사항 (공휴일, 평가 기간 등) 타입 정의

export type EventType = 'holiday' | 'evaluation' | 'release' | 'meeting' | 'custom'

export interface SpecialEvent {
  id: string
  projectId?: string  // 프로젝트 ID (없으면 전역 특이사항)
  title: string
  date: number  // timestamp
  type: EventType
  color: string
  createdBy: string
  createdAt: number
  updatedAt: number
}
