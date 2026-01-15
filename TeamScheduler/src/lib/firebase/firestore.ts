// Firestore 헬퍼 함수

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './config'
import { Schedule } from '../../types/schedule'
import { TeamMember } from '../../types/team'
import { SpecialEvent } from '../../types/event'

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

/**
 * 팀원 추가
 */
export const addTeamMember = async (
  workspaceId: string,
  member: Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>
) => {
  const ref = doc(collection(db, `teams/${workspaceId}/members`))
  await setDoc(ref, {
    ...member,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * 팀원 업데이트
 */
export const updateTeamMember = async (
  workspaceId: string,
  memberId: string,
  updates: Partial<TeamMember>
) => {
  const ref = doc(db, `teams/${workspaceId}/members/${memberId}`)
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

/**
 * 팀원 삭제
 */
export const deleteTeamMember = async (
  workspaceId: string,
  memberId: string
) => {
  const ref = doc(db, `teams/${workspaceId}/members/${memberId}`)
  await deleteDoc(ref)
}

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
 * Timestamp를 number로 변환
 */
export const timestampToNumber = (timestamp: Timestamp | number): number => {
  if (typeof timestamp === 'number') return timestamp
  return timestamp.toMillis()
}
