import { SYSTEM_INSTRUCTION } from '../lib/systemInstruction'

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
    callbacks: StreamCallbacks
  ) => {
    try {
      // API Key 검증 및 정리
      const cleanApiKey = String(apiKey || '').trim()
      if (!cleanApiKey) {
        throw new Error('API Key가 비어있습니다')
      }

      // systemInstruction을 메시지에 포함
      const fullMessage = `${SYSTEM_INSTRUCTION}\n\n사용자 요청: ${message}`

      // 사용 가능한 모델 확인 (디버깅용)
      try {
        const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanApiKey}`
        const modelsResponse = await fetch(modelsUrl)
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json()
          console.log('사용 가능한 모델:', modelsData)

          // generateContent를 지원하는 모델 찾기
          const supportedModels = modelsData.models?.filter((m: any) =>
            m.supportedGenerationMethods?.includes('generateContent')
          )
          console.log('generateContent 지원 모델:', supportedModels?.map((m: any) => m.name))
        }
      } catch (e) {
        console.warn('모델 목록 조회 실패:', e)
      }

      // Fetch API로 직접 호출 (스트리밍)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${cleanApiKey}`

      console.log('API 요청 시작...')

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: fullMessage,
                },
              ],
            },
          ],
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
