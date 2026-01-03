// 메시지 처리 로직을 담당하는 커스텀 훅

import { useAppStore, SessionType } from '../store/useAppStore'
import { useGeminiChat } from './useGeminiChat'
import { useGameAnalysis } from './useGameAnalysis'
import { SYSTEM_INSTRUCTION } from '../lib/systemInstruction'

interface MessageHandlerCallbacks {
  onChatUpdate?: (text: string) => void
  onMarkdownUpdate?: (markdown: string) => void
  onComplete?: (finalChatText: string) => void
  onError?: (error: Error) => void
}

export function useMessageHandler() {
  const {
    apiKey,
    sessions,
    currentSessionId,
    currentSessionType,
    addMessage,
    setMarkdownContent,
    setIsLoading,
    updateAnalysisStatus,
    getTemplateById,
    currentPlanningTemplateId,
    currentAnalysisTemplateId,
    createNewSession,
  } = useAppStore()

  const { sendMessage } = useGeminiChat()
  const { analyzeGame } = useGameAnalysis()

  const handleSendMessage = async (
    message: string,
    callbacks: MessageHandlerCallbacks = {}
  ) => {
    if (!apiKey) {
      throw new Error('API Key를 먼저 설정해주세요')
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
      return handleAnalysisMessage(
        message,
        currentSession,
        currentState,
        callbacks
      )
    }

    // 기획 모드인 경우
    return handlePlanningMessage(
      message,
      currentSession,
      currentState,
      callbacks
    )
  }

  const handleAnalysisMessage = async (
    message: string,
    currentSession: ReturnType<typeof useAppStore.getState>['sessions'][0],
    currentState: ReturnType<typeof useAppStore.getState>,
    callbacks: MessageHandlerCallbacks
  ) => {
    console.log('🔍 분석 모드로 실행')
    
    // 현재 상태 가져오기 (메시지 추가 전)
    const chatHistory = [...currentState.messages] // 현재까지의 대화 히스토리
    const currentAnalysisContent = currentState.markdownContent // 현재 분석 내용

    // 템플릿 기반 시스템 프롬프트 로드
    const template = getTemplateById(currentSession.templateId || currentAnalysisTemplateId || 'default-analysis')
    const systemPrompt = template?.content || ''

    console.log('📋 사용 중인 분석 템플릿:', template?.name || '기본 분석 템플릿')

    // 사용자 메시지 추가
    addMessage({ role: 'user', content: message })
    setIsLoading(true)

    // 분석 상태 업데이트
    updateAnalysisStatus(currentSession.id, 'running')

    try {
      // 대화 히스토리와 현재 분석 내용, 템플릿 프롬프트를 함께 전달
      await analyzeGame(
        apiKey!,
        message,
        {
          onChatUpdate: (text) => {
            callbacks.onChatUpdate?.(text)
          },
          onMarkdownUpdate: (markdown) => {
            setMarkdownContent(markdown)
            callbacks.onMarkdownUpdate?.(markdown)
          },
          onComplete: (finalChatText) => {
            updateAnalysisStatus(currentSession.id, 'completed')
            if (finalChatText.trim()) {
              addMessage({ role: 'assistant', content: finalChatText })
            }
            setIsLoading(false)
            callbacks.onComplete?.(finalChatText)
          },
          onError: (error) => {
            console.error('분석 오류:', error)
            updateAnalysisStatus(currentSession.id, 'failed')
            addMessage({
              role: 'assistant',
              content: `분석 중 오류가 발생했습니다: ${error.message}`,
            })
            setIsLoading(false)
            callbacks.onError?.(error)
          },
        },
        chatHistory, // 대화 히스토리 전달
        currentAnalysisContent, // 현재 분석 내용 전달
        systemPrompt // 템플릿 프롬프트 전달
      )
    } catch (error) {
      console.error('분석 실행 오류:', error)
      updateAnalysisStatus(currentSession.id, 'failed')
      setIsLoading(false)
      callbacks.onError?.(error instanceof Error ? error : new Error('알 수 없는 오류가 발생했습니다'))
    }
  }

  const handlePlanningMessage = async (
    message: string,
    currentSession: ReturnType<typeof useAppStore.getState>['sessions'][0] | undefined,
    currentState: ReturnType<typeof useAppStore.getState>,
    callbacks: MessageHandlerCallbacks
  ) => {
    console.log('📝 기획 모드로 실행')
    
    const chatHistory = [...currentState.messages] // 현재까지의 대화 히스토리
    const currentMarkdownContent = currentState.markdownContent // 현재 기획서

    // 템플릿 기반 시스템 프롬프트 로드
    const template = getTemplateById(currentSession?.templateId || currentPlanningTemplateId || 'default-planning')
    const systemPrompt = template?.content || SYSTEM_INSTRUCTION

    console.log('📋 사용 중인 기획 템플릿:', template?.name || '기본 기획 템플릿')

    // 사용자 메시지 추가
    addMessage({ role: 'user', content: message })
    setIsLoading(true)

    try {
      // 대화 히스토리와 현재 마크다운, 템플릿 프롬프트를 함께 전달
      await sendMessage(
        apiKey!,
        message,
        {
          onChatUpdate: (text) => {
            callbacks.onChatUpdate?.(text)
          },
          onMarkdownUpdate: (markdown) => {
            setMarkdownContent(markdown)
            callbacks.onMarkdownUpdate?.(markdown)
          },
          onComplete: (finalChatText) => {
            if (finalChatText.trim()) {
              addMessage({ role: 'assistant', content: finalChatText })
            }
            setIsLoading(false)
            callbacks.onComplete?.(finalChatText)
          },
          onError: (error) => {
            console.error('Gemini API Error:', error)
            addMessage({
              role: 'assistant',
              content: `오류가 발생했습니다: ${error.message}`,
            })
            setIsLoading(false)
            callbacks.onError?.(error)
          },
        },
        chatHistory, // 대화 히스토리 전달
        currentMarkdownContent, // 현재 기획서 전달
        systemPrompt // 템플릿 프롬프트 전달
      )
    } catch (error) {
      console.error('Error:', error)
      addMessage({
        role: 'assistant',
        content: '오류가 발생했습니다. 다시 시도해주세요.',
      })
      setIsLoading(false)
      callbacks.onError?.(error instanceof Error ? error : new Error('알 수 없는 오류가 발생했습니다'))
    }
  }

  return { handleSendMessage }
}

