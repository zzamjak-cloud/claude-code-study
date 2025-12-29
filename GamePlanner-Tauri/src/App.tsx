import { useState, useEffect } from 'react'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { MarkdownPreview } from './components/MarkdownPreview'
import { SettingsModal } from './components/SettingsModal'
import { Resizer } from './components/Resizer'
import { useAppStore, SessionType } from './store/useAppStore'
import { useGeminiChat } from './hooks/useGeminiChat'
import { useGameAnalysis } from './hooks/useGameAnalysis'
import { getSettings, saveSessions, saveSettings } from './lib/store'

function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [chatPanelWidth, setChatPanelWidth] = useState(40) // 40% (4:6 비율)
  const {
    apiKey,
    setApiKey,
    setNotionApiKey,
    setNotionPlanningDatabaseId,
    setNotionAnalysisDatabaseId,
    addMessage,
    setMarkdownContent,
    setIsLoading,
    createNewSession,
    updateAnalysisStatus,
    sessions,
  } = useAppStore()
  const { sendMessage } = useGeminiChat()
  const { analyzeGame } = useGameAnalysis()
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('')

  // 앱 시작 시 초기화
  useEffect(() => {
    const initialize = async () => {
      // API Key 로드
      try {
        console.log('🔍 설정 로드 중...')
        const settings = await getSettings()

        console.log('  - gemini_api_key:', settings.geminiApiKey ? '존재함' : '없음')
        console.log('  - notion_api_key:', settings.notionApiKey ? '존재함' : '없음')
        console.log('  - notion_planning_database_id:', settings.notionPlanningDatabaseId ? '존재함' : '없음')
        console.log('  - notion_analysis_database_id:', settings.notionAnalysisDatabaseId ? '존재함' : '없음')

        if (settings.geminiApiKey) {
          setApiKey(settings.geminiApiKey)
        } else {
          // API Key가 없으면 설정 모달 표시
          setShowSettings(true)
        }

        if (settings.notionApiKey) {
          setNotionApiKey(settings.notionApiKey)
        }

        // Planning DB ID 로드 (기존 DB ID 마이그레이션 포함)
        if (settings.notionPlanningDatabaseId) {
          setNotionPlanningDatabaseId(settings.notionPlanningDatabaseId)
        } else if (settings.oldNotionDbId) {
          // 마이그레이션: 기존 notion_database_id를 planning DB로 사용
          setNotionPlanningDatabaseId(settings.oldNotionDbId)
          await saveSettings({
            notionPlanningDatabaseId: settings.oldNotionDbId,
          })
        }

        // Analysis DB ID 로드
        if (settings.notionAnalysisDatabaseId) {
          setNotionAnalysisDatabaseId(settings.notionAnalysisDatabaseId)
        }

        // 세션 로드
        const savedSessions = settings.chatSessions
        console.log('📦 저장된 세션 개수:', savedSessions?.length || 0)

        // 저장된 세션이 있으면 복원, 없으면 새로 생성
        if (savedSessions && Array.isArray(savedSessions) && savedSessions.length > 0) {
          // 세션 타입 마이그레이션: type이 없는 세션은 PLANNING으로 설정
          const migratedSessions = savedSessions.map((session: any) => ({
            ...session,
            type: session.type || SessionType.PLANNING,
          }))

          // 저장된 세션 복원
          console.log('✅ 세션 복원:', migratedSessions.map((s: any) => s.title).join(', '))
          useAppStore.setState({
            sessions: migratedSessions,
            currentSessionId: migratedSessions[0].id,
            currentSessionType: migratedSessions[0].type, // 첫 세션의 타입으로 설정
            messages: migratedSessions[0].messages,
            markdownContent: migratedSessions[0].markdownContent,
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
          await saveSessions(sessions)
          console.log('💾 세션 저장 완료:', sessions.length, '개 -', sessions.map(s => s.title).join(', '))

          // 디버그: 저장 후 API 키 확인
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
    let store = useAppStore.getState()
    if (!store.currentSessionId || store.sessions.length === 0) {
      console.log('⚠️ 세션이 없어서 자동 생성')
      console.log('현재 세션 타입:', store.currentSessionType)
      const newSessionId = createNewSession()
      console.log('✅ 새 세션 생성 완료:', newSessionId)
      // 세션 생성 후 상태를 다시 가져옴
      store = useAppStore.getState()
    }

    // 현재 상태 가져오기
    const currentState = useAppStore.getState()
    const currentSession = currentState.sessions.find(s => s.id === currentState.currentSessionId)

    console.log('📋 현재 세션 정보:', {
      sessionId: currentSession?.id,
      sessionType: currentSession?.type,
      sessionTitle: currentSession?.title,
      currentSessionType: currentState.currentSessionType
    })

    // 분석 모드인 경우
    if (currentSession?.type === SessionType.ANALYSIS) {
      console.log('🔍 분석 모드로 실행')
      // 현재 상태 가져오기 (메시지 추가 전)
      const chatHistory = [...currentState.messages] // 현재까지의 대화 히스토리
      const currentAnalysisContent = currentState.markdownContent // 현재 분석 내용

      // 사용자 메시지 추가
      addMessage({ role: 'user', content: message })
      setIsLoading(true)
      setCurrentAssistantMessage('')

      // 분석 상태 업데이트
      updateAnalysisStatus(currentSession.id, 'running')

      try {
        // 대화 히스토리와 현재 분석 내용을 함께 전달
        await analyzeGame(
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
              updateAnalysisStatus(currentSession.id, 'completed')
              if (finalChatText.trim()) {
                addMessage({ role: 'assistant', content: finalChatText })
              }
              setIsLoading(false)
              setCurrentAssistantMessage('')
            },
            onError: (error) => {
              console.error('분석 오류:', error)
              updateAnalysisStatus(currentSession.id, 'failed')
              addMessage({
                role: 'assistant',
                content: `분석 중 오류가 발생했습니다: ${error.message}`,
              })
              setIsLoading(false)
              setCurrentAssistantMessage('')
            },
          },
          chatHistory, // 대화 히스토리 전달
          currentAnalysisContent // 현재 분석 내용 전달
        )
      } catch (error) {
        console.error('분석 실행 오류:', error)
        updateAnalysisStatus(currentSession.id, 'failed')
        setIsLoading(false)
        setCurrentAssistantMessage('')
      }
      return
    }

    // 기획 모드인 경우 (기존 로직)
    console.log('📝 기획 모드로 실행')
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
