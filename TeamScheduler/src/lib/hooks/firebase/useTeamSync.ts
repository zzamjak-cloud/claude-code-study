// 팀원 동기화 훅 (getDocs 기반)
// 관리자만 수정 가능하므로 일회성 조회로 Firebase 비용 절감

import { useEffect, useCallback } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { fetchTeamMembers } from '../../firebase/firestore'

/**
 * 팀원 Firestore 동기화 훅
 * 실시간 동기화(onSnapshot) 대신 일회성 조회(getDocs) 사용
 * @param workspaceId - 워크스페이스 ID
 */
export const useTeamSync = (workspaceId: string | null) => {
  const setMembers = useAppStore(state => state.setMembers)

  // 데이터 조회 함수
  const loadTeamMembers = useCallback(async () => {
    if (!workspaceId) {
      setMembers([])
      return
    }

    try {
      const members = await fetchTeamMembers(workspaceId)
      console.log('✅ 팀원 조회:', members.length, '명')
      setMembers(members)
    } catch (error) {
      console.error('❌ 팀원 조회 실패:', error)
    }
  }, [workspaceId, setMembers])

  // 워크스페이스 변경 시 데이터 로드
  useEffect(() => {
    loadTeamMembers()
  }, [loadTeamMembers])

  // 수동 새로고침 함수 반환 (필요시 사용)
  return { refreshTeamMembers: loadTeamMembers }
}
