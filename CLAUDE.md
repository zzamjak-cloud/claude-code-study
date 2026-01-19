# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a study/research repository for Claude Code ("claude-code-study" / "Claude Code 관련 연구소"). The repository contains various projects and experimental implementations.

### 프로젝트별 참조 문서

#### Style Studio (StyleStudio-Tauri)

Style Studio 관련 수정 및 개선 작업 시 **반드시** 다음 문서를 참조하세요:

- **구현 현황 문서**: `/Users/woody/Desktop/AI/claude-code-study/Plans/STYLE_STUDIO_IMPLEMENTATION_STATUS.md`

이 문서에는 다음 정보가 포함되어 있습니다:
- 프로젝트 개요 및 목표
- 시스템 아키텍처
- Phase별 구현 현황 (Phase 1, Phase 2 완료)
- 번역 및 세션 저장 시스템
- 핵심 컴포넌트 및 데이터 구조
- 프롬프트 엔지니어링 가이드
- 알려진 이슈 및 제한사항
- 파일 구조 및 개발 팁

**중요**: Style Studio의 모든 수정 작업 전에 이 문서를 먼저 읽고 현재 구현 상태와 설계 의도를 파악하세요.

#### Game Planner (GamePlanner-Tauri)

Game Planner 관련 수정 및 개선 작업 시 **반드시** 다음 문서를 참조하세요:

- **구현 현황 문서**: `/Users/woody/Desktop/AI/claude-code-study/Plans/GAMEPLANNER_IMPLEMENTATION_STATUS.md`

이 문서에는 다음 정보가 포함되어 있습니다:
- 프로젝트 개요 및 목표 (게임 기획서 작성 및 분석)
- 시스템 아키텍처
- Phase별 구현 현황 (Phase 1~3.6 완료)
- 템플릿 시스템 (Tiptap 기반 리치 에디터)
- 참조 파일 관리 (PDF, Excel, CSV, Markdown 지원)
- 버전 히스토리 및 비교 기능
- 핵심 컴포넌트 및 데이터 구조
- Notion 연동 기능
- 프롬프트 엔지니어링 가이드
- 알려진 이슈 및 제한사항
- 파일 구조 및 개발 팁

**중요**: Game Planner의 모든 수정 작업 전에 이 문서를 먼저 읽고 현재 구현 상태와 설계 의도를 파악하세요.

#### Team Scheduler (TeamScheduler)

Team Scheduler 관련 수정 및 개선 작업 시 **반드시** 다음 문서를 참조하세요:

- **구현 현황 문서**: `/Users/woody/Desktop/AI/claude-code-study/Plans/TEAMSCHEDULER_IMPLEMENTATION_STATUS.md`

이 문서에는 다음 정보가 포함되어 있습니다:
- 프로젝트 개요 및 목표 (팀 스케줄 관리)
- 시스템 아키텍처
- Firebase 연동 (Firestore, Authentication)
- 핵심 컴포넌트 및 데이터 구조
- 권한 시스템
- 알려진 이슈 및 제한사항
- 파일 구조 및 개발 팁

**중요**: Team Scheduler의 모든 수정 작업 전에 이 문서를 먼저 읽고 현재 구현 상태와 설계 의도를 파악하세요.

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

### 드래그 앤 드롭 구현

**문제점:**
- Tauri 환경에서 웹 기반 드래그 앤 드롭 이벤트(`onDragEnter`, `onDragOver`, `onDrop`)는 작동하지 않습니다.
- `event.dataTransfer.files`로는 실제 파일 경로를 가져올 수 없습니다.
- 파일 시스템 접근 권한 문제로 파일을 읽을 수 없는 경우가 많습니다.

**대응 방법:**
- **Tauri의 네이티브 API 사용**: `getCurrentWindow().onDragDropEvent()` 사용
- **실제 파일 경로 접근**: `event.payload.paths`로 파일 시스템 경로 획득
- **앱 외부와 내부 드래그 앤 드롭 구분**: 각각 다른 방식으로 구현

#### 1. 앱 외부로부터의 드래그 앤 드롭 (탐색기 → 앱)

**사용 사례:**
- 탐색기에서 파일을 드래그하여 앱에 드롭
- 다른 애플리케이션에서 파일을 드래그하여 앱에 드롭

**구현 방법: Tauri API 사용**

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window'

