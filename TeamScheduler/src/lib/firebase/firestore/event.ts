// 특이사항 Firestore CRUD 함수

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config'
import { SpecialEvent } from '../../../types/event'

/**
 * 특이사항 추가
 */
export const addEvent = async (
  workspaceId: string,
  event: Omit<SpecialEvent, 'id' | 'createdAt' | 'updatedAt'>
) => {
  const ref = doc(collection(db, `events/${workspaceId}/items`))
  await setDoc(ref, {
    ...event,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * 특이사항 업데이트
 */
export const updateEvent = async (
  workspaceId: string,
  eventId: string,
  updates: Partial<SpecialEvent>
) => {
  const ref = doc(db, `events/${workspaceId}/items/${eventId}`)
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

/**
 * 특이사항 삭제
 */
export const deleteEvent = async (
  workspaceId: string,
  eventId: string
) => {
  const ref = doc(db, `events/${workspaceId}/items/${eventId}`)
  await deleteDoc(ref)
}

/**
 * 특이사항 일괄 추가 (배치 쓰기)
 * 여러 특이사항을 한 번에 추가하여 Firebase 쓰기 비용 절감
 * 공휴일 일괄 등록 등에 사용
 */
export const batchAddEvents = async (
  workspaceId: string,
  events: Array<Omit<SpecialEvent, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<string[]> => {
  if (events.length === 0) return []

  const { writeBatch } = await import('firebase/firestore')
  const batch = writeBatch(db)
  const eventIds: string[] = []

  for (const event of events) {
    const ref = doc(collection(db, `events/${workspaceId}/items`))
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
