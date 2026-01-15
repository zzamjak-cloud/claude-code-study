// 특이사항 (공휴일, 평가 기간 등) 타입 정의

export type EventType = 'holiday' | 'evaluation' | 'release' | 'meeting' | 'custom'

export interface SpecialEvent {
  id: string
  title: string
  date: number  // timestamp
  type: EventType
  color: string
  createdBy: string
  createdAt: number
  updatedAt: number
}
