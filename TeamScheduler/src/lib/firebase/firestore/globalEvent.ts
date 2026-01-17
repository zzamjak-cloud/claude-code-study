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
 * 글로벌 이벤트 설정 업데이트 (행 개수 등)
 */
export const updateGlobalEventSettings = async (
  workspaceId: string,
  settings: { rowCount: number }
) => {
  // Firestore 문서 참조는 짝수 세그먼트 필요: globalEventSettings/{workspaceId}
  const ref = doc(db, `globalEventSettings/${workspaceId}`)
  await setDoc(ref, {
    ...settings,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}
