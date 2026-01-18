// 글로벌 공지 Firestore CRUD

import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../config'
import { GlobalNotice } from '../../../types/globalNotice'

// 글로벌 공지 생성
export async function createGlobalNotice(
  workspaceId: string,
  notice: Omit<GlobalNotice, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const docRef = await addDoc(
    collection(db, `globalNotices/${workspaceId}/items`),
    {
      ...notice,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  )
  return docRef.id
}

// 글로벌 공지 수정
export async function updateGlobalNotice(
  workspaceId: string,
  noticeId: string,
  updates: Partial<GlobalNotice>
): Promise<void> {
  const docRef = doc(db, `globalNotices/${workspaceId}/items`, noticeId)
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

// 글로벌 공지 삭제
export async function deleteGlobalNotice(
  workspaceId: string,
  noticeId: string
): Promise<void> {
  const docRef = doc(db, `globalNotices/${workspaceId}/items`, noticeId)
  await deleteDoc(docRef)
}
