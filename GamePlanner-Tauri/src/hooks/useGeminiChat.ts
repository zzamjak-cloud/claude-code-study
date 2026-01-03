import { SYSTEM_INSTRUCTION } from '../lib/systemInstruction'
import { Message } from '../store/useAppStore'

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
      const contents: any[] = []

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

      // 3. 이전 대화 히스토리 추가 (최근 10개만)
      if (chatHistory && chatHistory.length > 0) {
        const recentHistory = chatHistory.slice(-10)
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

      console.log('📝 전달되는 컨텍스트:', {
        시스템지시문: '포함됨',
        현재기획서: currentMarkdown ? '포함됨 (' + currentMarkdown.length + '자)' : '없음',
        대화히스토리: chatHistory?.length || 0,
        총메시지수: contents.length
      })

      // Fetch API로 직접 호출 (스트리밍)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${cleanApiKey}`

      console.log('API 요청 시작...')

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API 오류 (${response.status}): ${errorText}`)
      }

      console.log('스트리밍 시작...')

      if (!response.body) {
        throw new Error('응답 스트림을 사용할 수 없습니다')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let fullResponse = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('스트리밍 완료')
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')

        // 마지막 불완전한 줄은 buffer에 남겨둠
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim()
            if (!jsonStr || jsonStr === '[DONE]') continue

            try {
              const data = JSON.parse(jsonStr)
              if (data.candidates && data.candidates[0]?.content?.parts) {
                const text = data.candidates[0].content.parts[0]?.text || ''
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
                    markdownContent = parts[1]
                    callbacks.onChatUpdate(chatText)
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
            } catch (e) {
              console.warn('JSON 파싱 오류:', e, jsonStr)
            }
          }
        }
      }

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

  return { sendMessage }
}
