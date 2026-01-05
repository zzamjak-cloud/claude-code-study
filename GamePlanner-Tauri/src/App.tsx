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
  const [chatPanelWidth, setChatPanelWidth] = useState<number>(CHAT_PANEL_WIDTH.DEFAULT)
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('')
  const [showVersionConfirm, setShowVersionConfirm] = useState(false)
  const [showVersionTitleInput, setShowVersionTitleInput] = useState(false)
  const [versionTitle, setVersionTitle] = useState('')
  const { apiKey, currentSessionId, sessions, createVersion } = useAppStore()

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
          // 기획 세션에서만 버전 등록 팝업 표시
          const currentSession = sessions.find(s => s.id === currentSessionId)
          if (currentSession && currentSession.type === 'planning') {
            setShowVersionConfirm(true)
          }
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

  // 버전 등록 확인
  const handleVersionConfirmYes = () => {
    setShowVersionConfirm(false)
    setShowVersionTitleInput(true)
  }

  const handleVersionConfirmNo = () => {
    setShowVersionConfirm(false)
  }

  // 버전 제목 입력 후 등록
  const handleVersionTitleConfirm = async () => {
    if (!currentSessionId) return
    try {
      createVersion(currentSessionId, versionTitle.trim() || undefined)
      setShowVersionTitleInput(false)
      setVersionTitle('')
      // 저장 알림은 하지 않음 (자동 저장됨)
    } catch (error) {
      console.error('버전 생성 실패:', error)
      alert('버전 생성에 실패했습니다.')
    }
  }

  const handleVersionTitleCancel = () => {
    setShowVersionTitleInput(false)
    setVersionTitle('')
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

        {/* 버전 등록 확인 팝업 */}
        {showVersionConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg p-6 shadow-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">버전 등록</h3>
              <p className="text-muted-foreground mb-6">
                신규 버전을 등록하시겠습니까?<br />
                현재 기획서 상태를 버전으로 저장할 수 있습니다.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleVersionConfirmNo}
                  className="px-4 py-2 rounded-lg bg-muted hover:bg-accent transition-colors font-medium"
                >
                  나중에
                </button>
                <button
                  onClick={handleVersionConfirmYes}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                >
                  등록
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 버전 제목 입력 모달 */}
        {showVersionTitleInput && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg p-6 shadow-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">버전 제목 입력</h3>
              <input
                type="text"
                value={versionTitle}
                onChange={(e) => setVersionTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleVersionTitleConfirm()
                  } else if (e.key === 'Escape') {
                    handleVersionTitleCancel()
                  }
                }}
                placeholder="버전 설명을 입력하세요 (선택사항)"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary mb-6"
                autoFocus
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleVersionTitleCancel}
                  className="px-4 py-2 rounded-lg bg-muted hover:bg-accent transition-colors font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleVersionTitleConfirm}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App
