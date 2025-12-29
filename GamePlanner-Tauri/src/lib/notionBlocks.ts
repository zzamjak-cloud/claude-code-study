/**
 * 마크다운을 Notion 블록으로 변환하는 유틸리티
 */

import { fetch } from '@tauri-apps/plugin-http'

interface NotionBlock {
  object: string
  type: string
  [key: string]: any
}

/**
 * 마크다운 텍스트를 Notion 블록 배열로 변환
 */
export function markdownToNotionBlocks(markdown: string, _gameName: string): NotionBlock[] {
  if (!markdown) {
    return []
  }

  const blocks: NotionBlock[] = []
  const lines = markdown.split('\n')

  // console.log(`📋 마크다운 파싱 시작: ${lines.length}줄`)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // 빈 줄 무시
    if (!line) {
      continue
    }

    // 텍스트가 너무 긴 경우 자르기 (Notion API 제한: rich_text는 2000자)
    const truncatedLine = line.length > 2000 ? line.substring(0, 1997) + '...' : line

    // H1 헤더 (# )
    if (truncatedLine.startsWith('# ')) {
      const text = truncatedLine.substring(2).trim()
      if (text) {
        blocks.push({
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ type: 'text', text: { content: text } }],
          },
        })
      }
    }
    // H2 헤더 (## )
    else if (truncatedLine.startsWith('## ')) {
      const text = truncatedLine.substring(3).trim()
      if (text) {
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: text } }],
          },
        })
      }
    }
    // H3 헤더 (### )
    else if (truncatedLine.startsWith('### ')) {
      const text = truncatedLine.substring(4).trim()
      if (text) {
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ type: 'text', text: { content: text } }],
          },
        })
      }
    }
    // 수평선 (---)
    else if (truncatedLine.startsWith('---')) {
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {},
      })
    }
    // 목록 항목 (- )
    else if (truncatedLine.startsWith('- ')) {
      const text = truncatedLine.substring(2).trim()
      if (text) {
        // **굵은 텍스트** 파싱
        const richText = parseInlineFormatting(text)
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: richText,
          },
        })
      }
    }
    // 번호 매기기 목록 (1. )
    else if (/^\d+\.\s/.test(truncatedLine)) {
      const text = truncatedLine.replace(/^\d+\.\s/, '').trim()
      if (text) {
        const richText = parseInlineFormatting(text)
        blocks.push({
          object: 'block',
          type: 'numbered_list_item',
          numbered_list_item: {
            rich_text: richText,
          },
        })
      }
    }
    // 일반 문단
    else {
      const richText = parseInlineFormatting(truncatedLine)
      if (richText.length > 0 && richText[0].text.content) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: richText,
          },
        })
      }
    }
  }

  // console.log(`✅ 총 ${blocks.length}개 블록 생성 완료`)
  return blocks
}

/**
 * 인라인 서식 파싱 (굵게, 기울임 등)
 */
function parseInlineFormatting(text: string): any[] {
  const richText: any[] = []

  // **굵은 텍스트** 파싱
  const boldPattern = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match

  while ((match = boldPattern.exec(text)) !== null) {
    // 굵은 텍스트 이전의 일반 텍스트
    if (match.index > lastIndex) {
      const normalText = text.substring(lastIndex, match.index)
      if (normalText) {
        richText.push({
          type: 'text',
          text: { content: normalText },
        })
      }
    }

    // 굵은 텍스트
    richText.push({
      type: 'text',
      text: { content: match[1] },
      annotations: { bold: true },
    })

    lastIndex = match.index + match[0].length
  }

  // 남은 일반 텍스트
  if (lastIndex < text.length) {
    const normalText = text.substring(lastIndex)
    if (normalText) {
      richText.push({
        type: 'text',
        text: { content: normalText },
      })
    }
  }

  // 파싱된 텍스트가 없으면 원본 텍스트 반환
  if (richText.length === 0) {
    return [{ type: 'text', text: { content: text } }]
  }

  return richText
}

/**
 * Database ID를 UUID 형식으로 변환
 * 예: 2d7d040b425c8028a1a9f489c2e0657e -> 2d7d040b-425c-8028-a1a9-f489c2e0657e
 */
function formatDatabaseId(id: string): string {
  // 이미 하이픈이 있으면 그대로 반환
  if (id.includes('-')) {
    return id
  }

  // 하이픈 없는 32자리 ID를 UUID 형식으로 변환
  if (id.length === 32) {
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`
  }

  return id
}

/**
 * 페이지에 추가 블록 append
 */
async function appendBlocks(
  pageId: string,
  blocks: NotionBlock[],
  notionToken: string
): Promise<void> {
  const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ children: blocks }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('❌ 블록 추가 실패:', error)
    throw new Error(`블록 추가 실패: ${response.status} - ${error}`)
  }
}

/**
 * Notion API를 통해 페이지 생성
 */
export async function createNotionPage(
  gameName: string,
  markdown: string,
  notionToken: string,
  databaseId: string
): Promise<string> {
  const blocks = markdownToNotionBlocks(markdown, gameName)

  // 게임명 추출
  const titleMatch = markdown.match(/^#\s*🎮\s*(.+?)\s*게임\s*기획서/m)
  const title = titleMatch ? titleMatch[1].trim() : gameName

  // Database ID를 UUID 형식으로 변환
  const formattedDbId = formatDatabaseId(databaseId)

  console.log('📝 노션 페이지 생성 중...')
  console.log(`   제목: ${title} : 게임 기획서`)
  console.log(`   전체 블록: ${blocks.length}개`)

  // 첫 100개 블록으로 페이지 생성
  const initialBlocks = blocks.slice(0, 100)
  const remainingBlocks = blocks.slice(100)

  if (remainingBlocks.length > 0) {
    console.log(`   (초기 ${initialBlocks.length}개 + 추가 ${remainingBlocks.length}개 블록)`)
  }

  const payload = {
    parent: {
      database_id: formattedDbId,
    },
    properties: {
      이름: {
        title: [
          {
            text: {
              content: `${title} : 게임 기획서`,
            },
          },
        ],
      },
    },
    children: initialBlocks,
  }

  try {
    // 1. 페이지 생성
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ Notion API 오류:', error)
      throw new Error(`Notion API 오류: ${response.status} - ${error}`)
    }

    const result = await response.json()
    const pageId = result.id
    const pageUrl = result.url || ''

    console.log('✅ 페이지 생성 성공!')

    // 2. 나머지 블록들을 100개씩 추가
    if (remainingBlocks.length > 0) {
      console.log(`🔄 나머지 ${remainingBlocks.length}개 블록 추가 중...`)

      for (let i = 0; i < remainingBlocks.length; i += 100) {
        const chunk = remainingBlocks.slice(i, i + 100)
        await appendBlocks(pageId, chunk, notionToken)

        // API 속도 제한을 피하기 위해 약간의 지연
        if (i + 100 < remainingBlocks.length) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }

      console.log('✅ 전체 블록 저장 완료!')
    }

    return pageUrl
  } catch (error) {
    console.error('❌ Notion 페이지 생성 실패:', error)
    throw error
  }
}
