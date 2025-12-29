# GamePlanner-Tauri: 게임 분석 기능 통합 구현 계획

## 📋 개요

**목표:** GamePlanner-Tauri에 게임 분석 기능을 통합하여 하나의 앱에서 게임 분석 → 기획까지 가능하도록 구현

**사용자 선택사항:**
- **UI 구조:** 탭 방식 (사이드바에 "기획 세션" / "분석 세션" 탭)
- **구현 방식:** Gemini API 단일 사용 (Python 스크립트 제거)
- **데이터 연결:** 분석 세션 → 기획 세션 변환 기능

---

## 🏗️ 아키텍처 개요

```
┌─────────────────────────────────────────────────────┐
│                    Header                           │
│  [Settings] [Download]                              │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │  ChatPanel  │ Resizer │ MarkdownPreview │
│          │             │         │                  │
│ [기획]   │  채팅 영역   │         │  마크다운 렌더링  │
│ [분석]   │             │         │                  │
│  ↓       │             │         │                  │
│ 세션목록  │  입력창      │         │  [복사][노션]    │
└──────────┴──────────────────────────────────────────┘
```

**분석 플로우:**
1. 사용자가 "분석 세션" 탭 선택
2. 게임명 입력 → Gemini API로 웹 검색 + 분석 실행
3. 실시간 스트리밍으로 분석 내용 표시
4. 완료 시 Notion URL (분석 DB) + 마크다운 결과 표시
5. "기획으로 전환" 버튼 → 분석 결과를 컨텍스트로 포함한 새 기획 세션 생성

**주요 개선사항:**
- ❌ Python 스크립트 제거 (복잡도 감소)
- ✅ Gemini API 단일 사용 (API 키 1개만 필요)
- ✅ 웹 검색: Gemini의 Google Search Grounding 활용
- ✅ Notion DB 2개 분리 (기획 DB / 분석 DB)

---

## 📊 1. 데이터 구조 변경

### 1.1 ChatSession 인터페이스 확장
**파일:** `src/store/useAppStore.ts`

```typescript
export enum SessionType {
  PLANNING = 'planning',  // 기획 세션
  ANALYSIS = 'analysis',  // 분석 세션
}

export interface ChatSession {
  id: string
  type: SessionType  // 새로 추가
  title: string
  messages: Message[]
  markdownContent: string
  createdAt: number
  updatedAt: number

  // 분석 세션 전용 필드 (optional)
  gameName?: string
  notionPageUrl?: string
  analysisStatus?: 'pending' | 'running' | 'completed' | 'failed'
}
```

### 1.2 AppState 확장

```typescript
interface AppState {
  // 기존 필드들...

  // Notion DB 분리
  notionPlanningDatabaseId: string | null  // 기획서 DB (기존)
  notionAnalysisDatabaseId: string | null  // 분석 DB (신규)

  // 분석 관련 추가
  currentSessionType: SessionType

  // 분석 관련 액션
  setNotionPlanningDatabaseId: (id: string | null) => void
  setNotionAnalysisDatabaseId: (id: string | null) => void
  setCurrentSessionType: (type: SessionType) => void
  createAnalysisSession: (gameName: string) => string
  convertAnalysisToPlanning: (analysisSessionId: string) => string
  updateAnalysisStatus: (sessionId: string, status: string, notionUrl?: string) => void
}
```

---

## 🎨 2. UI 컴포넌트 구현

### 2.1 Sidebar.tsx - 탭 추가
**위치:** `src/components/Sidebar.tsx`

```typescript
// 1. 탭 UI 추가 (상단)
<div className="flex border-b border-border">
  <button
    onClick={() => setCurrentSessionType(SessionType.PLANNING)}
    className={currentSessionType === SessionType.PLANNING ? 'active-tab' : ''}
  >
    <FileText className="w-4 h-4" />
    기획 세션
  </button>
  <button
    onClick={() => setCurrentSessionType(SessionType.ANALYSIS)}
    className={currentSessionType === SessionType.ANALYSIS ? 'active-tab' : ''}
  >
    <Search className="w-4 h-4" />
    분석 세션
  </button>
</div>

// 2. 세션 필터링
const filteredSessions = sessions.filter(s => s.type === currentSessionType)

// 3. 버튼 텍스트 동적 변경
<button onClick={handleNewSession}>
  <Plus className="w-4 h-4" />
  {currentSessionType === SessionType.PLANNING ? "새 게임 기획" : "게임 분석"}
</button>
```

### 2.2 SettingsModal.tsx - API 키 설정
**위치:** `src/components/SettingsModal.tsx`

**필요 API 키:**
- ✅ Gemini API Key (필수) - 기획 및 분석 모두 사용
- ✅ Notion API Key (선택)
- ✅ 기획서 Notion DB ID (선택)
- ✅ 분석 Notion DB ID (선택)

**제거된 API 키:**
- ❌ Brave Search API Key
- ❌ Anthropic API Key

---

## ⚙️ 3. 분석 로직 구현 (Gemini 기반)

### 3.1 분석 시스템 프롬프트
**파일:** `src/lib/analysisInstruction.ts` (신규)

분석 카테고리:
1. 기본 정보 (개발사, 출시일, 장르, 플랫폼)
2. 게임 개요 (컨셉, 게임플레이, 특징)
3. 매출 현황
4. 수익화 전략 (IAA/IAP/하이브리드)
5. 긍정적/부정적 반응
6. 논란/이슈
7. 강점/약점 분석

출력 형식: 마크다운 (이모지 포함, 구조화된 섹션)

### 3.2 useGameAnalysis.ts Hook
**위치:** `src/hooks/useGameAnalysis.ts` (신규)

