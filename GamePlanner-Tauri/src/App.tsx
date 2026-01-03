import { useState } from 'react'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { MarkdownPreview } from './components/MarkdownPreview'
import { SettingsModal } from './components/SettingsModal'
import { Resizer } from './components/Resizer'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAppStore } from './store/useAppStore'
import { useAppInitialization } from './hooks/useAppInitialization'
import { useAutoSave } from './hooks/useAutoSave'
import { useMessageHandler } from './hooks/useMessageHandler'
import { CHAT_PANEL_WIDTH } from './lib/constants/ui'

function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [chatPanelWidth, setChatPanelWidth] = useState(CHAT_PANEL_WIDTH.DEFAULT)
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('')
  const { apiKey } = useAppStore()

  // 앱 초기화
  useAppInitialization({
    onSettingsRequired: () => setShowSettings(true),
  })

  // 세션 자동 저장
  useAutoSave()

  // 메시지 핸들러
  const { handleSendMessage } = useMessageHandler()

  const handleSendMessageWrapper = async (message: string) => {
    if (!apiKey) {
      alert('API Key를 먼저 설정해주세요')
      setShowSettings(true)
      return
    }

    try {
      await handleSendMessage(message, {
        onChatUpdate: (text) => {
          setCurrentAssistantMessage(text)
        },
        onMarkdownUpdate: () => {
          // 마크다운 업데이트는 스토어에서 처리됨
        },
        onComplete: () => {
          setCurrentAssistantMessage('')
        },
        onError: (error) => {
          console.error('메시지 처리 오류:', error)
          setCurrentAssistantMessage('')
        },
      })
    } catch (error) {
      console.error('메시지 전송 실패:', error)
      setCurrentAssistantMessage('')
    }
  }

  const handleSettingsClick = () => {
    setShowSettings(true)
  }

  // 리사이저 드래그 핸들러
  const handleResize = (delta: number) => {
    const container = document.getElementById('main-container')
    if (!container) return

    // 사이드바(256px)를 제외한 실제 컨텐츠 영역의 너비
    const contentWidth = container.offsetWidth - 256
    const deltaPercent = (delta / contentWidth) * 100

    setChatPanelWidth((prev) => {
      const newWidth = prev + deltaPercent
      return Math.max(CHAT_PANEL_WIDTH.MIN, Math.min(CHAT_PANEL_WIDTH.MAX, newWidth))
    })
  }

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col">
        <Header
          onSettingsClick={handleSettingsClick}
        />
        <div id="main-container" className="flex-1 flex overflow-hidden">
          {/* 좌측 사이드바 (채팅 목록) */}
          <Sidebar />

          {/* 메인 컨텐츠 영역 (채팅 + 리사이저 + 기획서) */}
          <div className="flex-1 flex overflow-hidden">
            {/* 중앙 채팅 패널 */}
            <div
              style={{ width: `${chatPanelWidth}%` }}
              className="flex-shrink-0 overflow-hidden"
            >
              <ChatPanel
                onSendMessage={handleSendMessageWrapper}
                currentAssistantMessage={currentAssistantMessage}
              />
            </div>

            {/* 리사이저 */}
            <Resizer onResize={handleResize} />

            {/* 우측 마크다운 프리뷰 */}
            <div className="flex-1 overflow-hidden">
              <MarkdownPreview />
            </div>
          </div>
        </div>

        {/* 설정 모달 */}
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      </div>
    </ErrorBoundary>
  )
}

export default App
