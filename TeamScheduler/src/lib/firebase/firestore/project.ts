// 프로젝트 Firestore CRUD 함수

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../config'
import { Project } from '../../../types/project'

/**
 * 프로젝트 목록 조회 (일회성 조회)
 * 실시간 동기화 대신 사용하여 Firebase 읽기 비용 절감
 */
export const fetchProjects = async (workspaceId: string): Promise<Project[]> => {
  const projectsQuery = query(
    collection(db, `projects/${workspaceId}/items`),
    orderBy('createdAt', 'asc')
  )

  const snapshot = await getDocs(projectsQuery)

  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      name: data.name,
      color: data.color,
      type: data.type || 'project',
      description: data.description,
      memberIds: data.memberIds || [],
      memberOrder: data.memberOrder || undefined,  // 프로젝트 내 구성원 순서
      isHidden: data.isHidden || false,
      order: data.order ?? 0,
      createdBy: data.createdBy,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toMillis()
          : data.createdAt || Date.now(),
      updatedAt:
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toMillis()
          : data.updatedAt || Date.now(),
    } as Project
  })
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
    memberOrder?: string[]  // 프로젝트 내 구성원 순서
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
