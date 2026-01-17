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
