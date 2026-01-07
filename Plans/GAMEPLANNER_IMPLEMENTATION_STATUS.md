# Game Planner - 구현 현황 문서

> **AI를 위한 프로젝트 가이드**: 이 문서는 AI가 프로젝트를 빠르게 이해하고 작업할 수 있도록 핵심 정보를 정리한 것입니다.
>
> **최종 업데이트**: 2026-01-07
> **구현 상태**: Phase 3.6 완료 (안정화 완료)

---

## 프로젝트 개요

**Game Planner**는 Google Gemini API를 활용한 로컬 데스크톱 애플리케이션으로, 게임 기획서 작성 및 게임 분석 기능을 제공합니다.

### 핵심 기능

1. **게임 기획서 작성** (PLANNING 세션)
   - Gemini 2.5 Flash 사용
   - 템플릿 기반 프롬프트
   - 실시간 마크다운 생성
   - 참조 파일 등록 (PDF, Excel, CSV, Markdown, Text)

2. **게임 분석** (ANALYSIS 세션)
   - Gemini 2.0 Flash Exp 사용 (Google Search Grounding)
   - 최신 게임 정보 자동 수집
   - 시장 분석, 수익화 전략 등

3. **템플릿 시스템**
   - 기획/분석 템플릿 관리
   - Tiptap 리치 에디터
   - 이모지 피커, 줌 기능

4. **버전 관리**
   - 문서 버전 스냅샷 저장
   - 버전 복원 및 비교

5. **검증 시스템**
   - AI 기반 문서 검증
   - 체크리스트 관리

6. **Notion 연동**
   - 마크다운 → Notion 블록 변환
   - 기획서/분석 보고서 자동 저장

---

## 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| **App Shell** | Tauri 2.0 (Rust) | 로컬 데스크톱 앱 |
| **Frontend** | Vite + React + TypeScript | |
| **Styling** | TailwindCSS | |
| **State** | Zustand | Slice 패턴 사용 |
| **Storage** | Tauri Plugin Store | `settings.json`로 관리 |
| **AI (기획)** | Gemini 2.5 Flash | 스트리밍 API |
| **AI (분석)** | Gemini 2.0 Flash Exp | Google Search Grounding |
| **Markdown** | React Markdown | 실시간 렌더링 |
| **Editor** | Tiptap | 템플릿 에디터 |

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────┐
│  UI Layer (React Components)                │
│  - Sidebar, ChatPanel, MarkdownPreview      │
└─────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────┐
│  Hooks Layer                                │
│  - useMessageHandler (메시지 처리)           │
│  - useAppInitialization (앱 초기화)         │
│  - useGeminiChat, useGameAnalysis (AI 통신) │
│  - useAutoSave (자동 저장)                   │
└─────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────┐
│  State Management (Zustand)                 │
│  - sessionSlice (세션 관리)                  │
│  - templateSlice (템플릿 관리)               │
│  - settingsSlice (설정)                      │
│  - checklistSlice (체크리스트)               │
│  - uiSlice (UI 상태)                         │
└─────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────┐
│  Services & Utils                           │
│  - storageService (저장소)                   │
│  - geminiService (API 호출)                 │
│  - fileOptimization (파일 최적화)            │
│  - migrationManager (데이터 마이그레이션)    │
└─────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────┐
│  External APIs & Storage                    │
│  - Gemini API (기획/분석)                    │
│  - Notion API (문서 저장)                    │
│  - Tauri Store (로컬 저장)                   │
└─────────────────────────────────────────────┘
```

---

## 핵심 컴포넌트 및 역할

### 1. 메인 앱 (`App.tsx`)

- 전체 애플리케이션 상태 관리
- 레이아웃 구성 (사이드바 + 채팅 + 프리뷰)
- 메시지 핸들러 통합

### 2. Sidebar 컴포넌트

**파일**: `src/components/Sidebar.tsx`, `Sidebar/SessionActions.tsx`, `Sidebar/SessionList.tsx`

- 세션 목록 표시 (기획/분석 탭 분리)
- 세션 생성/삭제/내보내기/불러오기
- 템플릿 관리 모달 열기

### 3. ChatPanel 컴포넌트

**파일**: `src/components/ChatPanel.tsx`

- AI와의 대화 인터페이스
- 메시지 입력 및 히스토리 표시
- 스트리밍 응답 실시간 표시

### 4. MarkdownPreview 컴포넌트

**파일**: `src/components/MarkdownPreview.tsx`

- 기획서/분석 보고서 실시간 렌더링
- 탭 인터페이스: 미리보기 / 버전 / 검증 / 레퍼런스
- 복사/다운로드/Notion 저장 기능

### 5. TemplateEditorModal 컴포넌트

**파일**: `src/components/TemplateEditorModal.tsx`, `TemplateEditor/EmojiPicker.tsx`, `TemplateEditor/ZoomControls.tsx`

- Tiptap 리치 텍스트 에디터
- 이모지 피커 (`:` 입력 시 자동 완성)
- 줌 기능 (50%~200%)

### 6. ReferenceManager 컴포넌트

**파일**: `src/components/ReferenceManager.tsx`

- 참조 파일 등록/삭제 (PDF, Excel, CSV, Markdown, Text)
- Google Spreadsheet URL 지원
- AI 기반 파일 요약 생성
- 드래그 앤 드롭 지원 (Tauri API)

### 7. VersionHistory 컴포넌트

**파일**: `src/components/VersionHistory.tsx`

- 문서 버전 스냅샷 저장
- 버전 복원 및 비교

### 8. ChecklistPanel 컴포넌트

**파일**: `src/components/ChecklistPanel.tsx`

- AI 기반 문서 검증
- 체크리스트 항목 관리

### 9. useMessageHandler Hook

**파일**: `src/hooks/useMessageHandler.ts`

- 메시지 전송 및 AI 응답 처리
- 기획/분석 세션 분기 처리
- 레퍼런스 파일 필터링 및 포함
- 파일 최적화 로직 적용

### 10. useAppInitialization Hook

**파일**: `src/hooks/useAppInitialization.ts`

- 앱 시작 시 초기화
- API Key 확인
- 세션 로드 및 마이그레이션
- 템플릿 초기화

---

## 데이터 구조

### ChatSession

```typescript
export interface ChatSession {
  id: string                          // UUID
  type: SessionType                    // 'planning' | 'analysis'
  title: string                       // 세션 제목
  messages: Message[]                 // 대화 히스토리
  markdownContent: string             // 기획서/분석 보고서 내용
  createdAt: number
  updatedAt: number

