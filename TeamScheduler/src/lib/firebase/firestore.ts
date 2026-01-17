// Firestore 헬퍼 함수

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './config'
import { Schedule } from '../../types/schedule'
import { TeamMember } from '../../types/team'
import { SpecialEvent } from '../../types/event'
import { GlobalEvent } from '../../types/globalEvent'

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
 * 구성원 추가
 */
export const addTeamMember = async (
  workspaceId: string,
  member: Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>
) => {
  const ref = doc(collection(db, `teams/${workspaceId}/members`))
  await setDoc(ref, {
    ...member,
    email: member.email || '',
    jobTitle: member.jobTitle || '',
    role: member.role || '',
    isLeader: member.isLeader || false,
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

  // undefined 값을 deleteField()로 변환 (Firebase는 undefined를 지원하지 않음)
  const cleanedUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() }
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      cleanedUpdates[key] = deleteField()
    } else {
      cleanedUpdates[key] = value
    }
  }

  await updateDoc(ref, cleanedUpdates)
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

/**
 * 전역 공지사항 업데이트 (워크스페이스 전체)
 */
export const updateGlobalAnnouncement = async (
  workspaceId: string,
  content: string,
  userId: string
) => {
  const ref = doc(db, `announcements/${workspaceId}`)
  await setDoc(ref, {
    content,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

/**
 * 공지사항 업데이트 (프로젝트별)
 */
export const updateAnnouncement = async (
  workspaceId: string,
  projectId: string,
  content: string,
  userId: string
) => {
  // 프로젝트별 공지사항: announcements/{workspaceId}/projects/{projectId}
  const ref = doc(db, `announcements/${workspaceId}/projects/${projectId}`)
  await setDoc(ref, {
    projectId,
    content,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

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

/**
 * 프로젝트 생성
 */
export const createProject = async (
  workspaceId: string,
  project: {
    name: string
    color: string
    type: 'organization' | 'project'
    description?: string
    memberIds?: string[]
    order: number
    createdBy: string
  }
) => {
  const ref = doc(collection(db, `projects/${workspaceId}/items`))
  await setDoc(ref, {
    ...project,
    memberIds: project.memberIds || [],
    isHidden: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * 프로젝트 업데이트
 */
export const updateProject = async (
  workspaceId: string,
  projectId: string,
  updates: {
    name?: string
    color?: string
    type?: 'organization' | 'project'
    description?: string
    memberIds?: string[]
    isHidden?: boolean
    order?: number
  }
) => {
  const ref = doc(db, `projects/${workspaceId}/items/${projectId}`)
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

/**
 * 프로젝트 삭제
 */
export const deleteProject = async (
  workspaceId: string,
  projectId: string
) => {
  const ref = doc(db, `projects/${workspaceId}/items/${projectId}`)
  await deleteDoc(ref)
}
