// 프로젝트 실시간 동기화 훅

import { useEffect } from 'react'
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAppStore } from '../../../store/useAppStore'
import { Project } from '../../../types/project'

/**
 * 프로젝트 Firestore 실시간 동기화 훅
 * @param workspaceId - 워크스페이스 ID
 */
export const useProjectsSync = (workspaceId: string | null) => {
  const setProjects = useAppStore(state => state.setProjects)

  useEffect(() => {
    if (!workspaceId) return

    // 프로젝트 동기화 (order 필드가 없는 기존 문서도 포함하기 위해 createdAt으로 쿼리)
    const projectsQuery = query(
      collection(db, `projects/${workspaceId}/items`),
      orderBy('createdAt', 'asc')
    )

    const unsubscribe = onSnapshot(
      projectsQuery,
      (snapshot) => {
        const projects = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            name: data.name,
            color: data.color,
            type: data.type || 'project',  // 기본값: 프로젝트
            description: data.description,
            memberIds: data.memberIds || [],
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

        console.log('✅ 프로젝트 동기화:', projects.length, '개')
        setProjects(projects)
      },
      (error) => {
        console.error('❌ 프로젝트 동기화 실패:', error)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [workspaceId, setProjects])
}
