// 창 크기 및 위치 저장/복원 커스텀 훅

import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { saveWindowState, getWindowState } from '../lib/store'
import { devLog } from '../lib/utils/logger'

export function useWindowState() {
  useEffect(() => {
    const appWindow = getCurrentWindow()

    // 저장된 창 상태 복원
    const restoreWindowState = async () => {
      try {
        const savedState = await getWindowState()

        if (savedState && !savedState.maximized) {
          // 최대화 상태가 아니었으면 저장된 크기와 위치 복원
          devLog.log('🪟 저장된 창 상태 복원:', savedState)
          await appWindow.setPosition({ x: savedState.x, y: savedState.y })
          await appWindow.setSize({ width: savedState.width, height: savedState.height })
        } else if (savedState && savedState.maximized) {
          // 최대화 상태였으면 최대화
          devLog.log('🪟 창 최대화 상태 복원')
          await appWindow.maximize()
        } else {
          // 저장된 상태가 없으면 기본 최대화
          devLog.log('🪟 기본 최대화 상태 적용')
          await appWindow.maximize()
        }
      } catch (error) {
        console.error('창 상태 복원 실패:', error)
      }
    }

    // 앱 시작 시 창 상태 복원
    restoreWindowState()

    // 창 크기/위치 변경 시 저장
    let saveTimeout: NodeJS.Timeout | null = null

    const handleWindowChange = async () => {
      // 디바운싱: 0.5초 후에 저장
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }

      saveTimeout = setTimeout(async () => {
        try {
          const position = await appWindow.outerPosition()
          const size = await appWindow.outerSize()
          const maximized = await appWindow.isMaximized()

          const windowState = {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            maximized,
          }

          await saveWindowState(windowState)
          devLog.log('🪟 창 상태 저장:', windowState)
        } catch (error) {
          console.error('창 상태 저장 실패:', error)
        }
      }, 500)
    }

    // 창 이벤트 리스너 등록
    const setupListeners = async () => {
      try {
        const unlistenResize = await appWindow.onResized(handleWindowChange)
        const unlistenMove = await appWindow.onMoved(handleWindowChange)

        // 클린업
        return () => {
          unlistenResize()
          unlistenMove()
          if (saveTimeout) {
            clearTimeout(saveTimeout)
          }
        }
      } catch (error) {
        console.error('창 이벤트 리스너 등록 실패:', error)
        return () => {}
      }
    }

    let cleanup: (() => void) | undefined

    setupListeners().then((fn) => {
      cleanup = fn
    })

    return () => {
      if (cleanup) {
        cleanup()
      }
    }
  }, [])
}
