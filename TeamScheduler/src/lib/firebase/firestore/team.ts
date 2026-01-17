// 팀원 Firestore CRUD 함수

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config'
import { TeamMember } from '../../../types/team'

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
