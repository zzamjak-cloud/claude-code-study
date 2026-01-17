// 글로벌 특이사항 타입 정의

export interface GlobalEvent {
  id: string
  title: string
  comment?: string
  link?: string
  startDate: number
  endDate: number
  color: string
  textColor?: string
  rowIndex: number
  createdBy: string
  createdAt: number
  updatedAt: number
}

// 글로벌 이벤트 설정 (행 개수 등)
export interface GlobalEventSettings {
  rowCount: number
}
