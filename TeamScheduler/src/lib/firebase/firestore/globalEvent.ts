// 글로벌 이벤트 Firestore CRUD 함수

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config'
import { GlobalEvent } from '../../../types/globalEvent'

/**
 * 글로벌 이벤트 생성
 */
export const createGlobalEvent = async (
  workspaceId: string,
  event: Omit<GlobalEvent, 'id' | 'createdAt' | 'updatedAt'>
) => {
  const ref = doc(collection(db, `globalEvents/${workspaceId}/items`))
  await setDoc(ref, {
    ...event,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * 글로벌 이벤트 업데이트
 */
export const updateGlobalEvent = async (
  workspaceId: string,
  eventId: string,
  updates: Partial<GlobalEvent>
) => {
  const ref = doc(db, `globalEvents/${workspaceId}/items/${eventId}`)
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

/**
 * 글로벌 이벤트 삭제
 */
export const deleteGlobalEvent = async (
  workspaceId: string,
  eventId: string
) => {
  const ref = doc(db, `globalEvents/${workspaceId}/items/${eventId}`)
  await deleteDoc(ref)
}

/**
 * 글로벌 이벤트 설정 업데이트 (프로젝트별 행 개수)
 * @param workspaceId - 워크스페이스 ID
 * @param projectId - 프로젝트 ID (null이면 'default')
 * @param rowCount - 행 개수
 */
export const updateGlobalEventSettings = async (
  workspaceId: string,
  settings: { rowCount: number; projectId?: string | null }
) => {
  // Firestore 문서 참조는 짝수 세그먼트 필요: globalEventSettings/{workspaceId}
  const ref = doc(db, `globalEventSettings/${workspaceId}`)
  const key = settings.projectId || 'default'

  await setDoc(ref, {
    rowCounts: {
      [key]: settings.rowCount,
    },
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

/**
 * 글로벌 이벤트 일괄 추가 (배치 쓰기)
 * 여러 글로벌 이벤트를 한 번에 추가하여 Firebase 쓰기 비용 절감
 * 공휴일 일괄 등록 등에 사용
 */
export const batchCreateGlobalEvents = async (
  workspaceId: string,
  events: Array<Omit<GlobalEvent, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<string[]> => {
  if (events.length === 0) return []

  const { writeBatch } = await import('firebase/firestore')
  const batch = writeBatch(db)
  const eventIds: string[] = []

  for (const event of events) {
    const ref = doc(collection(db, `globalEvents/${workspaceId}/items`))
    eventIds.push(ref.id)

    batch.set(ref, {
      ...event,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  await batch.commit()
  return eventIds
}
