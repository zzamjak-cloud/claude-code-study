// 이모지 데이터 유틸리티

import emojiData from '@emoji-mart/data/sets/15/native.json'

export interface EmojiItem {
  emoji: string
  name: string
  keywords: string[]
  category: string
}

export interface EmojiCategory {
  id: string
  name: string
  icon: string
}

// 카테고리 정의 (emoji-mart의 실제 ID 사용)
export const EMOJI_CATEGORIES: EmojiCategory[] = [
  { id: 'all', name: '전체', icon: '🔍' },
  { id: 'people', name: '사람', icon: '😀' },
  { id: 'nature', name: '자연', icon: '🐻' },
  { id: 'foods', name: '음식', icon: '🍕' },
  { id: 'activity', name: '활동', icon: '⚽' },
  { id: 'places', name: '장소', icon: '✈️' },
  { id: 'objects', name: '사물', icon: '💡' },
  { id: 'symbols', name: '기호', icon: '❤️' },
  { id: 'flags', name: '깃발', icon: '🏳️' },
]

// @emoji-mart/data를 우리 형식으로 변환
function convertEmojiMartData(): EmojiItem[] {
  const emojis: EmojiItem[] = []

  const emojisData = emojiData.emojis as Record<string, {
    id: string
    name: string
    keywords: string[]
    skins: Array<{ unified: string; native: string }>
    version: number
  }>

  for (const id in emojisData) {
    const item = emojisData[id]
    const skin = item.skins[0]
    if (!skin) continue

    // 카테고리 찾기 (중요: categories 배열에서 찾아야 함)
    let category = 'symbols' // 기본값
    for (const cat of emojiData.categories) {
      if (cat.emojis.includes(id)) {
        category = cat.id
        break
      }
    }

    emojis.push({
      emoji: skin.native, // 이모지 문자
      name: item.name || id, // 이모지 이름 (검색용)
      keywords: item.keywords || [], // 검색 키워드
      category: category, // 카테고리 ID
    })
  }

  return emojis
}

// 캐싱하여 성능 최적화
let cachedEmojiList: EmojiItem[] | null = null

export function getEmojiList(): EmojiItem[] {
  if (!cachedEmojiList) {
    cachedEmojiList = convertEmojiMartData()
  }
  return cachedEmojiList
}

// 카테고리별 필터링
export function getEmojisByCategory(categoryId: string): EmojiItem[] {
  const allEmojis = getEmojiList()

  if (categoryId === 'all') {
    return allEmojis
  }

  // 정확한 카테고리 매칭
  return allEmojis.filter(item => item.category === categoryId)
}

// 검색 기능 (이름 + 키워드 검색)
export function searchEmojis(query: string, categoryId?: string): EmojiItem[] {
  const emojis = categoryId ? getEmojisByCategory(categoryId) : getEmojiList()

  if (!query) {
    return emojis.slice(0, 100) // 기본 100개 표시
  }

  const lowerQuery = query.toLowerCase()
  return emojis.filter(item =>
    item.name.toLowerCase().includes(lowerQuery) ||
    item.keywords.some(keyword => keyword.toLowerCase().includes(lowerQuery))
  ).slice(0, 100) // 최대 100개까지
}
