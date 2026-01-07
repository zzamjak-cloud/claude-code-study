import { SYSTEM_INSTRUCTION } from '../lib/systemInstruction'
import { Message } from '../store/useAppStore'
import { GeminiContent } from '../types/gemini'
import { geminiService } from '../lib/services/geminiService'
import { CHAT_HISTORY_LIMIT } from '../lib/constants/api'
import { StreamingProgressTracker } from '../lib/utils/streamingProgress'
import { devLog } from '../lib/utils/logger'

interface StreamCallbacks {
  onChatUpdate: (text: string) => void
  onMarkdownUpdate: (markdown: string) => void
  onComplete: (finalChatText: string) => void
  onError: (error: Error) => void
}

export function useGeminiChat() {
  const sendMessage = async (
    apiKey: string,
    message: string,
    callbacks: StreamCallbacks,
    chatHistory?: Message[],
    currentMarkdown?: string,
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
      let systemMessage = systemPrompt || SYSTEM_INSTRUCTION  // fallback

      // 2. 현재 기획서가 있으면 시스템 메시지에 포함
      if (currentMarkdown && currentMarkdown.trim()) {
        systemMessage += `\n\n---\n\n# 현재 작성된 기획서\n아래는 현재까지 작성된 기획서입니다. 수정 요청이 들어오면 이 내용을 기반으로 요청된 부분만 수정하고 나머지는 그대로 유지하십시오.\n\n<current_markdown>\n${currentMarkdown}\n</current_markdown>`
      }

      contents.push({
        role: 'user',
        parts: [{ text: systemMessage }]
      })

      contents.push({
        role: 'model',
        parts: [{ text: '네, 이해했습니다. 게임 기획 전문가로서 도와드리겠습니다.' }]
      })

      // 3. 이전 대화 히스토리 추가
      if (chatHistory && chatHistory.length > 0) {
        const recentHistory = chatHistory.slice(-CHAT_HISTORY_LIMIT)
        for (const msg of recentHistory) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          })
        }
      }

      // 4. 현재 사용자 메시지 추가
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      })

      // 디버그 로그 제거
      // console.log('📝 전달되는 컨텍스트:', {
      //   시스템지시문: '포함됨',
      //   현재기획서: currentMarkdown ? '포함됨 (' + currentMarkdown.length + '자)' : '없음',
      //   대화히스토리: chatHistory?.length || 0,
      //   총메시지수: contents.length
      // })

      let fullResponse = ''

      // 진행 상황 추적기 초기화 (템플릿 프롬프트만 사용)
      const progressTracker = new StreamingProgressTracker(systemPrompt || SYSTEM_INSTRUCTION)
      devLog.log('📊 [기획] 진행 상황 추적 시작 - 헤더 개수:', progressTracker.getTotalCount())

      // Gemini 서비스를 통한 스트리밍 호출
      await geminiService.streamGenerateContent(cleanApiKey, contents, {
        onChunk: (chunk) => {
          if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
            const text = chunk.candidates[0].content.parts[0]?.text || ''
            if (text) {
              fullResponse += text
              // 로그 제거: 스트리밍 중 너무 빈번하게 출력됨
              // console.log('텍스트 수신:', text.substring(0, 50) + '...')

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
                markdownContent = parts[1]

                // 진행 상황 추적 및 업데이트
                const progressMessage = progressTracker.update(markdownContent)
                if (progressMessage) {
                  // 헤더가 변경되었으면 진행 상황 메시지로 채팅 업데이트
                  callbacks.onChatUpdate(progressMessage)
                } else if (!chatText) {
                  // 진행 메시지가 없으면 기본 메시지 표시
                  callbacks.onChatUpdate(progressTracker.getLastMessage() || '기획서 작성 중...')
                }

                callbacks.onMarkdownUpdate(markdownContent)
              } else if (parts.length >= 3) {
                // markdown_content 태그가 열리고 닫힘
                chatText = parts[0] + (parts[2] || '')
                markdownContent = parts[1]
                callbacks.onChatUpdate(chatText)
                callbacks.onMarkdownUpdate(markdownContent)
              }
            }
          }
        },
      })

      // 디버그 로그 제거
      // console.log('전체 응답:', fullResponse.substring(0, 100) + '...')

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

  return { sendMessage }
}
