// 최고 관리자 동기화 훅 (getDocs 기반)
// 자주 변경되지 않는 데이터이므로 일회성 조회로 Firebase 비용 절감

import { useEffect, useCallback } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { fetchSuperAdmins } from '../../firebase/firestore'

/**
 * 최고 관리자 Firestore 동기화 훅
 * 실시간 동기화(onSnapshot) 대신 일회성 조회(getDocs) 사용
 * @param workspaceId - 워크스페이스 ID
 */
export const useSuperAdminsSync = (workspaceId: string | null) => {
  const setSuperAdmins = useAppStore((state) => state.setSuperAdmins)

  // 데이터 조회 함수
  const loadSuperAdmins = useCallback(async () => {
    if (!workspaceId) {
      setSuperAdmins([])
      return
    }

    try {
      const admins = await fetchSuperAdmins(workspaceId)
      console.log('✅ 최고 관리자 조회:', admins.length, '명')
      setSuperAdmins(admins)
    } catch (error) {
      console.error('❌ 최고 관리자 조회 실패:', error)
    }
  }, [workspaceId, setSuperAdmins])

  // 워크스페이스 변경 시 데이터 로드
  useEffect(() => {
    loadSuperAdmins()
  }, [loadSuperAdmins])

  // 수동 새로고침 함수 반환 (필요시 사용)
  return { refreshSuperAdmins: loadSuperAdmins }
}
