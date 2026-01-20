// 프로젝트 동기화 훅 (getDocs 기반)
// 관리자만 수정 가능하므로 일회성 조회로 Firebase 비용 절감

import { useEffect, useCallback } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { fetchProjects } from '../../firebase/firestore'

/**
 * 프로젝트 Firestore 동기화 훅
 * 실시간 동기화(onSnapshot) 대신 일회성 조회(getDocs) 사용
 * @param workspaceId - 워크스페이스 ID
 */
export const useProjectsSync = (workspaceId: string | null) => {
  const setProjects = useAppStore(state => state.setProjects)

  // 데이터 조회 함수
  const loadProjects = useCallback(async () => {
    if (!workspaceId) {
      setProjects([])
      return
    }

    try {
      const projects = await fetchProjects(workspaceId)
      console.log('✅ 프로젝트 조회:', projects.length, '개')
      setProjects(projects)
    } catch (error) {
      console.error('❌ 프로젝트 조회 실패:', error)
    }
  }, [workspaceId, setProjects])

  // 워크스페이스 변경 시 데이터 로드
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // 수동 새로고침 함수 반환 (필요시 사용)
  return { refreshProjects: loadProjects }
}
