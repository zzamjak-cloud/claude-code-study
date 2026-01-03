// 마크다운 관련 유틸리티

/**
 * 마크다운에서 게임명 추출 (기획서)
 */
export function extractGameNameFromPlanning(markdown: string): string | null {
  const match = markdown.match(/^🎮\s*\*\*(.+?)\s*게임\s*기획서\*\*/m)
  return match ? match[1].trim() : null
}

/**
 * 마크다운에서 게임명 추출 (분석 보고서)
 */
export function extractGameNameFromAnalysis(markdown: string): string | null {
  const match = markdown.match(/<!--\s*ANALYSIS_TITLE:\s*(.+?)\s*게임\s*분석\s*보고서\s*-->/m)
  return match ? match[1].trim() : null
}

/**
 * 마크다운에서 HTML 주석 제거
 */
export function removeHtmlComments(markdown: string): string {
  return markdown.replace(/<!--[\s\S]*?-->/g, '')
}

/**
 * 마크다운에서 Google Search 출처 참조 번호 제거
 */
export function removeCitationNumbers(markdown: string): string {
  return markdown.replace(/\[\d+(?:,\s*\d+)*\]/g, '')
}