  // 분석 세션 전용
  gameName?: string                   // 분석 대상 게임명
  notionPageUrl?: string              // Notion 페이지 URL
  analysisStatus?: 'pending' | 'running' | 'completed' | 'failed'

  // 템플릿 연동
  templateId?: string                 // 사용된 템플릿 ID

  // 버전 관리
  versions?: DocumentVersion[]        // 문서 버전 히스토리
  currentVersionNumber?: number       // 현재 버전 번호

  // 레퍼런스 파일 (기획 세션 전용)
  referenceFiles?: ReferenceFile[]    // 참조 파일 목록

  // 체크리스트 (기획 세션 전용)
  checklist?: ChecklistCategory[]     // 검증 체크리스트
}
```

### ReferenceFile

```typescript
export interface ReferenceFile {
  id: string                          // UUID
  fileName: string                    // 파일명
  filePath: string                    // 파일 경로
  fileType: string                    // 파일 타입 (pdf, xlsx, csv, md, txt)
  content: string                     // 파싱된 텍스트 내용
  summary?: string                    // 파일 내용 요약 (비용 최적화용)
  metadata?: {
    pageCount?: number                // PDF 페이지 수
    sheetCount?: number               // Excel 시트 수
  }
  createdAt: number
  updatedAt: number
}
```

### PromptTemplate

```typescript
export interface PromptTemplate {
  id: string                          // UUID
  name: string                        // 템플릿 이름
  type: TemplateType                  // 'planning' | 'analysis'
  content: string                     // 마크다운 형식의 프롬프트
  isDefault: boolean                  // 기본 템플릿 여부 (삭제/편집 불가)
  createdAt: number
  updatedAt: number
  description?: string
}
```

---

## 프롬프트 엔지니어링 전략

### 기획서 작성 프롬프트

**핵심 규칙**:
1. 페르소나: 10년 경력 모바일 게임 전문 기획자
2. 출력 형식: `<markdown_content>` 태그로 기획서 감싸기
3. 수정 시: 전체 기획서를 다시 출력 (부분 수정 금지)
4. 기존 내용 보존: 요청된 부분만 수정, 나머지 유지

### 게임 분석 프롬프트

**핵심 규칙**:
1. **시스템/사용자 프롬프트 분리**
   - 시스템 레벨 (`analysisInstruction.ts`): 출력 형식, 태그 규칙, 헤더 구조
   - 사용자 레벨 (`templateDefaults.ts`): AI 역할, 분석 구조
2. Google Search Grounding 활용
3. 헤더 제한: h1, h2만 사용 (Notion 호환)
4. 링크: Google Search로 실제 URL 검색하여 제공

---

## 파일 최적화 시스템

### 비용 최적화 전략

1. **관련 파일 필터링**
   - 사용자 메시지 키워드 추출
   - 파일명/요약/내용 기반 관련성 점수 계산
   - 관련성 높은 파일만 선택 (최대 3개)

2. **파일 크기 제한**
   - 최대 크기: 10만자 (약 25,000 토큰)
   - 등록 시 크기 검증 및 잘라내기

3. **스마트 파일 포함**
   - 대용량(>10만자): 요약만 사용
   - 중간 크기(5천~10만자): 요약 + 일부 내용
   - 작은 크기(<5천자): 전체 내용 사용

4. **요약 캐싱**
   - AI 요약: 500자 이내
   - 요약 재사용으로 비용 절감

**예상 비용 절감**: 70-85%

---

## 저장 시스템

### 즉시 저장 지점

중요한 변화가 발생하는 시점에 즉시 저장하여 데이터 손실 방지:

1. 버전 저장/복원
2. 검증 실행/체크리스트 변경
3. 레퍼런스 파일 등록/삭제
4. 채팅 완료 시

**함수**: `saveSessionImmediately()` (src/lib/utils/sessionSave.ts)

### 자동 저장 (디바운스)

- 500ms 디바운스로 불필요한 저장 방지
- Hook: `useAutoSave()`

---

## 마이그레이션 시스템

### 버전별 마이그레이션

**파일**: `src/lib/migrations/migrationManager.ts`, `v1.ts`, `v2.ts`, `v3.ts`

- **V1**: 세션 타입(`type`) 필드 추가
- **V2**: 템플릿 ID(`templateId`) 필드 추가
- **V3**: 레퍼런스 파일(`referenceFiles`) 필드 추가

앱 시작 시 자동 실행, 하위 호환성 유지.

---

## 파일 구조

```
GamePlanner-Tauri/
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── Sidebar/            # 사이드바 하위 컴포넌트
│   │   ├── ChatPanel.tsx
│   │   ├── MarkdownPreview.tsx
│   │   ├── TemplateEditorModal.tsx
│   │   ├── TemplateEditor/     # 템플릿 에디터 하위 컴포넌트
│   │   ├── ReferenceManager.tsx
│   │   ├── VersionHistory.tsx
│   │   ├── ChecklistPanel.tsx
│   │   └── ...
│   ├── hooks/
│   │   ├── useGeminiChat.ts            # 기획 세션 AI 통신
│   │   ├── useGameAnalysis.ts          # 분석 세션 AI 통신
│   │   ├── useMessageHandler.ts        # 메시지 처리 통합
│   │   ├── useAppInitialization.ts     # 앱 초기화
│   │   └── useAutoSave.ts              # 자동 저장
│   ├── lib/
│   │   ├── store.ts                    # Tauri Store 관리
│   │   ├── systemInstruction.ts        # 기획 시스템 프롬프트
│   │   ├── analysisInstruction.ts      # 분석 시스템 프롬프트
│   │   ├── templateDefaults.ts         # 기본 템플릿
│   │   ├── notionBlocks.ts             # Notion 변환
│   │   ├── emojiData.ts                # 이모지 데이터
│   │   ├── utils/
│   │   │   ├── fileParser.ts           # 파일 파싱
│   │   │   ├── fileOptimization.ts     # 파일 최적화
│   │   │   ├── sessionSave.ts          # 즉시 저장
│   │   │   ├── markdown.ts             # 마크다운 유틸
│   │   │   └── logger.ts               # 개발 로그 (devLog)
│   │   ├── services/
│   │   │   ├── geminiService.ts        # Gemini API 서비스
│   │   │   └── storageService.ts       # 저장소 서비스
│   │   └── migrations/
│   │       ├── migrationManager.ts     # 마이그레이션 관리자
│   │       ├── v1.ts, v2.ts, v3.ts
│   ├── store/
│   │   ├── useAppStore.ts              # 메인 스토어
│   │   └── slices/
│   │       ├── sessionSlice.ts
│   │       ├── templateSlice.ts
│   │       ├── settingsSlice.ts
│   │       ├── uiSlice.ts
│   │       └── checklistSlice.ts
│   ├── types/
│   │   ├── promptTemplate.ts
│   │   ├── referenceFile.ts
│   │   ├── version.ts
│   │   ├── checklist.ts
│   │   └── store.ts
│   └── App.tsx                         # 메인 앱
└── src-tauri/                          # Tauri 백엔드
    ├── capabilities/default.json       # 파일 시스템 권한 설정
    └── tauri.conf.json
