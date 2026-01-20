// 최고 관리자 Firestore 함수

import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../config'
import { CreateSuperAdminInput, SuperAdmin } from '../../../types/superAdmin'

/**
 * 최고 관리자 목록 조회 (일회성 조회)
 * 실시간 동기화 대신 사용하여 Firebase 읽기 비용 절감
 */
export const fetchSuperAdmins = async (workspaceId: string): Promise<SuperAdmin[]> => {
  const adminsQuery = query(
    collection(db, `superAdmins/${workspaceId}/admins`),
    orderBy('name', 'asc')
  )

  const snapshot = await getDocs(adminsQuery)

  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      name: data.name || '',
      email: data.email || '',
      isPrimary: data.isPrimary || false,
      createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toMillis()
        : data.createdAt || Date.now(),
      createdBy: data.createdBy || '',
    } as SuperAdmin
  })
}

/**
 * 최고 관리자 추가
 */
export const addSuperAdmin = async (
  workspaceId: string,
  input: CreateSuperAdminInput,
  userId: string,
  isPrimary: boolean = false
) => {
  // 이메일을 ID로 사용 (중복 방지, Firestore 규칙에서 이메일로 검색 가능)
  const emailLower = input.email.toLowerCase()
  const ref = doc(db, `superAdmins/${workspaceId}/admins/${emailLower}`)

  await setDoc(ref, {
    id: emailLower,
    name: input.name,
    email: emailLower,
    isPrimary,
    createdBy: userId,
    createdAt: serverTimestamp(),
  })

  return emailLower
}

/**
 * 최고 관리자 삭제
 * isPrimary가 true인 최초 관리자는 삭제할 수 없음
 */
export const deleteSuperAdmin = async (
  workspaceId: string,
  adminId: string
) => {
  const ref = doc(db, `superAdmins/${workspaceId}/admins/${adminId}`)
  await deleteDoc(ref)
}

/**
 * 최초 관리자 초기화 (환경 변수의 관리자를 등록)
 * 앱 초기 로드 시 한 번만 실행
 */
export const initializePrimarySuperAdmin = async (
  workspaceId: string,
  primaryEmail: string,
  userId: string
) => {
  const emailLower = primaryEmail.toLowerCase()
  const ref = doc(db, `superAdmins/${workspaceId}/admins/${emailLower}`)

  await setDoc(ref, {
    id: emailLower,
    name: '최초 관리자',
    email: emailLower,
    isPrimary: true,
    createdBy: userId,
    createdAt: serverTimestamp(),
  }, { merge: true })  // 이미 있으면 덮어쓰지 않음

  return emailLower
}
