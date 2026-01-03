# Game Planner - 구현 현황 문서

> **최종 업데이트**: 2025-01-27
> **구현 완료**: Phase 1, Phase 2, Phase 3, Phase 3.5 (템플릿 시스템 고도화)
> **다음 단계**: Phase 4 - 고급 기능 및 최적화

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [시스템 아키텍처](#시스템-아키텍처)
4. [Phase 1 구현 내용](#phase-1-구현-내용)
5. [Phase 2 구현 내용](#phase-2-구현-내용)
6. [Phase 3 구현 내용](#phase-3-구현-내용)
7. [핵심 컴포넌트](#핵심-컴포넌트)
8. [데이터 구조](#데이터-구조)
9. [프롬프트 엔지니어링](#프롬프트-엔지니어링)
10. [다음 단계](#다음-단계)

---

## 프로젝트 개요

**Game Planner**는 Google Gemini API를 활용하여 모바일 게임 기획서를 작성하고, 게임을 분석하는 로컬 데스크톱 애플리케이션입니다.

### 핵심 컨셉

- **Gemini 2.5 Flash**: 기획서 작성 및 대화형 기획 지원
- **Gemini 2.0 Flash Exp**: 게임 분석 (Google Search Grounding 포함)
- **이 앱**: 기획자와 분석가를 지원하는 AI 어시스턴트

### 프로젝트 목표

1. **게임 기획서 작성**: 하이브리드 캐주얼 게임 기획서 자동 생성
2. **게임 분석**: 기존 게임의 시장성, 메커니즘, 수익화 전략 분석
3. **템플릿 시스템**: 다양한 프롬프트 템플릿으로 맞춤형 기획/분석
4. **Notion 연동**: 작성된 기획서/분석 보고서를 Notion에 자동 저장
5. **세션 관리**: 여러 기획/분석 프로젝트를 세션으로 관리

---

## 기술 스택

| 영역 | 기술 | 선정 이유 |
|------|------|----------|
| **App Shell** | **Tauri 2.0 (Rust)** | Electron 대비 가볍고 보안 강력, OS 파일 시스템 제어 용이 |
| **Frontend** | **Vite + React + TypeScript** | 빠른 렌더링, 컴포넌트 기반 UI 관리, 타입 안정성 |
| **Styling** | **TailwindCSS** | 유틸리티 퍼스트 방식의 빠르고 일관된 디자인 |
| **State Management** | **Zustand** | 간단하고 효율적인 전역 상태 관리 |
| **Storage** | **Tauri Plugin Store** | 로컬 설정 및 세션 데이터 암호화 저장 |
| **AI Engine** | **Google Gemini 2.5 Flash** | 기획서 작성용 스트리밍 API |
| **AI Analyzer** | **Google Gemini 2.0 Flash Exp** | 게임 분석용 (Google Search Grounding) |
| **Markdown** | **React Markdown** | 마크다운 실시간 렌더링 |
| **Notion API** | **Notion API v1** | 기획서/분석 보고서 자동 저장 |

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│  ┌────────────┬─────────────────┬──────────────────────┐   │
│  │  Sidebar   │  Chat Panel     │  Markdown Preview    │   │
│  │  (Sessions)│  (AI Chat)     │  (Document Viewer)   │   │
│  └────────────┴─────────────────┴──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      Application Logic                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  App.tsx (Main State Management)                     │  │
│  │  - sessions, currentSession, messages              │  │
│  │  - handleSendMessage(), handleAnalyze()             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                          Hooks                               │
│  ┌──────────────────┬─────────────────────────────────┐    │
│  │ useGeminiChat    │ useGameAnalysis                 │    │
│  │ (Planning)       │ (Analysis)                      │    │
│  └──────────────────┴─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      External APIs                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Gemini 2.5 Flash API      (기획서 작성)            │  │
│  │  Gemini 2.0 Flash Exp API  (게임 분석)              │  │
│  │  Notion API                (문서 저장)               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      Local Storage                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  - API Keys (Gemini, Notion)                         │  │
│  │  - Sessions (PLANNING / ANALYSIS)                    │  │
│  │  - Templates (Prompt Templates)                      │  │
│  │  - Settings (Database IDs)                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1 구현 내용

### ✅ 1-1. Tauri 프로젝트 초기화

**구현 완료**
- Tauri 2.0 기반 프로젝트 생성
- Vite + React + TypeScript 설정
- TailwindCSS 통합
- 앱 아이콘 및 메타데이터 설정

### ✅ 1-2. 기본 UI 레이아웃

**구현 완료** - `src/App.tsx`

#### 레이아웃 구조

1. **헤더**
   - 설정 버튼
   - 앱 제목

2. **메인 컨텐츠 영역**
   - 좌측: 사이드바 (세션 목록)
   - 중앙: 채팅 패널 (AI 대화)
   - 우측: 마크다운 프리뷰 (기획서/분석 보고서)

3. **리사이저**
   - 채팅 패널과 프리뷰 사이 드래그 가능한 구분선
   - 최소 20%, 최대 80% 너비 제한

### ✅ 1-3. API Key 관리 시스템

**구현 완료** - `src/lib/store.ts`, `src/components/SettingsModal.tsx`

#### 주요 기능

1. **Tauri Plugin Store 사용**
   - 로컬 파일 시스템에 암호화 저장
   - `settings.json` 파일로 관리

2. **설정 항목**
   - Gemini API Key (필수)
   - Notion API Key (선택)
   - Notion Planning Database ID (선택)
   - Notion Analysis Database ID (선택)

3. **자동 초기화**
   - 앱 시작 시 API Key 확인
   - 없으면 자동으로 설정 모달 표시

---

## Phase 2 구현 내용

### ✅ 2-1. 세션 유형 분리

**구현 완료** - `src/store/useAppStore.ts`

#### 세션 타입

```typescript
export enum SessionType {
  PLANNING = 'planning',  // 기획 세션
  ANALYSIS = 'analysis',  // 분석 세션
}
```

#### 세션 타입별 특징

**PLANNING 세션**:
- 목적: 게임 기획서 작성
- AI 모델: Gemini 2.5 Flash
- 시스템 프롬프트: `SYSTEM_INSTRUCTION` (기획 전문가 페르소나)
- 출력 형식: `<markdown_content>` 태그로 감싼 기획서

**ANALYSIS 세션**:
- 목적: 게임 분석 보고서 작성
- AI 모델: Gemini 2.0 Flash Exp (Google Search Grounding)
- 시스템 프롬프트: `ANALYSIS_SYSTEM_PROMPT` (게임 분석 전문가)
- 출력 형식: `<markdown_content>` 태그로 감싼 분석 보고서

### ✅ 2-2. Gemini API 연동

**구현 완료** - `src/hooks/useGeminiChat.ts`, `src/hooks/useGameAnalysis.ts`

#### 기획 세션 (useGeminiChat)

**주요 기능**:
1. **스트리밍 응답 처리**
   - SSE (Server-Sent Events) 방식
   - 실시간 텍스트 스트리밍

2. **마크다운 파싱**
   - `<markdown_content>` 태그 내부 → 프리뷰 패널
   - 태그 외부 → 채팅 패널

3. **컨텍스트 관리**
   - 대화 히스토리 (최근 10개)
   - 현재 기획서 내용
   - 동적 시스템 프롬프트 (템플릿)

4. **에러 처리**
   - API 오류 감지 및 사용자 알림
   - 네트워크 오류 처리

#### 분석 세션 (useGameAnalysis)

**주요 기능**:
1. **Google Search Grounding**
   - `tools: [{ google_search: {} }]` 활성화
   - 최신 게임 정보 자동 수집

2. **출처 참조 번호 제거**
   - Google Search 출처 번호 `[5, 6]` 자동 제거
   - 깔끔한 마크다운 출력

3. **분석 상태 추적**
   - `pending` → `running` → `completed` / `failed`
   - 세션별 상태 저장

### ✅ 2-3. 사이드바 네비게이션

**구현 완료** - `src/components/Sidebar.tsx`

#### 주요 기능

1. **탭 전환**
   - 기획 세션 / 분석 세션 탭
   - 탭별로 세션 목록 필터링

2. **세션 목록 표시**
   - 세션 제목
   - 사용된 템플릿 이름
   - 마지막 수정 시간

3. **세션 관리**
   - 새 세션 생성 (템플릿 선택)
   - 세션 선택 및 로드
   - 세션 삭제 (확인 다이얼로그)
   - 세션 내보내기 (`.gplan` 파일)
   - 세션 불러오기 (`.gplan` 파일)

4. **템플릿 관리**
   - 템플릿 관리 모달 열기
   - 탭별로 해당 타입의 템플릿만 표시

5. **UI 개선**
   - 세션 관리 버튼을 아이콘만 표시 (한 줄 배치)
   - 마우스 호버 시 툴팁 표시
   - 컴팩트한 디자인으로 공간 효율성 향상

---

## Phase 3 구현 내용

### ✅ 3-1. 템플릿 시스템

**구현 완료** - `src/types/promptTemplate.ts`, `src/components/TemplateManagerModal.tsx`, `src/components/TemplateSelector.tsx`, `src/components/TemplateEditorModal.tsx`

#### 템플릿 타입

```typescript
export enum TemplateType {
  PLANNING = 'planning',  // 기획 세션용
  ANALYSIS = 'analysis',  // 분석 세션용
}

export interface PromptTemplate {
  id: string
  name: string
  type: TemplateType
  content: string  // 마크다운 형식의 프롬프트
  isDefault: boolean
  createdAt: number
  updatedAt: number
  description?: string
}
```

#### 기본 템플릿

**기본 기획 템플릿** (`default-planning`):
- 하이브리드 캐주얼 게임 기획서 작성용
- 9단계 기획서 구조 포함
- 시장 분석, 경제 구조, BM 등 상세 가이드

**기본 분석 템플릿** (`default-analysis`):
- 모바일 게임 분석 보고서 작성용
- 8개 주요 섹션 구조
- Google Search Grounding 활용 가이드
- 시스템 프롬프트와 사용자 프롬프트 분리 구조

#### 템플릿 관리 기능

1. **템플릿 생성**
   - 이름, 설명, 타입 선택
   - Tiptap 리치 텍스트 에디터로 프롬프트 작성
   - 기본 템플릿 복사 기능

2. **템플릿 수정**
   - 기존 템플릿 편집
   - **기본 템플릿은 편집 불가** (복제만 가능)

3. **템플릿 삭제**
   - 기본 템플릿 삭제 불가
   - 사용 중인 템플릿 삭제 시 경고

4. **템플릿 선택**
   - 새 세션 생성 시 템플릿 선택 모달
   - 현재 세션 타입에 맞는 템플릿만 표시

#### 템플릿 에디터 고급 기능

**구현 완료** - `src/components/TemplateEditorModal.tsx`

1. **이모지 피커**
   - `@emoji-mart/data` 패키지 통합
   - 수천 개의 이모지 지원
   - 카테고리별 필터링 (사람, 자연, 음식, 활동, 장소 등)
   - 실시간 검색 기능
   - 에디터에서 `:` 입력 시 자동 완성

2. **줌 기능**
   - 50%~200% 줌 레벨 조절
   - localStorage에 마지막 줌 레벨 저장
   - 확대/축소/리셋 버튼 제공

3. **기본 템플릿 보호**
   - 기본 템플릿 편집 시도 시 경고 및 모달 닫기
   - 복제를 통해서만 수정 가능

### ✅ 3-2. 세션 자동 저장

**구현 완료** - `src/App.tsx`, `src/lib/store.ts`

#### 자동 저장 메커니즘

1. **디바운스 저장**
   - 세션 변경 시 500ms 후 자동 저장
   - 불필요한 저장 방지

2. **설정 보존**
   - 세션 저장 시 API Key 등 설정 보존
   - 저장 후 검증 로직

3. **세션 마이그레이션**
   - 기존 세션의 `type`, `templateId` 자동 마이그레이션
   - 하위 호환성 유지

### ✅ 3-3. Notion 연동

**구현 완료** - `src/lib/notionBlocks.ts`, `src/components/AnalysisResult.tsx`

#### 마크다운 → Notion 변환

**지원 요소**:
- H1, H2, H3 헤더
- 불릿 리스트 (최대 2단계 중첩)
- 번호 매기기 리스트
- 굵은 텍스트 (`**텍스트**`)
- 링크 (`[텍스트](URL)`)
- 수평선 (`---`)
- 문단

**변환 로직**:
1. 마크다운 파싱
2. Notion Block 형식으로 변환
3. 100개씩 배치 처리 (Notion API 제한)

#### Notion 페이지 생성

**기획서 저장**:
- Planning Database에 페이지 생성
- 제목: `{게임명} : 게임 기획서`
- 마크다운 내용을 Notion 블록으로 변환하여 저장

**분석 보고서 저장**:
- Analysis Database에 페이지 생성
- 제목: `{게임명} : 게임 분석`
- HTML 주석에서 게임명 추출 (`<!-- ANALYSIS_TITLE: ... -->`)

### ✅ 3-4. 마크다운 프리뷰

**구현 완료** - `src/components/MarkdownPreview.tsx`

#### 주요 기능

1. **실시간 렌더링**
   - 스트리밍 중 실시간 업데이트
   - React Markdown 사용
   - HTML 주석 자동 제거 (시스템 내부 주석 숨김)

2. **Notion 스타일 스타일링**
   - Tailwind Typography 플러그인
   - Notion과 유사한 가독성 높은 스타일
   - 헤더, 리스트, 링크, 코드 블록 등 세밀한 스타일링
   - 링크 호버 효과 및 색상 강조

3. **스크롤 관리**
   - 자동 스크롤 (새 내용 추가 시)
   - 수동 스크롤 가능

---

## 핵심 컴포넌트

### 1. App.tsx (메인 컨트롤러)

**역할**: 전체 애플리케이션 상태 관리 및 흐름 제어

**주요 상태**:
```typescript
const [apiKey, setApiKey] = useState('')
const [sessions, setSessions] = useState<ChatSession[]>([])
const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
const [messages, setMessages] = useState<Message[]>([])
const [markdownContent, setMarkdownContent] = useState('')
const [currentSessionType, setCurrentSessionType] = useState<SessionType>(SessionType.PLANNING)
```

**주요 핸들러**:
- `handleSendMessage()`: 메시지 전송 및 AI 응답 처리
- `handleAnalyze()`: 게임 분석 실행 (분석 세션 전용)
- 세션 자동 저장 (디바운스)

### 2. Sidebar (사이드바)

**역할**: 세션 목록 및 관리

**주요 기능**:
- 탭 전환 (기획 / 분석)
- 세션 목록 표시 및 필터링
- 세션 생성/삭제/내보내기/불러오기
- 템플릿 관리 모달 열기

### 3. ChatPanel (채팅 패널)

**역할**: AI와의 대화 인터페이스

**주요 기능**:
- 메시지 입력
- 대화 히스토리 표시
- 스트리밍 응답 실시간 표시
- 로딩 상태 표시

### 4. MarkdownPreview (마크다운 프리뷰)

**역할**: 기획서/분석 보고서 실시간 렌더링

**주요 기능**:
- 마크다운 실시간 렌더링
- 스크롤 관리
- 스타일링 (Typography)

### 5. SettingsModal (설정 모달)

**역할**: API Key 및 Notion 설정

**주요 기능**:
- Gemini API Key 입력
- Notion API Key 입력
- Notion Database ID 입력 (기획/분석 분리)
- 설정 저장 및 검증

### 6. TemplateManagerModal (템플릿 관리 모달)

**역할**: 프롬프트 템플릿 관리

**주요 기능**:
- 템플릿 목록 표시
- 템플릿 생성/수정/삭제
- 기본 템플릿 보호

### 7. TemplateSelector (템플릿 선택 모달)

**역할**: 새 세션 생성 시 템플릿 선택

**주요 기능**:
- 세션 타입별 템플릿 필터링
- 템플릿 미리보기
- 템플릿 선택 및 세션 생성

---

## 데이터 구조

### ChatSession

```typescript
export interface ChatSession {
  id: string                      // UUID
  type: SessionType                // 'planning' | 'analysis'
  title: string                   // 세션 제목 (게임명)
  messages: Message[]             // 대화 히스토리
  markdownContent: string         // 기획서/분석 보고서 내용
  createdAt: number               // 생성 시간
  updatedAt: number               // 수정 시간
  
  // 분석 세션 전용
  gameName?: string               // 분석 대상 게임명
  notionPageUrl?: string          // Notion 페이지 URL
  analysisStatus?: 'pending' | 'running' | 'completed' | 'failed'
  
  // 템플릿 연동
  templateId?: string             // 사용된 템플릿 ID
}
```

### Message

```typescript
export interface Message {
  role: 'user' | 'assistant'
  content: string
}
```

### PromptTemplate

```typescript
export interface PromptTemplate {
  id: string                      // UUID
  name: string                    // 템플릿 이름
  type: TemplateType              // 'planning' | 'analysis'
  content: string                 // 마크다운 형식의 프롬프트
  isDefault: boolean              // 기본 템플릿 여부
  createdAt: number
  updatedAt: number
  description?: string
}
```

**참고**: 번역 기능은 제거되었으며, 모든 템플릿은 한국어로만 작성됩니다.

---

## 프롬프트 엔지니어링

### 기획서 작성 프롬프트

**핵심 전략**:

1. **페르소나 설정**
   ```
   당신은 10년 이상의 경력을 가진 "글로벌 모바일 게임 전문 기획자"입니다.
   특히 '하이브리드 캐주얼' 장르의 성공 방정식에 정통합니다.
   ```

2. **출력 형식 강제**
   ```
   - 사용자와의 대화는 일반 텍스트로 출력
   - 게임 기획서 본문은 반드시 <markdown_content> 태그로 감싸서 출력
   - 수정 시 전체 기획서를 다시 출력 (부분 수정 금지)
   ```

3. **기존 내용 보존 원칙**
   ```
   - 이미 작성된 기획서가 있으면, 요청된 부분만 수정하고 나머지는 그대로 유지
   - 전체 재작성은 사용자가 명시적으로 요청할 때만 수행
   ```

4. **9단계 기획서 구조**
   - 레퍼런스 및 시장 분석
   - 게임 개요
   - 초반 시나리오 (Retention 전략)
   - 게임 루프 및 주요 시스템
   - 경제 구조 및 재화 흐름도
   - 밸런싱 및 성장 단계
   - 수익화 모델 (BM)
   - 이벤트 및 확장 컨텐츠
   - 상세 기획 (개발 가이드)

### 게임 분석 프롬프트

**핵심 전략**:

1. **시스템 프롬프트와 사용자 프롬프트 분리**
   - **시스템 레벨** (`analysisInstruction.ts`): 출력 형식, 마크다운 태그 규칙, 헤더 구조 등 엄격한 규칙
   - **사용자 레벨** (`templateDefaults.ts`): AI 역할 정의, 필수 규칙, 분석 구조만 포함
   - 사용자는 간결한 템플릿만 수정, 복잡한 시스템 규칙은 자동 적용

2. **Google Search Grounding 활용**
   ```
   tools: [{ google_search: {} }]
   ```
   - 최신 게임 정보 자동 수집
   - 출처 참조 번호 자동 제거

3. **8개 주요 섹션 구조**
   - 게임 기본 정보
   - 게임 개요
   - 비즈니스 현황
   - 핵심 컨텐츠
   - 운영 현황
   - 사용자 반응
   - 논란 및 이슈
   - 강점/약점 분석

4. **헤더 계층 제한**
   ```
   - h1 (#): 큰 카테고리
   - h2 (##): 하위 카테고리
   - h3 이하는 절대 사용하지 마세요 (Notion 호환성)
   ```

5. **링크 작성 규칙 강화**
   - Google Search를 활용한 실제 URL 검색
   - 마크다운 링크 형식: `[링크 텍스트](실제 URL)`
   - 다운로드 링크, 공식 자료, 외부 리소스에 실제 클릭 가능한 링크 제공
   - 각 링크에 요약 정보 포함

6. **제목 추출**
   ```
   <!-- {게임명} -->
   ```
   - HTML 주석으로 게임명 명시 (문서에는 표시되지 않음)
   - 세션 제목 자동 추출

---

## Phase 3.5: 템플릿 시스템 고도화

### ✅ 3.5-1. 템플릿 에디터 고급 기능

**구현 완료** - `src/components/TemplateEditorModal.tsx`, `src/lib/emojiData.ts`

#### 이모지 피커 시스템

1. **대규모 이모지 데이터셋**
   - `@emoji-mart/data` 패키지 통합
   - 수천 개의 이모지 지원
   - 카테고리별 분류 (사람, 자연, 음식, 활동, 장소 등)

2. **검색 및 필터링**
   - 실시간 검색 기능
   - 카테고리별 필터링 (아이콘만 표시, 툴팁 제공)
   - 에디터에서 `:` 입력 시 자동 완성

3. **사용자 경험**
   - 팝업 패널로 이모지 선택
   - 그리드 레이아웃으로 한눈에 확인
   - 키보드 네비게이션 지원

#### 줌 기능

1. **줌 레벨 조절**
   - 50%~200% 범위
   - 확대/축소/리셋 버튼
   - localStorage에 마지막 설정 저장

2. **에디터 스케일링**
   - Transform scale을 사용한 정확한 스케일링
   - 컨텐츠 전체에 일관된 줌 적용

#### 기본 템플릿 보호

- 기본 템플릿 편집 시도 시 경고 및 모달 닫기
- 복제를 통해서만 수정 가능

### ✅ 3.5-2. 프롬프트 엔지니어링 개선

**구현 완료** - `src/lib/analysisInstruction.ts`, `src/lib/templateDefaults.ts`

#### 시스템 프롬프트와 사용자 프롬프트 분리

1. **시스템 레벨** (`analysisInstruction.ts`)
   - `<markdown_content>` 태그 규칙
   - HTML 주석 처리 규칙
   - 헤더 구조 제한 (h1, h2만 사용)
   - 링크 작성 규칙 (Google Search 활용, 마크다운 형식)

2. **사용자 레벨** (`templateDefaults.ts`)
   - AI 역할 정의
   - 필수 문서 작성 규칙
   - 분석 구조 (간결한 가이드)

3. **장점**
   - 사용자는 간결한 템플릿만 수정
   - 복잡한 시스템 규칙은 자동 적용
   - 템플릿 가독성 향상

#### 링크 작성 규칙 강화

- Google Search를 활용한 실제 URL 검색
- 다운로드 링크, 공식 자료, 외부 리소스에 실제 클릭 가능한 링크 제공
- 각 링크에 요약 정보 포함

### ✅ 3.5-3. 마크다운 렌더링 개선

**구현 완료** - `src/components/MarkdownPreview.tsx`

1. **Notion 스타일 스타일링**
   - Notion과 유사한 가독성 높은 디자인
   - 헤더, 리스트, 링크, 코드 블록 등 세밀한 스타일링
   - 링크 호버 효과 및 색상 강조

2. **HTML 주석 제거**
   - 시스템 내부 주석 자동 숨김
   - 사용자에게는 깔끔한 문서만 표시

### ✅ 3.5-4. UI/UX 개선

**구현 완료** - `src/components/Sidebar.tsx`

1. **사이드바 버튼 최적화**
   - 세션 관리 버튼을 아이콘만 표시
   - 한 줄에 배치하여 공간 효율성 향상
   - 마우스 호버 시 툴팁 표시

---

## 다음 단계

### Phase 4: 고급 기능 및 최적화

#### 4-1. 세션 검색 기능

**추가 필요**:
- 사이드바에 검색 입력창
- 세션 제목/내용 검색
- 실시간 필터링

#### 4-2. 세션 통계 및 분석

**추가 필요**:
- 세션별 메시지 수 통계
- 작성된 기획서/분석 보고서 개수
- 가장 많이 사용된 템플릿

#### 4-3. 템플릿 공유 기능

**추가 필요**:
- 템플릿 내보내기/가져오기
- 템플릿 마켓플레이스 (선택)
- 템플릿 버전 관리

#### 4-4. 고급 편집 기능

**추가 필요**:
- 마크다운 에디터 (직접 편집)
- 이미지 삽입 지원
- 표 편집기

#### 4-5. 협업 기능

**추가 필요**:
- 세션 공유 링크 생성
- 실시간 협업 (선택)
- 댓글 시스템

#### 4-6. 성능 최적화

**추가 필요**:
- 대용량 세션 처리
- 이미지 최적화
- 오프라인 모드 지원

---

## 주요 학습 포인트

### 1. Tauri 2.0 특성

- **Capabilities 설정 필수**: 모든 파일 시스템 접근은 `capabilities/default.json`에 명시 필요
- **Store 싱글톤 패턴**: 여러 컴포넌트에서 Store 인스턴스 공유
- **동시 저장 방지**: Lock 메커니즘으로 데이터 손실 방지

### 2. Gemini API 스트리밍

- **SSE 방식**: `alt=sse` 파라미터로 스트리밍 활성화
- **버퍼 관리**: 불완전한 JSON 라인 처리
- **마크다운 파싱**: `<markdown_content>` 태그 실시간 파싱

### 3. Notion API 제약

- **블록 제한**: 한 번에 최대 100개 블록만 추가 가능
- **중첩 제한**: 리스트는 최대 2단계 중첩만 지원
- **헤더 제한**: h3 이하는 지원하지 않음

### 4. 상태 관리 패턴

- **Zustand 사용**: 간단하고 효율적인 전역 상태
- **세션 자동 저장**: 디바운스로 성능 최적화
- **마이그레이션**: 하위 호환성 유지

---

## 알려진 이슈 및 제한사항

### 1. Gemini API 제약

- **토큰 제한**: `maxOutputTokens: 8192`로 제한
- **스트리밍 지연**: 네트워크 상태에 따라 지연 가능
- **Google Search Grounding**: 베타 기능으로 불안정할 수 있음

### 2. Notion API 제약

- **블록 크기**: 블록당 최대 2000자 제한
- **API 속도 제한**: 초당 3회 요청 제한
- **중첩 리스트**: 2단계까지만 지원

### 3. 로컬 저장소 제약

- **Store 크기**: 대용량 세션 저장 시 성능 저하 가능
- **동시 저장**: Lock 메커니즘으로 해결했으나 완벽하지 않음

---

## 파일 구조

```
GamePlanner-Tauri/
├── src/
│   ├── components/          # React 컴포넌트
│   │   ├── Sidebar.tsx
│   │   ├── ChatPanel.tsx
│   │   ├── MarkdownPreview.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── TemplateManagerModal.tsx
│   │   ├── TemplateSelector.tsx
│   │   ├── TemplateEditorModal.tsx
│   │   ├── AnalysisResult.tsx
│   │   ├── Header.tsx
│   │   └── Resizer.tsx
│   ├── hooks/               # 커스텀 훅
│   │   ├── useGeminiChat.ts
│   │   └── useGameAnalysis.ts
│   ├── lib/                 # 유틸리티 및 라이브러리
│   │   ├── store.ts
│   │   ├── systemInstruction.ts
│   │   ├── analysisInstruction.ts
│   │   ├── notionBlocks.ts
│   │   ├── templateDefaults.ts
│   │   ├── emojiData.ts
│   │   └── utils.ts
│   ├── store/               # 상태 관리
│   │   └── useAppStore.ts
│   ├── types/               # TypeScript 타입 정의
│   │   └── promptTemplate.ts
│   ├── App.tsx              # 메인 앱
│   ├── main.tsx             # 엔트리 포인트
│   └── index.css            # 전역 스타일
├── src-tauri/               # Tauri 백엔드
│   ├── src/
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── capabilities/
│   │   └── default.json
│   ├── Cargo.toml
│   └── tauri.conf.json
├── Template/                # 템플릿 파일
│   ├── 기본 기획 템플릿.prompt
│   ├── 기본 분석 템플릿.prompt
│   └── 프로토타입 기획.prompt
├── Plans/                   # 계획 및 문서
│   ├── game_plan.md
│   └── GAMEPLANNER_IMPLEMENTATION_STATUS.md (이 파일)
└── package.json
```

---

## 참고 자료

### Gemini API

- [Gemini API 공식 문서](https://ai.google.dev/docs)
- [Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash)
- [Google Search Grounding](https://ai.google.dev/gemini-api/docs/grounding)

### Tauri

- [Tauri 공식 문서](https://tauri.app/)
- [Tauri 2.0 Guide](https://v2.tauri.app/start/)
- [Tauri Plugin Store](https://v2.tauri.app/plugin/store/)

### Notion API

- [Notion API 공식 문서](https://developers.notion.com/)
- [Notion Blocks](https://developers.notion.com/reference/block)

---

## 개발 팁

### 디버깅

1. **콘솔 로그 활용**: 모든 주요 함수에 로그 추가됨
   ```
   🔍 - 설정 관련
   📝 - API 요청 관련
   ✅ - 성공
   ❌ - 오류
   ⚠️ - 경고
   ```

2. **Tauri DevTools**: 화면 우클릭 → `Inspect Element`
   - Chrome DevTools와 동일하게 사용 가능
   - API 호출, 네트워크 오류 확인

3. **Store 디버깅**: Tauri Store 파일 직접 확인
   ```
   ~/.config/com.gameplanner.tauri/settings.json
   ```

### 테스트

1. **세션 관리 테스트**: 여러 세션 생성/삭제/전환
2. **템플릿 테스트**: 다양한 템플릿으로 세션 생성
3. **Notion 연동 테스트**: 실제 Notion Database에 저장 확인

### 최적화

1. **세션 크기 관리**: 오래된 세션 정리
2. **템플릿 캐싱**: 자주 사용하는 템플릿 메모리 캐싱
3. **이미지 최적화**: Notion에 이미지 저장 시 압축

---

## 마무리

**Game Planner**는 Phase 3.5까지 성공적으로 구현되었으며, 핵심 기능인 **게임 기획서 작성**, **게임 분석**, **템플릿 시스템**, **Notion 연동**이 모두 작동합니다.

**Phase 3.5**에서는 템플릿 시스템이 크게 개선되었습니다:
- 이모지 피커로 템플릿 작성 편의성 향상
- 줌 기능으로 대용량 템플릿 편집 효율성 증대
- 시스템/사용자 프롬프트 분리로 템플릿 가독성 향상
- Notion 스타일 마크다운 렌더링으로 문서 가독성 개선
- UI/UX 개선으로 사용성 향상

다음 단계는 **Phase 4 (고급 기능 및 최적화)**를 통해 더욱 편리하고 강력한 기능을 추가하는 것입니다.

프로젝트는 최종 목표인 **"AI 기반 게임 기획 및 분석 도구"**를 향해 순조롭게 진행 중입니다.

---

**문서 버전**: 2.0
**작성일**: 2025-01-01
**최종 업데이트**: 2025-01-27
**주요 업데이트**: 
- Phase 3.5 (템플릿 시스템 고도화) 내용 추가
- 이모지 피커, 줌 기능, 프롬프트 엔지니어링 개선 사항 반영
- 마크다운 렌더링 개선 및 UI/UX 개선 사항 반영
- 번역 기능 제거 사항 반영
**다음 업데이트 예정**: Phase 4 완료 시