```

---

## 알려진 이슈 및 제한사항

### 1. Gemini API 제약

- 토큰 제한: `maxOutputTokens: 8192`
- Google Search Grounding: 베타 기능

### 2. Notion API 제약

- 블록 크기: 블록당 최대 2000자
- API 속도 제한: 초당 3회 요청
- 중첩 리스트: 2단계까지만 지원
- 헤더 제한: h3 이하 지원하지 않음

### 3. 로컬 저장소

- 대용량 세션 저장 시 성능 저하 가능
- 즉시 저장 + 자동 저장으로 데이터 손실 방지

### 4. Tauri 2.0 특성

- 모든 파일 시스템 접근은 `capabilities/default.json`에 명시 필요
- Store 싱글톤 패턴 사용 (동시 저장 방지)

---

## 개발 로그 시스템

**파일**: `src/lib/utils/logger.ts`

개발 모드에서만 로그 출력, 프로덕션에서는 에러만 표시:

```typescript
import { devLog } from '../lib/utils/logger'

devLog.log('🔍 설정 로드')       // 개발 모드만
devLog.info('정보 메시지')        // 개발 모드만
devLog.warn('⚠️ 경고')          // 개발 모드만
devLog.error('❌ 에러')          // 항상 표시
```

**환경 변수**: `import.meta.env.DEV`로 개발 모드 확인

---

## 주요 개발 패턴

### 1. Zustand Slice 패턴

상태를 도메인별로 분리:
- `sessionSlice`: 세션 관리
- `templateSlice`: 템플릿 관리
- `settingsSlice`: 설정
- `uiSlice`: UI 상태
- `checklistSlice`: 체크리스트

### 2. Hook 분리 패턴

로직을 재사용 가능한 Hook으로 분리:
- `useMessageHandler`: 메시지 처리 통합
- `useAppInitialization`: 앱 초기화
- `useGeminiChat`, `useGameAnalysis`: AI 통신

### 3. 서비스 레이어 패턴

외부 API 호출을 서비스로 분리:
- `geminiService`: Gemini API 호출
- `storageService`: 저장소 관리

### 4. 컴포넌트 분리 패턴

하위 컴포넌트를 디렉토리로 그룹화:
- `Sidebar/`: SessionActions, SessionList
- `TemplateEditor/`: EmojiPicker, ZoomControls

---

## Tauri 개발 주의사항

### 1. window.confirm/alert 사용 금지

**문제**: Tauri 환경에서 `window.confirm()`과 `window.alert()`는 불안정하게 동작 (취소 버튼 무시 등)

**해결**: React State 기반 커스텀 다이얼로그 사용

```typescript
// State로 삭제할 항목 관리
const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

