import { createAnalysisSystemPrompt } from '../lib/analysisInstruction'
import { Message } from '../store/useAppStore'
import { GeminiContent } from '../types/gemini'
import { CHAT_HISTORY_LIMIT } from '../lib/constants/api'
import { geminiService } from '../lib/services/geminiService'
import { removeCitationNumbers } from '../lib/utils/markdown'

interface AnalysisCallbacks {
  onChatUpdate: (text: string) => void
  onMarkdownUpdate: (markdown: string) => void
  onComplete: (finalChatText: string) => void
  onError: (error: Error) => void
}

export function useGameAnalysis() {
  const analyzeGame = async (
    apiKey: string,
    message: string,
    callbacks: AnalysisCallbacks,
    chatHistory?: Message[],
    currentAnalysis?: string,
    systemPrompt?: string  // 신규: 동적 시스템 프롬프트
  ) => {
    try {
      // API Key 검증 및 정리
      const cleanApiKey = String(apiKey || '').trim()
      if (!cleanApiKey) {
        throw new Error('API Key가 비어있습니다')
      }

      // 대화 히스토리 구성
      const contents: GeminiContent[] = []

      // 1. 시스템 지시문을 첫 메시지로 추가 (동적 프롬프트 지원)
      // systemPrompt는 사용자 정의 템플릿 내용 (간결한 버전)
      // createAnalysisSystemPrompt로 시스템 래퍼와 결합
      const systemMessage = createAnalysisSystemPrompt(
        systemPrompt || '기본 분석 템플릿을 사용합니다.',
        currentAnalysis
      )

      contents.push({
        role: 'user',
        parts: [{ text: systemMessage }]
      })

      contents.push({
        role: 'model',
        parts: [{ text: '네, 이해했습니다. 게임 분석 전문가로서 도와드리겠습니다.' }]
      })

      // 2. 이전 대화 히스토리 추가
      if (chatHistory && chatHistory.length > 0) {
        const recentHistory = chatHistory.slice(-CHAT_HISTORY_LIMIT)
        for (const msg of recentHistory) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          })
        }
      }

      // 3. 현재 사용자 메시지 추가
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      })

      console.log('📝 전달되는 컨텍스트:', {
        시스템지시문: '포함됨',
        현재분석내용: currentAnalysis ? '포함됨 (' + currentAnalysis.length + '자)' : '없음',
        대화히스토리: chatHistory?.length || 0,
        총메시지수: contents.length
      })

      console.log('API 요청 시작...')

      let fullResponse = ''

      // Gemini 서비스를 통한 스트리밍 호출 (Google Search 포함)
      await geminiService.streamGenerateContent(cleanApiKey, contents, {
        tools: [
          {
            google_search: {}
          },
        ],
        onChunk: (chunk) => {
          if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
            const text = chunk.candidates[0].content.parts[0]?.text || ''
            if (text) {
              fullResponse += text
              console.log('텍스트 수신:', text.substring(0, 50) + '...')

              // <markdown_content> 태그 파싱
              const parts = fullResponse.split(/<markdown_content>|<\/markdown_content>/)

              let chatText = ''
              let markdownContent = ''

              if (parts.length === 1) {
                // markdown_content 태그가 없음
                chatText = fullResponse
                callbacks.onChatUpdate(chatText)
              } else if (parts.length === 2) {
                // markdown_content 태그가 열렸지만 아직 닫히지 않음
                chatText = parts[0]
                markdownContent = removeCitationNumbers(parts[1])
                callbacks.onChatUpdate(chatText)
                callbacks.onMarkdownUpdate(markdownContent)
              } else if (parts.length >= 3) {
                // markdown_content 태그가 열리고 닫힘
                chatText = parts[0] + (parts[2] || '')
                markdownContent = removeCitationNumbers(parts[1])
                callbacks.onChatUpdate(chatText)
                callbacks.onMarkdownUpdate(markdownContent)
              }
            }
          }
        },
      })

      console.log('전체 응답:', fullResponse.substring(0, 100) + '...')

      // 최종 파싱
      const parts = fullResponse.split(/<markdown_content>|<\/markdown_content>/)
      let chatText = ''

      if (parts.length === 1) {
        chatText = fullResponse
      } else if (parts.length >= 3) {
        chatText = parts[0] + (parts[2] || '')
      }

      callbacks.onComplete(chatText)
    } catch (error) {
      console.error('Gemini API Error:', error)
      callbacks.onError(
        error instanceof Error ? error : new Error('알 수 없는 오류가 발생했습니다')
      )
    }
  }

  return { analyzeGame }
}
