// 세션 자동 저장 로직을 담당하는 커스텀 훅

import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { saveSessions } from '../lib/store'
import { AUTO_SAVE_DEBOUNCE_MS } from '../lib/constants/session'

export function useAutoSave() {
  const { sessions } = useAppStore()

  useEffect(() => {
    const saveSession = async () => {
      if (sessions.length > 0) {
        try {
          await saveSessions(sessions)
          console.log('💾 세션 저장 완료:', sessions.length, '개 -', sessions.map(s => s.title).join(', '))

          // 디버그: 저장 후 API 키 확인
          const { getSettings } = await import('../lib/store')
          const settings = await getSettings()
          if (!settings.geminiApiKey) {
            console.error('⚠️ 경고: 세션 저장 후 API 키가 사라짐!')
          } else {
            console.log('✅ API 키 정상 유지됨')
          }
        } catch (error) {
          console.error('❌ 세션 저장 실패:', error)
        }
      }
    }

    // 세션이 변경될 때마다 저장 (디바운스)
    const timeout = setTimeout(saveSession, AUTO_SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [sessions])
}