useEffect(() => {
  let unlisten: (() => void) | undefined

  const setupDragDropListener = async () => {
    try {
      const appWindow = getCurrentWindow()

      unlisten = await appWindow.onDragDropEvent(async (event) => {
        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          // 드래그 진입/호버 시 시각적 피드백
          setIsDragging(true)
        } else if (event.payload.type === 'leave') {
          // 드래그 영역 벗어날 때
          setIsDragging(false)
        } else if (event.payload.type === 'drop') {
          // 파일 드롭 시
          setIsDragging(false)

          // 드롭된 파일 경로 가져오기 (핵심!)
          const paths = event.payload.paths || []
          if (paths.length > 0) {
            // 파일 확장자 검증
            const supportedExtensions = ['pdf', 'xlsx', 'xls', 'csv', 'md', 'txt']
            const validFiles: string[] = []

            for (const filePath of paths) {
              const extension = filePath.split('.').pop()?.toLowerCase() || ''
              if (supportedExtensions.includes(extension)) {
                validFiles.push(filePath)
              } else {
                alert(`지원하지 않는 파일 형식: ${filePath}`)
              }
            }

            if (validFiles.length > 0) {
              await processFiles(validFiles)
            }
          }
        }
      })

      console.log('✅ 드래그 앤 드롭 리스너 등록 완료')
    } catch (error) {
      console.error('❌ 드래그 앤 드롭 리스너 등록 실패:', error)
    }
  }

  setupDragDropListener()

  // 클린업
  return () => {
    if (unlisten) {
      unlisten()
    }
  }
}, []) // 의존성 배열 주의: 필요한 상태만 포함
```

**파일 처리 함수 예시:**

```typescript
const processFiles = async (filePaths: string[]) => {
  for (const filePath of filePaths) {
    try {
      // Tauri의 fs 플러그인 사용
      const fileData = await readFile(filePath)

      // 파일 파싱 (PDF, Excel 등)
      const parsed = await parseFile(filePath, fileName)

      // 상태 업데이트
      setFiles(prev => [...prev, parsed])
    } catch (error) {
      console.error('파일 처리 실패:', error)
    }
  }
}
```

**시각적 피드백 UI:**

```tsx
return (
  <div
    className={`relative border rounded-lg p-4 transition-all ${
      isDragging
        ? 'border-primary border-2 bg-primary/5'
        : 'border-border'
    }`}
  >
    {/* 드래그 오버레이 */}
    {isDragging && (
      <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg z-10 pointer-events-none">
        <div className="bg-card border-2 border-primary border-dashed rounded-lg px-6 py-4">
          <p className="text-lg font-semibold text-primary">파일을 여기에 드롭하세요</p>
          <p className="text-sm text-muted-foreground mt-1">PDF, Excel, CSV 등 지원</p>
        </div>
      </div>
    )}

    {/* 기존 컨텐츠 */}
    <div>...</div>
  </div>
)
```

#### 2. 앱 내부에서의 드래그 앤 드롭 (앱 요소 → 앱 요소)

**사용 사례:**
- 리스트 항목 순서 변경 (재정렬)
- 파일/폴더 트리에서 이동
- 캔버스에서 요소 이동

**구현 방법: 웹 표준 API 사용 (HTML5 Drag and Drop)**

```typescript
// 드래그 가능한 항목
const DraggableItem = ({ item, index, onReorder }) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="cursor-move"
    >
      {item.name}
    </div>
  )
}

