// 일정 Firestore CRUD 함수

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config'
import { Schedule } from '../../../types/schedule'

/**
 * 일정 생성
 */
export const createSchedule = async (
  workspaceId: string,
  schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>
) => {
  const ref = doc(collection(db, `schedules/${workspaceId}/items`))
  await setDoc(ref, {
    ...schedule,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * 일정 업데이트
 */
export const updateSchedule = async (
  workspaceId: string,
  scheduleId: string,
  updates: Partial<Schedule>
) => {
  const ref = doc(db, `schedules/${workspaceId}/items/${scheduleId}`)
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

/**
 * 일정 삭제
 */
export const deleteSchedule = async (
  workspaceId: string,
  scheduleId: string
) => {
  const ref = doc(db, `schedules/${workspaceId}/items/${scheduleId}`)
  await deleteDoc(ref)
}
