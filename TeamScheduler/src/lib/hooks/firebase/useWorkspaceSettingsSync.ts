// 워크스페이스 설정 동기화 훅 (getDocs 기반)
// 커스텀 직군 등 워크스페이스 단위 설정 동기화

import { useEffect, useCallback } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { fetchWorkspaceSettings } from '../../firebase/firestore'

/**
 * 워크스페이스 설정 Firestore 동기화 훅
 * @param workspaceId - 워크스페이스 ID
 */
export const useWorkspaceSettingsSync = (workspaceId: string | null) => {
  const setCustomJobTitles = useAppStore((state) => state.setCustomJobTitles)

  // 데이터 조회 함수
  const loadWorkspaceSettings = useCallback(async () => {
    if (!workspaceId) {
      setCustomJobTitles([])
      return
    }

    try {
      const settings = await fetchWorkspaceSettings(workspaceId)
      console.log('✅ 워크스페이스 설정 조회:', settings.customJobTitles.length, '개 커스텀 직군')
      setCustomJobTitles(settings.customJobTitles)
    } catch (error) {
      console.error('❌ 워크스페이스 설정 조회 실패:', error)
    }
  }, [workspaceId, setCustomJobTitles])

  // 워크스페이스 변경 시 데이터 로드
  useEffect(() => {
    loadWorkspaceSettings()
  }, [loadWorkspaceSettings])

  // 수동 새로고침 함수 반환
  return { refreshWorkspaceSettings: loadWorkspaceSettings }
}
