import { useState, useEffect } from 'react'
import { Store } from '@tauri-apps/plugin-store'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { MarkdownPreview } from './components/MarkdownPreview'
import { SettingsModal } from './components/SettingsModal'
import { Resizer } from './components/Resizer'
import { useAppStore } from './store/useAppStore'
import { useGeminiChat } from './hooks/useGeminiChat'

function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [chatPanelWidth, setChatPanelWidth] = useState(40) // 40% (4:6 비율)
  const {
    apiKey,
    setApiKey,
    setNotionApiKey,
    setNotionDatabaseId,
    addMessage,
    setMarkdownContent,
    setIsLoading,
    markdownContent,
    currentSessionId,
    createNewSession,
    sessions,
  } = useAppStore()
  const { sendMessage } = useGeminiChat()
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('')

  // 기획서에서 게임명 추출
  const extractGameName = (markdown: string): string => {
    // "# 게임명 게임 기획서" 패턴에서 게임명 추출
    const match = markdown.match(/^#\s*(.+?)\s*게임\s*기획서/m)
    if (match) {
      return match[1].trim()
    }
    return '게임_기획서'
  }

  // 앱 시작 시 초기화
  useEffect(() => {
    const initialize = async () => {
      // API Key 로드
      try {
        const store = await Store.load('settings.json')
        const savedKey = await store.get<string>('gemini_api_key')
        const savedNotionKey = await store.get<string>('notion_api_key')
        const savedNotionDbId = await store.get<string>('notion_database_id')

        if (savedKey) {
          setApiKey(savedKey)
        } else {
          // API Key가 없으면 설정 모달 표시
          setShowSettings(true)
        }

        if (savedNotionKey) {
          setNotionApiKey(savedNotionKey)
        }

        if (savedNotionDbId) {
          setNotionDatabaseId(savedNotionDbId)
        }

        // 세션 로드
        const savedSessions = await store.get<any>('chat_sessions')
        console.log('📦 저장된 세션 개수:', savedSessions?.length || 0)

        // 저장된 세션이 있으면 복원, 없으면 새로 생성
        if (savedSessions && Array.isArray(savedSessions) && savedSessions.length > 0) {
          // 저장된 세션 복원
          console.log('✅ 세션 복원:', savedSessions.map(s => s.title).join(', '))
          useAppStore.setState({
            sessions: savedSessions,
            currentSessionId: savedSessions[0].id,
            messages: savedSessions[0].messages,
            markdownContent: savedSessions[0].markdownContent,
          })
        } else {
          // 초기 세션 생성
          console.log('🆕 초기 세션 생성')
          const newSessionId = createNewSession()
          console.log('✅ 생성된 세션 ID:', newSessionId)
        }
      } catch (error) {
        console.error('초기화 실패:', error)
        setShowSettings(true)
        createNewSession()
      }
    }

    initialize()
  }, [])

  // 세션 자동 저장
  useEffect(() => {
    const saveSession = async () => {
      if (sessions.length > 0) {
        try {
          const store = await Store.load('settings.json')
          await store.set('chat_sessions', sessions)
          await store.save()
          console.log('💾 세션 저장 완료:', sessions.length, '개 -', sessions.map(s => s.title).join(', '))
        } catch (error) {
          console.error('❌ 세션 저장 실패:', error)
        }
      }
    }

    // 세션이 변경될 때마다 저장 (디바운스)
    const timeout = setTimeout(saveSession, 500)
    return () => clearTimeout(timeout)
  }, [sessions])

  const handleSendMessage = async (message: string) => {
    if (!apiKey) {
      alert('API Key를 먼저 설정해주세요')
      setShowSettings(true)
      return
    }

    // 세션이 없으면 자동으로 생성
    const store = useAppStore.getState()
    if (!store.currentSessionId || store.sessions.length === 0) {
      console.log('⚠️ 세션이 없어서 자동 생성')
      const newSessionId = createNewSession()
      console.log('✅ 새 세션 생성 완료:', newSessionId)
    }

    // 현재 상태 가져오기 (메시지 추가 전)
    const currentState = useAppStore.getState()
    const chatHistory = [...currentState.messages] // 현재까지의 대화 히스토리
    const currentMarkdownContent = currentState.markdownContent // 현재 기획서

    // 사용자 메시지 추가
    addMessage({ role: 'user', content: message })
    setIsLoading(true)
    setCurrentAssistantMessage('')

    try {
      // 대화 히스토리와 현재 마크다운을 함께 전달
      await sendMessage(
        apiKey,
        message,
        {
          onChatUpdate: (text) => {
            setCurrentAssistantMessage(text)
          },
          onMarkdownUpdate: (markdown) => {
            setMarkdownContent(markdown)
          },
          onComplete: (finalChatText) => {
            if (finalChatText.trim()) {
              addMessage({ role: 'assistant', content: finalChatText })
            }
            setIsLoading(false)
            setCurrentAssistantMessage('')
          },
          onError: (error) => {
            console.error('Gemini API Error:', error)
            addMessage({
              role: 'assistant',
              content: `오류가 발생했습니다: ${error.message}`,
            })
            setIsLoading(false)
            setCurrentAssistantMessage('')
          },
        },
        chatHistory, // 대화 히스토리 전달
        currentMarkdownContent // 현재 기획서 전달
      )
    } catch (error) {
      console.error('Error:', error)
      addMessage({
        role: 'assistant',
        content: '오류가 발생했습니다. 다시 시도해주세요.',
      })
      setIsLoading(false)
      setCurrentAssistantMessage('')
    }
  }

  const handleSettingsClick = () => {
    setShowSettings(true)
  }

  const handleDownloadClick = async () => {
    if (!markdownContent) {
      alert('저장할 기획서가 없습니다')
      return
    }

    try {
      // 게임명 추출 및 파일명 생성
      const gameName = extractGameName(markdownContent)

      // 현재 세션 제목 사용 (게임명 추출 실패 시)
      const currentSession = sessions.find(s => s.id === currentSessionId)
      const finalGameName = gameName !== '게임_기획서' ? gameName : (currentSession?.title || '게임_기획서')

      const defaultFileName = `${finalGameName}_기획서.md`

      // 저장 경로 선택 대화상자
      const filePath = await save({
        defaultPath: defaultFileName,
        filters: [
          {
            name: 'Markdown',
            extensions: ['md'],
          },
        ],
      })

      if (!filePath) {
        // 사용자가 취소한 경우
        return
      }

      // 파일 저장
      await writeTextFile(filePath, markdownContent)

      alert('기획서가 저장되었습니다')
    } catch (error) {
      console.error('파일 저장 실패:', error)
      alert('파일 저장에 실패했습니다')
    }
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
      // 최소 20%, 최대 80%로 제한
      return Math.max(20, Math.min(80, newWidth))
    })
  }

  return (
    <div className="h-screen flex flex-col">
      <Header
        onSettingsClick={handleSettingsClick}
        onDownloadClick={handleDownloadClick}
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
              onSendMessage={handleSendMessage}
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
  )
}

export default App
