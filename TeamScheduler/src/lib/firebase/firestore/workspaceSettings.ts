// 워크스페이스 설정 Firestore 함수
// 커스텀 직군 등 워크스페이스 단위 설정 관리

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config'

export interface WorkspaceSettings {
  customJobTitles: string[]
  updatedAt?: number
}

/**
 * 워크스페이스 설정 조회
 */
export const fetchWorkspaceSettings = async (workspaceId: string): Promise<WorkspaceSettings> => {
  const ref = doc(db, `workspaceSettings/${workspaceId}`)
  const snapshot = await getDoc(ref)

  if (!snapshot.exists()) {
    return { customJobTitles: [] }
  }

  const data = snapshot.data()
  return {
    customJobTitles: data.customJobTitles || [],
    updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt,
  }
}

/**
 * 커스텀 직군 목록 업데이트
 */
export const updateCustomJobTitles = async (
  workspaceId: string,
  customJobTitles: string[]
): Promise<void> => {
  const ref = doc(db, `workspaceSettings/${workspaceId}`)

  await setDoc(ref, {
    customJobTitles,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}
