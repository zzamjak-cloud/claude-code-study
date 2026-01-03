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
 * 마크다운 텍스트를 Notion 블록 배열로 변환 (중첩 리스트 지원, 최대 2단계)
 */
export function markdownToNotionBlocks(markdown: string, _gameName: string): NotionBlock[] {
  if (!markdown) {
    return []
  }

  const lines = markdown.split('\n')
  const result = processLines(lines, 0, lines.length, 0)
  return result.blocks
}

/**
 * 라인 배열을 처리하여 Notion 블록으로 변환 (재귀적으로 중첩 처리, 최대 깊이 제한)
 */
function processLines(lines: string[], startIdx: number, endIdx: number, currentDepth: number): { blocks: NotionBlock[], nextIdx: number } {
  const blocks: NotionBlock[] = []
  let i = startIdx

  while (i < endIdx) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // 빈 줄 건너뛰기
    if (!trimmedLine) {
      i++
      continue
    }

    // HTML 주석 건너뛰기
    if (trimmedLine.startsWith('<!--')) {
      i++
      continue
    }

    const truncatedLine = trimmedLine.length > 2000 ? trimmedLine.substring(0, 1997) + '...' : trimmedLine

    // 게임 제목 (일반 텍스트로 처리) - "🎮 **게임명 게임 기획서**"
    if (truncatedLine.match(/^🎮\s*\*\*.+?\*\*/)) {
      const richText = parseInlineFormatting(truncatedLine)
      if (richText.length > 0) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: richText,
          },
        })
      }
      i++
      continue
    }

    // H1 헤더
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
      i++
    }
    // H2 헤더
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
      i++
    }
    // H3 헤더
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
      i++
    }
    // 수평선 (---, ***, ___)
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmedLine)) {
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {},
      })
      i++
    }
    // 목록 항목 (중첩 지원, 최대 2단계, - 또는 * 모두 지원)
    else if (/^[-*]\s/.test(trimmedLine)) {
      const result = processListItem(lines, i, endIdx, getIndentLevel(line), currentDepth)
      if (result.block) {
        blocks.push(result.block)
      }
      i = result.nextIdx
    }
    // 번호 매기기 목록
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
      i++
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
      i++
    }
  }

  return { blocks, nextIdx: i }
}

/**
 * 들여쓰기 레벨 계산 (공백 2개 또는 탭 1개 = 1레벨)
 */
function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/)
  if (!match || !match[1]) return 0

  const indent = match[1]
  let level = 0

  for (let i = 0; i < indent.length; i++) {
    if (indent[i] === '\t') {
      level++
    } else if (indent[i] === ' ') {
      // 공백 2개를 1레벨로 계산
      if (i + 1 < indent.length && indent[i + 1] === ' ') {
        level++
        i++ // 다음 공백 건너뛰기
      }
    }
  }

  return level
}

/**
 * 리스트 항목과 그 하위 항목들을 처리 (최대 2단계 중첩)
 */
function processListItem(lines: string[], startIdx: number, endIdx: number, currentIndent: number, currentDepth: number): { block: NotionBlock | null, nextIdx: number } {
  const line = lines[startIdx]
  const trimmedLine = line.trim()
  // "- " 또는 "* " 제거
  const text = trimmedLine.replace(/^[-*]\s/, '').trim()
  const truncatedText = text.length > 2000 ? text.substring(0, 1997) + '...' : text

  if (!truncatedText) {
    return {
      block: null,
      nextIdx: startIdx + 1,
    }
  }

  const richText = parseInlineFormatting(truncatedText)
  const children: NotionBlock[] = []

  // Notion API는 최대 2단계 중첩만 지원 (depth 0, 1만 children 허용)
  const maxDepth = 1

  // 다음 라인부터 하위 항목 찾기
  let i = startIdx + 1
  while (i < endIdx) {
    const nextLine = lines[i]
    const nextTrimmed = nextLine.trim()

    // 빈 줄은 건너뛰기
    if (!nextTrimmed) {
      i++
      continue
    }

    const nextIndent = getIndentLevel(nextLine)

    // 들여쓰기가 더 깊으면 하위 항목
    if (nextIndent > currentIndent) {
      if (/^[-*]\s/.test(nextTrimmed)) {
        // 현재 깊이가 최대 깊이보다 작을 때만 children 추가
        if (currentDepth < maxDepth) {
          const result = processListItem(lines, i, endIdx, nextIndent, currentDepth + 1)
          if (result.block) {
            children.push(result.block)
          }
          i = result.nextIdx
        } else {
          // 최대 깊이를 초과하면 현재 레벨로 평탄화
          const flatText = nextTrimmed.replace(/^[-*]\s/, '').trim()
          if (flatText) {
            const flatRichText = parseInlineFormatting(flatText)
            children.push({
              object: 'block',
              type: 'bulleted_list_item',
              bulleted_list_item: {
                rich_text: flatRichText,
              },
            })
          }
          i++
        }
      } else {
        // 리스트가 아닌 다른 블록은 무시하고 계속
        i++
      }
    } else {
      // 같거나 낮은 들여쓰기면 현재 항목 종료
      break
    }
  }

  const block: NotionBlock = {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: richText,
    },
  }

  // 하위 항목이 있으면 children 추가
  if (children.length > 0) {
    block.bulleted_list_item.children = children
  }

  return { block, nextIdx: i }
}

