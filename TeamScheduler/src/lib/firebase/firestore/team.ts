// 팀원 Firestore CRUD 함수

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../config'
import { TeamMember } from '../../../types/team'

/**
 * 팀원 목록 조회 (일회성 조회)
 * 실시간 동기화 대신 사용하여 Firebase 읽기 비용 절감
 */
export const fetchTeamMembers = async (workspaceId: string): Promise<TeamMember[]> => {
  const membersQuery = query(
    collection(db, `teams/${workspaceId}/members`),
    orderBy('order', 'asc')
  )

  const snapshot = await getDocs(membersQuery)

  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      name: data.name,
      email: data.email || '',
      profileImage: data.profileImage,
      jobTitle: data.jobTitle || '',
      role: data.role || '',
      isLeader: data.isLeader || false,
      status: data.status,
      color: data.color,
      isHidden: data.isHidden || false,
      order: data.order || 0,
      rowCount: data.rowCount || 1,
      memo: data.memo || '',
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toMillis()
          : data.createdAt || Date.now(),
      updatedAt:
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toMillis()
          : data.updatedAt || Date.now(),
    } as TeamMember
  })
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
 * 팀원 순서 일괄 업데이트 (배치 쓰기)
 * 여러 팀원의 order 필드를 한 번에 업데이트하여 Firebase 쓰기 비용 절감
 */
export const batchReorderTeamMembers = async (
  workspaceId: string,
  memberOrders: Array<{ memberId: string; order: number }>
): Promise<void> => {
  if (memberOrders.length === 0) return

  const { writeBatch } = await import('firebase/firestore')
  const batch = writeBatch(db)

  for (const { memberId, order } of memberOrders) {
    const ref = doc(db, `teams/${workspaceId}/members/${memberId}`)
    batch.update(ref, {
      order,
      updatedAt: serverTimestamp(),
    })
  }

  await batch.commit()
}
