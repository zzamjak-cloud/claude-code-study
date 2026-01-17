// 프로젝트 Firestore CRUD 함수

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config'

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