**핵심 기능:**
- Gemini API + Google Search Grounding 사용
- 실시간 스트리밍으로 마크다운 업데이트
- Notion 페이지 생성 (분석 DB)
- 토큰 효율적 (단일 API 호출)

```typescript
// Gemini 2.0 Flash Experimental 사용
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent?alt=sse&key=${apiKey}`,
  {
    body: JSON.stringify({
      contents: [...],
      tools: [{
        googleSearchRetrieval: {
          dynamicRetrievalConfig: {
            mode: "MODE_DYNAMIC",
            dynamicThreshold: 0.3
          }
        }
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    })
  }
)
```

---

## 🔄 4. 세션 변환 기능

### 4.1 convertAnalysisToPlanning
**파일:** `src/store/useAppStore.ts`

```typescript
convertAnalysisToPlanning: (analysisSessionId: string) => {
  const analysisSession = state.sessions.find(s => s.id === analysisSessionId)

  const newSession: ChatSession = {
    id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: SessionType.PLANNING,
    title: `${analysisSession.gameName} 기획`,
    messages: [{
      role: 'user',
      content: `"${analysisSession.gameName}" 게임을 분석했습니다.\n\n분석 결과: ${analysisSession.notionPageUrl}\n\n이 분석을 참고하여 유사한 장르의 신규 게임 기획서를 작성해주세요.`
    }],
    markdownContent: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  set((state) => ({
    sessions: [...state.sessions, newSession],
    currentSessionId: newSession.id,
    currentSessionType: SessionType.PLANNING,
    messages: newSession.messages,
    markdownContent: '',
  }))

  return newSession.id
}
```

---

## 📋 5. 단계별 구현 순서

### Phase 1: 데이터 구조 및 설정 (30분-1시간)
1. SessionType enum 추가
2. ChatSession 인터페이스 확장
3. AppState에 Notion DB 필드 2개로 분리
4. SettingsModal에 Notion DB 필드 2개 추가

### Phase 2: 분석 시스템 프롬프트 (30분)
5. analysisInstruction.ts 작성
6. 마크다운 출력 형식 정의

### Phase 3: UI 구현 (1-2시간)
7. Sidebar 탭 UI 추가
8. ChatPanel 분석 모드 처리
9. AnalysisResult 컴포넌트 작성

### Phase 4: 분석 Hook 구현 (1-2시간)
10. useGameAnalysis.ts 작성
11. Gemini API + Google Search Grounding 통합
12. 실시간 스트리밍 처리
13. Notion 페이지 생성 (분석 DB 사용)

### Phase 5: 통합 및 변환 (1시간)
14. App.tsx 분석/기획 모드 라우팅
15. 세션 변환 함수 구현
16. notionBlocks.ts에서 DB ID 동적 처리

### Phase 6: 테스트 및 최적화 (1시간)
17. 에러 핸들링 강화
18. 기존 세션 마이그레이션 테스트
19. 토큰 사용량 최적화

---

## 📁 6. 핵심 파일 목록

### 수정 파일
- `src/store/useAppStore.ts` - SessionType enum, Notion DB 2개로 분리, 분석 액션 추가
- `src/components/Sidebar.tsx` - 탭 UI 추가, 세션 필터링
- `src/components/ChatPanel.tsx` - 분석 모드 placeholder 변경
- `src/components/SettingsModal.tsx` - Notion DB 필드 2개로 분리
- `src/App.tsx` - 분석/기획 모드 라우팅
- `src/lib/notionBlocks.ts` - DB ID를 파라미터로 받도록 수정

### 신규 파일
- `src/lib/analysisInstruction.ts` - 분석 시스템 프롬프트
- `src/components/AnalysisResult.tsx` - 분석 결과 표시
- `src/hooks/useGameAnalysis.ts` - Gemini + Google Search 분석 훅

---

## ⚠️ 7. 주의사항

### 7.1 Gemini Google Search Grounding 제한사항
- 일일 검색 쿼리 제한 가능
- 검색 품질은 Google Search 알고리즘에 의존
- 토큰 제한 설정 (maxOutputTokens: 8192)

### 7.2 분석 시간 및 토큰
- **예상 소요 시간:** 20-40초
- **예상 토큰:** 입력 ~2K, 출력 ~6K (총 ~8K)
- **비용:** 분석 1회당 약 $0.003 (3원)

### 7.3 에러 시나리오
- Gemini API 키 누락/오류
- 네트워크 오류
- Google Search 제한 도달
- Notion API 오류

---

## ✅ 구현 완료 기준

1. ✅ 사이드바에서 "기획/분석" 탭 전환 가능
2. ✅ 분석 탭에서 게임명 입력 → Gemini + Google Search 실행
3. ✅ 실시간 스트리밍으로 마크다운 업데이트
4. ✅ 분석 완료 시 Notion URL (분석 DB) + 마크다운 결과 표시
5. ✅ "기획으로 전환" 버튼으로 분석 → 기획 세션 생성
6. ✅ 기존 기획 세션과의 호환성 유지
7. ✅ 설정 모달에서 API 키 관리 (Gemini, Notion, 기획 DB, 분석 DB)

---

## 🚀 최종 요약

### 핵심 개선 사항
1. **Python 의존성 제거** - TypeScript만으로 구현
2. **API 키 통합** - Gemini 1개만 필수 (Brave, Anthropic 제거)
3. **Notion DB 분리** - 기획/분석 각각 별도 DB 사용
4. **토큰 효율** - 단일 API 호출로 검색 + 분석 완료
5. **구현 단순화** - Tauri 백엔드 수정 불필요

### 구현 시간
- **복잡도:** 4-5 man-days (사람이 풀타임으로 작업 시)
- **AI 구현 시:** 3-5시간 (단계별 진행)