/**
 * 인라인 서식 파싱 (굵게, 링크 등)
 */
function parseInlineFormatting(text: string): any[] {
  const richText: any[] = []

  // 혼합 패턴: **굵은 텍스트**, [링크 텍스트](URL)
  // 링크와 볼드를 모두 찾아서 순서대로 처리
  const combinedPattern = /(\*\*(.+?)\*\*)|(\[([^\]]+)\]\(([^\)]+)\))/g
  let lastIndex = 0
  let match

  while ((match = combinedPattern.exec(text)) !== null) {
    // 매칭 이전의 일반 텍스트
    if (match.index > lastIndex) {
      const normalText = text.substring(lastIndex, match.index)
      if (normalText) {
        richText.push({
          type: 'text',
          text: { content: normalText },
        })
      }
    }

    // **굵은 텍스트**인 경우
    if (match[2]) {
      richText.push({
        type: 'text',
        text: { content: match[2] },
        annotations: { bold: true },
      })
    }
    // [링크 텍스트](URL)인 경우
    else if (match[4] && match[5]) {
      richText.push({
        type: 'text',
        text: {
          content: match[4],
          link: { url: match[5] }
        },
      })
    }

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
  databaseId: string,
  isAnalysisMode: boolean = false
): Promise<string> {
  const blocks = markdownToNotionBlocks(markdown, gameName)

  // 게임명 추출 (게임 기획서 또는 게임 분석)
  let title = gameName
  console.log('📋 제목 추출 시작:', {
    gameName,
    isAnalysisMode,
    markdownStart: markdown.substring(0, 100)
  })

  if (isAnalysisMode) {
    // 분석 보고서: "<!-- ANALYSIS_TITLE: 게임명 게임 분석 보고서 -->" 패턴
    const titleMatch = markdown.match(/<!--\s*ANALYSIS_TITLE:\s*(.+?)\s*게임\s*분석\s*보고서\s*-->/m)
    if (titleMatch) {
      title = titleMatch[1].trim()
      console.log('✅ 분석 보고서 제목 추출 성공:', title)
    } else {
      console.log('⚠️ 분석 보고서 제목 추출 실패 - gameName 사용')
    }
  } else {
    // 기획서: "🎮 **게임명 게임 기획서**" 패턴
    const titleMatch = markdown.match(/^🎮\s*\*\*(.+?)\s*게임\s*기획서\*\*/m)
    if (titleMatch) {
      title = titleMatch[1].trim()
      console.log('✅ 기획서 제목 추출 성공:', title)
    } else {
      console.log('⚠️ 기획서 제목 추출 실패 - gameName 사용')
    }
  }

  // 페이지 타입에 따른 제목 접미사
  const titleSuffix = isAnalysisMode ? '게임 분석' : '게임 기획서'

  // Database ID를 UUID 형식으로 변환
  const formattedDbId = formatDatabaseId(databaseId)

  console.log('📝 노션 페이지 생성 중...')
  console.log(`   제목: ${title} : ${titleSuffix}`)
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
              content: `${title} : ${titleSuffix}`,
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