// 드롭 영역
const DropZone = ({ onDrop }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault() // 필수: 드롭 허용
    e.dataTransfer.dropEffect = 'move'
    setIsDraggingOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    setIsDraggingOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)

    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'))
    onDrop(draggedIndex)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={isDraggingOver ? 'bg-blue-100' : ''}
    >
      Drop here
    </div>
  )
}
```

#### 3. 앱 외부 vs 내부 드래그 앤 드롭 비교

| 구분 | 앱 외부 (탐색기 → 앱) | 앱 내부 (앱 요소 → 앱 요소) |
|------|---------------------|----------------------|
| **API** | Tauri `onDragDropEvent` | 웹 표준 `onDragStart`, `onDrop` |
| **데이터 접근** | `event.payload.paths` (파일 경로) | `event.dataTransfer.setData/getData` |
| **리스너 등록** | `useEffect`에서 전역 등록 | 각 요소에 이벤트 핸들러 |
| **파일 시스템** | 직접 접근 가능 | 접근 불가 |
| **사용 예시** | 파일 업로드, 이미지 드롭 | 리스트 재정렬, 요소 이동 |

**핵심 차이점:**
- **앱 외부**: Tauri API 필수, 실제 파일 경로 필요
- **앱 내부**: 웹 표준 API 사용, 메모리 내 데이터만 전달

#### 4. 주의사항

**앱 외부 드래그 앤 드롭:**
- `useEffect` 의존성 배열에 필요한 상태만 포함 (무한 루프 방지)
- `unlisten()` 함수를 반드시 클린업에서 호출
- 파일 확장자 검증 필수
- 파일 크기 제한 고려
- `event.payload.paths`는 항상 배열 (단일 파일도 배열)

**앱 내부 드래그 앤 드롭:**
- `onDragOver`에서 반드시 `e.preventDefault()` 호출 (드롭 허용)
- `draggable` 속성을 `true`로 설정
- `setData`와 `getData`의 타입은 문자열만 가능
- 복잡한 데이터는 JSON 직렬화 필요

**참고 예시:**
- `StyleStudio-Tauri/src/components/generator/ImageUpload.tsx` - 앱 외부 드래그 앤 드롭 (이미지)
- `GamePlanner-Tauri/src/components/ReferenceManager.tsx` - 앱 외부 드래그 앤 드롭 (문서)
- `GamePlanner-Tauri/src/components/Sidebar.tsx` - 앱 내부 드래그 앤 드롭 (세션 재정렬, 향후 구현 예정)

## Super Claude 슬래시 명령어 자동 사용 가이드

Super Claude가 설치되어 있으며, 작업 상황에 따라 적절한 슬래시 명령어를 **자동으로 판단하여 사용**합니다.

### 명령어 자동 사용 기준

다음 상황에서 해당 명령어를 자동으로 실행합니다:

| 상황 | 자동 실행 명령어 | 트리거 조건 |
|------|-----------------|------------|
| **코드 분석 필요** | `/sc:analyze` | 코드 품질, 보안, 성능, 아키텍처 분석 요청 시 |
| **기능 구현** | `/sc:implement` | 새로운 기능 구현, 코드 작성 요청 시 |
| **테스트 실행** | `/sc:test` | 테스트 실행, 커버리지 분석 요청 시 |
| **빌드/컴파일** | `/sc:build` | 프로젝트 빌드, 패키징 요청 시 |
| **Git 커밋** | `/sc:git` | 변경사항 커밋, Git 작업 요청 시 |
| **문서 생성** | `/sc:document` | API, 컴포넌트, 함수 문서화 요청 시 |
| **코드 개선** | `/sc:improve` | 코드 품질, 성능, 유지보수성 개선 요청 시 |
| **문제 해결** | `/sc:troubleshoot` | 버그, 빌드 오류, 배포 문제 진단 요청 시 |
| **설계/아키텍처** | `/sc:design` | 시스템 아키텍처, API 설계 요청 시 |
| **코드 정리** | `/sc:cleanup` | 데드 코드 제거, 구조 최적화 요청 시 |
| **작업량 산정** | `/sc:estimate` | 개발 작업량 추정 요청 시 |
| **웹 리서치** | `/sc:research` | 기술 조사, 최신 정보 검색 필요 시 |
| **요구사항 정의** | `/sc:brainstorm` | 요구사항 발굴, 소크라테스식 대화 필요 시 |
| **워크플로우 생성** | `/sc:workflow` | PRD에서 구현 계획 생성 필요 시 |
| **코드 설명** | `/sc:explain` | 코드, 개념, 시스템 동작 설명 요청 시 |
| **PR 코드 리뷰** | `/code-review` | Pull Request 리뷰 요청 시 |

### 자동 실행 규칙

1. **명시적 요청 우선**: 사용자가 특정 명령어를 직접 요청하면 그 명령어를 사용
2. **작업 컨텍스트 기반**: 현재 작업의 성격에 따라 가장 적합한 명령어 자동 선택
3. **연속 작업 지원**: 코드 작성 후 `/sc:test`, 문제 발견 시 `/sc:troubleshoot` 등 자연스럽게 연계
4. **불필요한 실행 금지**: 단순 질문이나 파일 읽기만 필요한 경우 명령어 사용 안 함

### 자동 실행 예시

```
사용자: "이 함수의 성능을 개선해줘"
→ /sc:analyze로 현재 상태 분석 후 /sc:improve로 개선 적용

사용자: "로그인 기능을 구현해줘"
→ /sc:implement로 기능 구현

사용자: "빌드가 안 되는데 왜 그런지 봐줘"
→ /sc:troubleshoot로 문제 진단

사용자: "변경사항 커밋해줘"
→ /sc:git으로 커밋 생성

사용자: "이 코드가 뭐하는 건지 설명해줘"
→ /sc:explain으로 상세 설명 제공
```

### 명령어 조합 패턴

복잡한 작업의 경우 여러 명령어를 순차적으로 조합합니다:

- **기능 개발 전체 흐름**: `/sc:design` → `/sc:implement` → `/sc:test` → `/sc:git`
- **버그 수정 흐름**: `/sc:troubleshoot` → `/sc:implement` → `/sc:test`
- **리팩토링 흐름**: `/sc:analyze` → `/sc:improve` → `/sc:cleanup` → `/sc:test`
- **문서화 흐름**: `/sc:explain` → `/sc:document`

## Notes

- This repository does not yet contain a defined project structure or build system
- No dependencies, build commands, or test frameworks have been configured
- The repository is a blank slate for experimenting with Claude Code features and workflows
