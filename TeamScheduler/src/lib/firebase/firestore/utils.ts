// Firestore 유틸리티 함수

import { Timestamp } from 'firebase/firestore'

/**
 * Timestamp를 number로 변환
 */
export const timestampToNumber = (timestamp: Timestamp | number): number => {
  if (typeof timestamp === 'number') return timestamp
  return timestamp.toMillis()
}
