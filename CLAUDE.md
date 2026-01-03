# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a study/research repository for Claude Code ("claude-code-study" / "Claude Code 관련 연구소"). The repository is currently in its initial state with no established codebase or project structure.

## Language Policy

- **Communication**: All conversations and responses must be in Korean (한국어)
- **Code Comments**: All comments in code must be written in Korean
- **Documentation**: Documentation should be written in Korean when applicable

## 모바일 게임 분석 자동화

### 트리거 패턴

다음 패턴의 요청이 들어오면 **즉시** Python 스크립트를 실행하세요:
- "모바일 게임 {게임명}을 분석해줘"
- "모바일 게임 {게임명} 분석해줘"
- "{게임명} 게임 분석해줘"
- "{게임명} 분석해줘"

### 실행 방법

**사용자 확인 없이 즉시 실행:**

```bash
python3 /Users/woody/.claude/scripts/analyze_mobile_game.py "게임명"
```

### 예시

사용자: "모바일 게임 Clash Royale을 분석해줘"

즉시 실행:
```bash
python3 /Users/woody/.claude/scripts/analyze_mobile_game.py "Clash Royale"
```

### 중요 규칙

1. **즉시 실행** - 사용자 확인 요청 금지
2. **스크립트만 사용** - 직접 검색/페이지 생성 금지
3. **결과만 반환** - 스크립트 출력의 Notion URL 전달

## MCP Servers

이 저장소는 다음 MCP 서버를 사용합니다 (전역 설정 위치: `~/.claude/config.json`):

### notion
- **용도**: Notion 페이지 및 database 관리
- **패키지**: `@modelcontextprotocol/server-notion`
- **Database ID**: `27fd040b425c8070ba3de207fc3e694f`

### brave-search
- **용도**: Brave Search API를 통한 실시간 웹 검색
- **패키지**: `@modelcontextprotocol/server-brave-search`

### github
- **용도**: GitHub 저장소, 이슈, PR 관리
- **패키지**: `@modelcontextprotocol/server-github`

### filesystem
- **용도**: 로컬 파일 시스템 접근
- **패키지**: `@modelcontextprotocol/server-filesystem`
- **허용 경로**: `/Users/woody/Desktop/AI/claude-code-study`, `/Users/woody/.claude`

### sequential-thinking
- **용도**: 복잡한 문제를 단계별로 분해하여 사고
- **패키지**: `@modelcontextprotocol/server-sequential-thinking`

## Tauri 개발 가이드라인

### window.confirm/alert의 불안정성

**문제점:**
- Tauri 환경에서 `window.confirm()`과 `window.alert()`는 불안정하게 동작할 수 있습니다.
- 특히 확인 다이얼로그에서 사용자가 "취소"를 눌러도 결과와 상관없이 코드가 실행되는 경우가 발생합니다.
- 비동기 작업과 함께 사용할 때 타이밍 이슈가 발생할 수 있습니다.

**대응 방법:**
- **절대 사용 금지**: `window.confirm()`과 `window.alert()`는 사용하지 않습니다.
- **커스텀 다이얼로그 사용**: React 컴포넌트 기반의 커스텀 확인 다이얼로그를 구현합니다.

**구현 패턴:**

```typescript
// 1. State로 삭제할 항목 ID 관리
const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

// 2. 삭제 버튼 클릭 시 다이얼로그만 표시
const handleDelete = (id: string) => {
  setDeleteConfirm(id)
}

// 3. 취소 함수
const cancelDelete = () => {
  setDeleteConfirm(null)
}

// 4. 확인 함수 (실제 삭제 로직)
const confirmDelete = () => {
  if (!deleteConfirm) return
  
  // 실제 삭제 로직 실행
  // ...
  
  setDeleteConfirm(null)
}

// 5. JSX에서 조건부 렌더링
{deleteConfirm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
      <h3 className="text-lg font-semibold mb-2">삭제 확인</h3>
      <p className="text-muted-foreground mb-6">
        정말 삭제하시겠습니까?<br />
        이 작업은 되돌릴 수 없습니다.
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={cancelDelete}
          className="px-4 py-2 rounded-lg bg-muted hover:bg-accent transition-colors font-medium"
        >
          취소
        </button>
        <button
          onClick={confirmDelete}
          className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium"
        >
          삭제
        </button>
      </div>
    </div>
  </div>
)}
```

**참고 예시:**
- `GamePlanner-Tauri/src/components/Sidebar.tsx` - 세션 삭제 확인
- `GamePlanner-Tauri/src/components/TemplateManagerModal.tsx` - 템플릿 삭제 확인
- `GamePlanner-Tauri/src/components/ReferenceManager.tsx` - 참조 파일 삭제 확인

**주의사항:**
- 모달 배경 클릭 시 취소 처리 (`onClick={(e) => e.stopPropagation()}`)
- z-index 관리 (다른 모달과 겹치지 않도록)
- 상태 초기화 (확인/취소 후 `setDeleteConfirm(null)`)

### 이모지 확장 기능 구현

**문제점:**
- 이모지 데이터를 수천 개의 코드로 직접 입력하는 방식은 유지보수가 어렵고 비효율적입니다.
- 필터링 시 카테고리 매칭이 제대로 되지 않는 문제가 발생합니다.
- 텍스트 에디터에서 이모지를 빠르게 검색하고 삽입하는 기능이 필요합니다.

**대응 방법:**

#### 1. 이모지 데이터 패키지 사용

**절대 하지 말 것:**
- 이모지 데이터를 수천 개의 코드로 직접 입력하지 않습니다.

**올바른 방법:**
- `@emoji-mart/data` 패키지를 설치하여 사용합니다.

```bash
npm install @emoji-mart/data
```

**데이터 변환 패턴:**

