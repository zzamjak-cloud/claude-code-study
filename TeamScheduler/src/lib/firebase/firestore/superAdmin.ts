// 최고 관리자 Firestore 함수

import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config'
import { CreateSuperAdminInput } from '../../../types/superAdmin'

/**
 * 최고 관리자 추가
 */
export const addSuperAdmin = async (
  workspaceId: string,
  input: CreateSuperAdminInput,
  userId: string,
  isPrimary: boolean = false
) => {
  // 이메일을 ID로 사용 (중복 방지)
  const adminId = input.email.toLowerCase().replace(/[^a-z0-9]/g, '_')
  const ref = doc(db, `superAdmins/${workspaceId}/admins/${adminId}`)

  await setDoc(ref, {
    id: adminId,
    name: input.name,
    email: input.email.toLowerCase(),
    isPrimary,
    createdBy: userId,
    createdAt: serverTimestamp(),
  })

  return adminId
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
  const adminId = primaryEmail.toLowerCase().replace(/[^a-z0-9]/g, '_')
  const ref = doc(db, `superAdmins/${workspaceId}/admins/${adminId}`)

  await setDoc(ref, {
    id: adminId,
    name: '최초 관리자',
    email: primaryEmail.toLowerCase(),
    isPrimary: true,
    createdBy: userId,
    createdAt: serverTimestamp(),
  }, { merge: true })  // 이미 있으면 덮어쓰지 않음

  return adminId
}
