// 공지사항 Firestore 함수

import {
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config'

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