```typescript
// src/lib/emojiData.ts
import emojiData from '@emoji-mart/data/sets/15/native.json'

interface EmojiItem {
  emoji: string
  name: string
  keywords: string[]
  category: string
}

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
```

#### 2. 카테고리 필터링 및 정렬

**문제:**
- 카테고리 ID가 일치하지 않아 필터링이 제대로 작동하지 않습니다.
- `emoji-mart`의 카테고리 ID와 우리가 정의한 카테고리 ID가 다를 수 있습니다.

**해결 방법:**
- `emojiData.categories` 배열을 직접 순회하여 정확한 카테고리를 찾습니다.
- 카테고리 정의는 `emoji-mart`의 실제 카테고리 ID를 사용합니다.

```typescript
// 카테고리 정의 (emoji-mart의 실제 ID 사용)
export const EMOJI_CATEGORIES: EmojiCategory[] = [
  { id: 'all', name: '전체', icon: '🔍' },
  { id: 'people', name: '사람 & 감정', icon: '😀' },
  { id: 'nature', name: '동물 & 자연', icon: '🐻' },
  { id: 'foods', name: '음식 & 음료', icon: '🍕' },
  { id: 'activity', name: '활동', icon: '⚽' },
  { id: 'places', name: '여행 & 장소', icon: '✈️' },
  { id: 'objects', name: '사물', icon: '💡' },
  { id: 'symbols', name: '기호', icon: '❤️' },
  { id: 'flags', name: '깃발', icon: '🏳️' },
]

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
```

#### 3. 텍스트 에디터에서 ":" 키 입력 시 빠른 검색

**구현 방법:**
- Tiptap의 `Mention` extension을 사용합니다.
- `char: ':'`로 설정하여 ":" 입력 시 이모지 검색 팝업을 표시합니다.

```typescript
// Tiptap 에디터 설정
import Mention from '@tiptap/extension-mention'
import { ReactRenderer } from '@tiptap/react'
import tippy, { Instance as TippyInstance } from 'tippy.js'
import { searchEmojis, EmojiItem } from '../lib/emojiData'

// 이모지 리스트 컴포넌트
const EmojiList = React.forwardRef<EmojiListRef, EmojiListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  React.useEffect(() => {
    setSelectedIndex(0)
  }, [props.items])

  const selectItem = (index: number) => {
    const item = props.items[index]
    if (item) {
      props.command(item)
    }
  }

  React.useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
      {props.items.map((item, index) => (
        <button
          key={index}
          onClick={() => selectItem(index)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
            index === selectedIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
          }`}
        >
          <span className="text-xl">{item.emoji}</span>
          <span className="flex-1">{item.name}</span>
        </button>
      ))}
    </div>
  )
})

// Tiptap 에디터에 Mention extension 추가
const editor = useEditor({
  extensions: [
    StarterKit,
    Mention.configure({
      HTMLAttributes: {
        class: 'mention',
      },
      suggestion: {
        char: ':', // ":" 입력 시 트리거
        items: ({ query }) => {
          return searchEmojis(query) // 검색어로 이모지 필터링
        },
        render: () => {
          let component: ReactRenderer<EmojiListRef, EmojiListProps>
          let popup: TippyInstance[]

          return {
            onStart: (props: any) => {
              const clientRect = props.clientRect || (() => new DOMRect())
              const editor = props.editor
              
              component = new ReactRenderer(EmojiList, {
                props: {
                  items: searchEmojis(''),
                  command: (item: EmojiItem) => {
                    editor.commands.insertContent(item.emoji)
                  },
                },
                editor: editor,
              })

              popup = tippy('body', {
                getReferenceClientRect: clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              })
            },
            onUpdate(props: any) {
              const clientRect = props.clientRect || (() => new DOMRect())
              component.updateProps({
                items: searchEmojis(props.query || ''),
                command: (item: EmojiItem) => {
                  editor?.commands.insertContent(item.emoji)
                },
              })
              popup[0].setProps({
                getReferenceClientRect: clientRect,
              })
            },
            onKeyDown(props: any) {
              if (props.event?.key === 'Escape') {
                popup[0].hide()
                return true
              }
              return component.ref?.onKeyDown?.(props) ?? false
            },
            onExit() {
              popup[0].destroy()
              component.destroy()
            },
          }
        },
      },
    }),
  ],
})
```

**주요 포인트:**
- `char: ':'` - ":" 입력 시 트리거
- `items: ({ query }) => searchEmojis(query)` - 검색어로 이모지 필터링
- `onUpdate`에서 `props.query`를 사용하여 실시간 검색
- 키보드 네비게이션 (ArrowUp/Down, Enter) 지원
- Tippy.js를 사용한 팝업 위치 관리

**참고 예시:**
- `GamePlanner-Tauri/src/lib/emojiData.ts` - 이모지 데이터 변환 및 검색
- `GamePlanner-Tauri/src/components/TemplateEditorModal.tsx` - Tiptap Mention extension 구현
- `GamePlanner-Tauri/src/components/TemplateEditor/EmojiPicker.tsx` - 이모지 피커 UI

**주의사항:**
- 카테고리 ID는 `emoji-mart`의 실제 ID를 사용해야 합니다 (`people`, `nature`, `foods` 등).
- 데이터 변환 시 `emojiData.categories` 배열을 순회하여 정확한 카테고리를 찾아야 합니다.
- 이모지 리스트는 캐싱하여 성능을 최적화합니다.
- 검색 결과는 최대 100개로 제한하여 UI 성능을 유지합니다.

## Notes

- This repository does not yet contain a defined project structure or build system
- No dependencies, build commands, or test frameworks have been configured
- The repository is a blank slate for experimenting with Claude Code features and workflows