// 삭제 버튼 클릭
const handleDelete = (id: string) => setDeleteConfirm(id)

// 취소
const cancelDelete = () => setDeleteConfirm(null)

// 확인 (실제 삭제)
const confirmDelete = () => {
  if (!deleteConfirm) return
  // 삭제 로직...
  setDeleteConfirm(null)
}

// JSX에서 조건부 렌더링
{deleteConfirm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    {/* 커스텀 다이얼로그 */}
  </div>
)}
```

**참고 예시**: `Sidebar.tsx`, `TemplateManagerModal.tsx`, `ReferenceManager.tsx`

### 2. 드래그 앤 드롭 구현

**앱 외부 → 앱** (파일 드롭): Tauri API 사용

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window'

useEffect(() => {
  const setupDragDropListener = async () => {
    const appWindow = getCurrentWindow()
    const unlisten = await appWindow.onDragDropEvent(async (event) => {
      if (event.payload.type === 'drop') {
        const paths = event.payload.paths || []
        // 파일 처리...
      }
    })
    return unlisten
  }
  setupDragDropListener()
}, [])
```

**앱 내부 → 앱** (요소 재정렬): HTML5 Drag and Drop API 사용

```typescript
<div
  draggable
  onDragStart={(e) => e.dataTransfer.setData('text/plain', index.toString())}
  onDragOver={(e) => e.preventDefault()}
  onDrop={(e) => {
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'))
    // 재정렬 로직...
  }}
>
  항목
</div>
```

**참고 예시**: `ReferenceManager.tsx` (파일 드롭)

---

## 마무리

이 문서는 AI가 Game Planner 프로젝트를 빠르게 이해하고 작업할 수 있도록 핵심 정보만 정리한 것입니다.

**현재 상태**: Phase 3.6 완료 (안정화 완료)
- 게임 기획서 작성
- 게임 분석
- 템플릿 시스템
- 버전 관리
- 검증 시스템
- 레퍼런스 파일 관리
- 파일 최적화
- Notion 연동

**문서 버전**: 4.0
**최종 업데이트**: 2026-01-07
