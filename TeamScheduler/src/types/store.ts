// 스토어 통합 타입 정의

// Auth 사용자 타입
export interface User {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

// 스토어 상태 타입은 각 슬라이스에서 정의
