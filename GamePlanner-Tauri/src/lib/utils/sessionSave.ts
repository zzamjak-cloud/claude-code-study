// 세션 즉시 저장 유틸리티 함수

import { useAppStore } from '../../store/useAppStore'
import { saveSessions } from '../store'

/**
 * 현재 세션을 즉시 저장합니다
 * 중요한 변화 지점에서 호출하여 데이터 손실을 방지합니다
 */
export async function saveSessionImmediately(): Promise<void> {
  try {
    const { sessions } = useAppStore.getState()
    if (sessions.length > 0) {
      await saveSessions(sessions)
      console.log('💾 즉시 저장 완료:', sessions.length, '개 세션')
    }
  } catch (error) {
    console.error('❌ 즉시 저장 실패:', error)
    // 사용자에게 알리지 않고 로그만 남김 (자동 저장이므로)
  }
}

