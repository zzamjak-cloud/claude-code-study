# Style & Character Studio - 구현 현황 문서

> **최종 업데이트**: 2026-01-03
> **구현 완료**: Phase 1, Phase 2 & 번역 시스템 대폭 개편
> **다음 단계**: Phase 3 - 생성 엔진 고급 제어

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [시스템 아키텍처](#시스템-아키텍처)
4. [Phase 1 구현 내용](#phase-1-구현-내용)
5. [Phase 2 구현 내용](#phase-2-구현-내용)
6. [자동 저장 시스템](#자동-저장-시스템)
7. [추가 구현 기능](#추가-구현-기능)
8. [핵심 컴포넌트](#핵심-컴포넌트)
9. [데이터 구조](#데이터-구조)
10. [프롬프트 엔지니어링](#프롬프트-엔지니어링)
11. [다음 단계](#다음-단계)

---

## 프로젝트 개요

**Style & Character Studio**는 Google Gemini를 활용하여 이미지의 스타일과 캐릭터를 정밀 분석하고, 일관성 있는 이미지를 생성하는 로컬 데스크톱 애플리케이션입니다.

### 핵심 컨셉

- **Gemini**: 분석가 (Analyzer) - 이미지의 스타일과 캐릭터 특징을 구조화된 데이터로 추출
- **Gemini 3 Pro Image Preview**: 화가 (Painter) - 참조 이미지를 기반으로 일관성 있는 이미지 생성
- **이 앱**: 감독 (Director) - 분석과 생성을 조율하여 완벽한 연출 수행

### 프로젝트 목표

1. **스타일 일관성**: 여러 이미지를 분석하여 공통 스타일 추출 및 재현
2. **캐릭터 일관성**: 캐릭터의 외형을 완벽히 유지하면서 포즈/표정만 변경
3. **세션 관리**: 스타일과 캐릭터를 자산(Asset)으로 관리하여 재사용
4. **통합 생성 시스템**: (최종 목표) 여러 캐릭터 세션을 통합하여 하나의 일러스트 생성

---

## 기술 스택

| 영역 | 기술 | 선정 이유 |
|------|------|----------|
| **App Shell** | **Tauri (Rust)** | Electron 대비 가볍고 보안 강력, OS 파일 시스템 제어 용이 |
| **Frontend** | **Vite + React + TypeScript** | 빠른 렌더링, 컴포넌트 기반 UI 관리, 타입 안정성 |
| **Styling** | **TailwindCSS** | 유틸리티 퍼스트 방식의 빠르고 일관된 디자인 |
| **State Management** | **React Hooks (useState, useEffect)** | 간단한 로컬 상태 관리 |
| **Storage** | **LocalStorage (Browser API)** | 세션 및 API 키 로컬 저장 |
| **AI Brain** | **Google Gemini 2.5 Flash** | 멀티모달 이미지 분석 |
| **Image Generator** | **Gemini 3 Pro Image Preview** | 참조 이미지 기반 이미지 생성 |

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│  ┌────────────┬─────────────────┬──────────────────────┐   │
│  │  Sidebar   │  Analysis Panel │  Generator Panel     │   │
│  │  (Sessions)│  (Image Upload) │  (Image Generation)  │   │
│  └────────────┴─────────────────┴──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      Application Logic                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  App.tsx (Main State Management)                     │  │
│  │  - uploadedImages, currentSession, analysisResult    │  │
│  │  - handleAnalyze(), handleGenerate(), etc.           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                          Hooks                               │
│  ┌──────────────────┬─────────────────────────────────┐    │
│  │ useGeminiAnalyzer│ useGeminiImageGenerator         │    │
│  │ (Image Analysis) │ (Image Generation)              │    │
│  └──────────────────┴─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      External APIs                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Gemini 2.5 Flash API      (분석)                   │  │
│  │  Gemini 3 Pro Image API    (생성)                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      Local Storage                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  - API Key                                           │  │
│  │  - Sessions (STYLE / CHARACTER)                      │  │
│  │  - Reference Images (Base64)                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1 구현 내용

### ✅ 1-1. Tauri 프로젝트 초기화

**구현 완료**
- Tauri 2.x 기반 프로젝트 생성
- Vite + React + TypeScript 설정
- TailwindCSS 통합
- 앱 아이콘 및 메타데이터 설정

### ✅ 1-2. Gemini 프롬프트 엔지니어링 (JSON Mode)

**구현 완료** - `src/lib/gemini/analysisPrompt.ts`

#### 프롬프트 종류

1. **STYLE_ANALYZER_PROMPT**: 단일 이미지 분석
2. **MULTI_IMAGE_ANALYZER_PROMPT**: 여러 이미지의 공통 스타일 추출
3. **REFINEMENT_ANALYZER_PROMPT**: 기존 분석에 새 이미지 추가하여 강화

#### JSON 응답 구조

```typescript
{
  "style": {
    "art_style": "화풍",
    "technique": "기법",
    "color_palette": "색상 특징",
    "lighting": "조명",
    "mood": "분위기"
  },
  "character": {
    "gender": "성별",
    "age_group": "연령대",
    "hair": "머리 스타일과 색상",
    "eyes": "눈 색상과 형태",
    "face": "얼굴 특징",
    "outfit": "의상",
    "accessories": "액세서리",
    "body_proportions": "등신대 비율 (2-head, 3-head, 6-head 등)",
    "limb_proportions": "팔과 다리의 비례",
    "torso_shape": "몸통 형태",
    "hand_style": "손 표현 방식"
  },
  "composition": {
    "pose": "현재 포즈/자세",
    "angle": "카메라 앵글",
    "background": "배경 설명",
    "depth_of_field": "심도"
  },
  "negative_prompt": "피해야 할 요소들",
  "user_custom_prompt": "사용자 맞춤 프롬프트 (선택)"
}
```

**핵심 개선 사항**:
- **신체 비율 정밀 분석**: `limb_proportions`, `torso_shape` 필드 추가로 팔/다리 길이 정확히 파악
- **negative_prompt 자동 생성**: 스타일을 해치는 요소 자동 감지

### ✅ 1-3. 분석 결과 UI

**구현 완료** - `src/components/AnalysisPanel.tsx`

#### 주요 기능

1. **이미지 업로드**
   - 드래그 앤 드롭 지원
   - 여러 이미지 동시 업로드
   - 이미지 미리보기 및 제거

2. **분석 실행**
   - "이미지 분석" 버튼
   - 실시간 진행 상태 표시
   - 에러 처리

3. **분석 결과 표시**
   - 3단 카드 레이아웃: Style / Character / Composition
   - 각 속성별 태그 형태로 시각화
   - Negative Prompt 표시

4. **분석 강화**
   - 기존 분석에 새 이미지 추가
   - 일관성 있는 특징 강화
   - 사용자 맞춤 프롬프트 유지

5. **사용자 맞춤 프롬프트**
   - AI 분석 결과에 사용자 선호 요소 추가
   - 세션 저장 시 함께 보존
   - 이미지 생성 시 자동 적용

---

## Phase 2 구현 내용

### ✅ 2-1. 세션 유형 분리

**구현 완료** - `src/types/session.ts`

#### 세션 타입

```typescript
export type SessionType = 'STYLE' | 'CHARACTER';

export interface Session {
  id: string;
  name: string;
  type: SessionType;
  createdAt: string;
  updatedAt: string;
  referenceImages: string[];
  analysis: ImageAnalysisResult;
  imageCount: number;
}
```

#### 세션 타입별 특징

**STYLE 세션**:
- 목적: 특정 화풍/스타일 재현
- 고정 요소: 아트 스타일, 기법, 색상, 조명
- 변경 가능: 피사체, 구도, 배경

**CHARACTER 세션**:
- 목적: 특정 캐릭터의 외형 완벽 유지
- 고정 요소: 얼굴, 머리, 눈, 의상, 신체 비율
- 변경 가능: 포즈, 표정, 동작
- 배경: 자동으로 순백색 처리

### ✅ 2-2. 로컬 저장소 시스템

**구현 완료** - `src/lib/storage.ts`

#### 저장 기능

```typescript
// API 키 관리
saveApiKey(apiKey: string): Promise<void>
loadApiKey(): Promise<string | null>

// 세션 관리
saveSessions(sessions: Session[]): Promise<void>
loadSessions(): Promise<Session[]>

// 세션 가져오기/내보내기
exportSessionToFile(session: Session): Promise<void>
importSessionFromFile(): Promise<Session | null>
```

#### 저장 방식

- **LocalStorage** 사용 (브라우저 API)
- **JSON 직렬화**: 참조 이미지도 Base64로 포함
- **파일 내보내기**: `.json` 파일로 세션 백업
- **파일 가져오기**: 백업 파일에서 세션 복원

### ✅ 2-3. 사이드바 네비게이션

**구현 완료** - `src/components/Sidebar.tsx`

#### 주요 기능

1. **세션 목록 표시**
   - 타입별 아이콘 (🎨 스타일 / 👤 캐릭터)
   - 이미지 개수 표시
   - 마지막 수정 시간 표시

2. **세션 선택**
   - 클릭으로 세션 로드
   - 참조 이미지 및 분석 결과 복원
   - 하이라이트로 현재 세션 표시

3. **세션 관리**
   - 세션 삭제 (확인 다이얼로그)
   - 내보내기/가져오기 버튼
   - 새 세션 시작 버튼

4. **UI/UX**
   - 타입별 색상 구분 (보라색: 스타일 / 파란색: 캐릭터)
   - 호버 효과 및 트랜지션
   - 빈 상태 안내 메시지

---

## 번역 및 세션 저장 시스템

### 개요

세션 저장 시간을 대폭 단축하고 사용자 경험을 개선하기 위해 **변경 감지 기반 선택적 번역** 및 **통합 세션 저장 파이프라인**을 구현했습니다. 번역 로직을 중앙화하고 세션 저장과 번역을 통합하여 더욱 효율적인 시스템으로 개편했습니다.

### 성능 개선

| 시나리오 | 이전 | 이후 | 개선율 |
|----------|------|------|--------|
| 최초 분석 + 저장 | 7-13초 | 7-10초 | 23-30% |
| Style 수정 후 저장 | 3-8초 | 0.6초 | **90%** |
| Character 수정 후 저장 | 3-8초 | 1.1초 | **86%** |
| 변경 없이 저장 | 3-8초 | <0.01초 | **99.9%** |

### ✅ 번역 시스템 중앙화

**구현 완료** - `src/hooks/useTranslation.ts`

#### 핵심 기능

1. **번역 로직 통합**
   - 모든 번역 관련 함수를 `useTranslation` Hook으로 중앙화
   - `translateAnalysisResult`: 전체 분석 결과 영어→한국어 번역 (최초 분석 시)
   - `translateAndUpdateCache`: 변경된 섹션만 번역하여 캐시 업데이트
   - `hasChangesToTranslate`: 변경 감지 로직

2. **배치 번역 최적화**
   - 변경된 섹션의 모든 필드를 한 번에 수집
   - 단일 API 호출로 배치 번역 수행
   - API 호출 횟수 최소화 (기존 5-6회 → 1회)

3. **한국어 포함 영어 보존**
   - 한국어 텍스트 내 영어 단어는 그대로 유지
   - 기술 용어 및 고유명사 보존
   - 자연스러운 번역 품질 유지

### ✅ 세션 저장 및 번역 통합

**구현 완료** - `src/hooks/useSessionPersistence.ts`

#### 핵심 기능

1. **통합 저장 파이프라인**
   ```typescript
   const { saveProgress, saveSession } = useSessionPersistence({
     apiKey,
     currentSession,
     sessions,
     setSessions,
     setCurrentSession,
     analysisResult,
     uploadedImages,
   });
   ```

2. **변경 감지 기반 번역**
   - 세션 저장 시 `hasChangesToTranslate`로 변경 감지
   - 변경된 내용만 `translateAndUpdateCache`로 번역
   - 변경 없으면 번역 스킵하여 즉시 저장

3. **진행 상태 추적**
   - `saveProgress`로 번역/저장 진행 상태 실시간 추적
   - 시각적 피드백 제공 (`ProgressIndicator` 컴포넌트)

### ✅ 변경 감지 시스템

**구현 완료** - `src/hooks/useTranslation.ts` (`hasChangesToTranslate`)

#### 핵심 기능

1. **섹션별 변경 감지**
   - `style`, `character`, `composition`, `negative_prompt`, `user_custom_prompt` 개별 비교
   - JSON.stringify 기반 정확한 변경 감지
   - 변경된 섹션만 번역 대상으로 선정

2. **지원 섹션**
   - `style`: 5개 필드 (art_style, technique, color_palette, lighting, mood)
   - `character`: 11개 필드 (gender, age_group, hair, eyes, face, outfit, accessories, body_proportions, limb_proportions, torso_shape, hand_style)
   - `composition`: 4개 필드 (pose, angle, background, depth_of_field)
   - `negative_prompt`: 부정 프롬프트
   - `user_custom_prompt`: 사용자 맞춤 프롬프트

### ✅ 자동 저장 Hook (분석 카드 편집용)

**구현 완료** - `src/hooks/useAutoSave.ts`

#### 주요 기능

1. **분석 카드 편집 시 자동 저장**
   - Style, Character, Composition, Negative Prompt 카드 편집 시 자동 저장
   - 번역 없이 영어 원본만 저장 (번역은 세션 저장 시 수행)
   - `saveSessionWithoutTranslation` 함수로 즉시 저장

2. **변경 감지**
   - `detectChangedSections`로 변경된 섹션 감지
   - 변경 없으면 저장 스킵

3. **세션 자동 생성/업데이트**
   - 기존 세션이 있으면 업데이트
   - 없으면 새 세션 자동 생성
   - LocalStorage에 즉시 저장

### ✅ 진행 상태 표시

**구현 완료** - `src/components/ProgressIndicator.tsx`

#### UI 특징

1. **실시간 피드백**
   - 고정 위치 (화면 우측 하단)
   - 애니메이션 효과 (슬라이드 업)
   - 진행 바 (0-100%)

2. **물결 애니메이션**
   - 시간 추정치 대신 점 3개(...) 애니메이션
   - 순차적 바운스 효과 (delay: 0s, 0.2s, 0.4s)
   - 부정확한 시간 표시 문제 해결

3. **상태별 표시**
   - `translating`: 스피너 + "번역 중" + 물결 효과
   - `saving`: 스피너 + "저장 중" + 물결 효과
   - `complete`: 체크 아이콘 + "저장 완료!"
   - `idle`: 표시 안 함

### ✅ 통합 및 연결

**구현 완료** - `src/App.tsx`, `src/components/analysis/AnalysisPanel.tsx`

#### App.tsx 변경 사항

1. **Hook 구조 개선**
   ```typescript
   // 이미지 처리
   const { uploadedImages, setUploadedImages, handleImageSelect, handleRemoveImage } =
     useImageHandling();
   
   // 세션 관리
   const { apiKey, sessions, setSessions, currentSession, setCurrentSession, ... } =
     useSessionManagement();
   
   // 번역
   const { translateAnalysisResult, hasChangesToTranslate, translateAndUpdateCache } =
     useTranslation();
   
   // 세션 저장 및 번역 통합
   const { saveProgress, saveSession } = useSessionPersistence({
     apiKey,
     currentSession,
     sessions,
     setSessions,
     setCurrentSession,
     analysisResult,
     uploadedImages,
   });
   ```

2. **분석 카드 업데이트 콜백**
   ```typescript
   onStyleUpdate={(style) => {
     if (analysisResult) {
       const updated = { ...analysisResult, style };
       setAnalysisResult(updated);
       saveSessionWithoutTranslation(updated); // 번역 없이 즉시 저장
     }
   }}
   ```

3. **초기 분석 번역**
   - 이미지 분석 완료 시 자동으로 영어→한국어 번역
   - `initialTranslationProgress`로 진행 상태 표시
   - 번역 완료 후 세션 자동 생성

4. **이미지 생성 시 번역**
   - 이미지 생성 화면 이동 시 변경된 내용만 번역
   - `generateProgress`로 진행 상태 표시
   - 번역 완료 후 세션 저장 및 화면 전환

5. **ProgressIndicator 렌더링**
   ```tsx
   <ProgressIndicator {...saveProgress} />
   <ProgressIndicator {...initialTranslationProgress} />
   <ProgressIndicator {...generateProgress} />
   ```

#### AnalysisPanel 변경 사항

1. **컴포넌트 구조 개편**
   - `components/analysis/` 디렉토리로 이동
   - 카드 컴포넌트들도 `analysis/` 디렉토리로 통합

2. **카드 순서 재정렬**
   ```tsx
   1. CustomPromptCard (사용자 맞춤 프롬프트)
   2. StyleCard (스타일 분석)
   3. CharacterCard (캐릭터 분석)
   4. CompositionCard (구도 분석)
   5. NegativePromptCard (부정 프롬프트)
   6. UnifiedPromptCard (통합 프롬프트) - 최하단
   ```

3. **이미지 삭제 확인 다이얼로그**
   - 이미지 삭제 버튼 클릭 시 확인 팝업 표시
   - 분석 내용 손실 경고 메시지 포함

4. **onUpdate 콜백 Props**
   ```typescript
   interface AnalysisPanelProps {
     onStyleUpdate?: (style: StyleAnalysis) => void;
     onCharacterUpdate?: (character: CharacterAnalysis) => void;
     onCompositionUpdate?: (composition: CompositionAnalysis) => void;
     onNegativePromptUpdate?: (negativePrompt: string) => void;
     onStyleKoreanUpdate?: (koreanStyle: StyleAnalysis) => void;
     onCharacterKoreanUpdate?: (koreanCharacter: CharacterAnalysis) => void;
     onCompositionKoreanUpdate?: (koreanComposition: CompositionAnalysis) => void;
     onNegativePromptKoreanUpdate?: (koreanNegativePrompt: string) => void;
   }
   ```

### ✅ 카드 컴포넌트 통합 및 개선

**구현 완료** - `src/components/analysis/AnalysisCard.tsx`, `StyleCard.tsx`, `CharacterCard.tsx`, `CompositionCard.tsx`, `NegativePromptCard.tsx`, `CustomPromptCard.tsx`

#### AnalysisCard 통합

1. **제네릭 카드 컴포넌트**
   - `StyleCard`, `CharacterCard`, `CompositionCard`를 `AnalysisCard`로 통합
   - 제네릭 타입으로 재사용성 향상
   - 코드 중복 제거

2. **한국어 캐시 우선 표시**
   ```typescript
   // 캐시된 한국어가 있으면 우선 표시, 없으면 영어 원본 표시
   const [koreanDataDisplay, setKoreanDataDisplay] = useState<T>(
     koreanDataProp || data
   );
   ```

3. **편집 모드 언어 유지**
   - 편집 버튼 클릭 시 한국어 값으로 초기화
   - 편집 중에도 한국어 표시 유지
   - 저장 시 영어로 변환하여 저장

#### CustomPromptCard 추가

1. **사용자 맞춤 프롬프트 전용 카드**
   - `UnifiedPromptCard`에서 분리
   - 독립적인 편집 및 저장 기능
   - 세션 저장 시에만 번역 및 저장

#### UnifiedPromptCard 개선

1. **표시 전용 컴포넌트**
   - 모든 분석 카드의 정보를 통합하여 표시
   - 편집 기능 제거 (각 카드에서 개별 편집)
   - `buildUnifiedPrompt`로 영어 프롬프트 생성
   - `buildUnifiedPromptFromKorean`로 한국어 프롬프트 표시

### ✅ UI 개선 사항

**구현 완료** - `src/components/ImageGeneratorPanel.tsx`

#### 주요 개선

1. **중복 설정 아이콘 제거**
   - Style Studio 헤더에만 설정 아이콘 유지
   - ImageGeneratorPanel 헤더에서 제거

2. **다운로드 버튼 고정**
   - 헤더 우측에 고정 배치
   - 스크롤 없이 항상 접근 가능
   - 이미지 생성 완료 시에만 표시

3. **이미지 표시 개선**
   - 최대 높이 제한 제거 (`maxHeight: 'none'`)
   - 전체 이미지 스크롤 뷰
   - 잘림 현상 해결

4. **히스토리 패널 축소**
   - `grid-cols-4`에서 `grid-cols-8`로 변경
   - 썸네일 크기 50% 감소
   - 더 많은 히스토리 한눈에 확인

### ✅ 검증 및 안전장치

**구현 완료** - `src/App.tsx` (`handleAnalyze` 함수)

#### 분석 강화 검증

```typescript
if (isRefinementMode) {
  const hasNewImages = uploadedImages.length > currentSession.imageCount;

  if (!hasNewImages) {
    alert('신규 이미지가 없습니다. 이미지를 추가한 후 다시 분석해주세요.');
    return;
  }

  const confirmed = window.confirm(
    '기존 내용들이 변경될 수도 있습니다. 그래도 진행하시겠습니까?'
  );

  if (!confirmed) return;
}
```

- 신규 이미지 없이 분석 강화 시도 시 경고
- 신규 이미지 있을 경우 확인 다이얼로그
- 사용자의 수정 사항 보호

### 기술적 세부사항

#### 번역 알고리즘

1. **변경 감지 및 필드 수집**
   ```typescript
   // 변경된 섹션 감지
   if (JSON.stringify(oldAnalysis.style) !== JSON.stringify(analysisResult.style)) {
     // 한국어 텍스트만 수집
     styleTexts.forEach((item) => {
       if (containsKorean(item.value)) {
         styleKoreanTexts.push({ text: item.value, field: item.field, index: idx });
       }
     });
   }
   ```

2. **배치 번역**
   - 모든 변경된 섹션의 한국어 텍스트를 하나의 배열로 수집
   - `translateBatchToEnglish()` 1회 호출로 모든 필드 번역 (한국어→영어)
   - API 호출 횟수 최소화 (기존 5-6회 → 1회)

3. **캐시 병합**
   - 변경되지 않은 섹션은 기존 캐시 재사용
   - 번역된 필드만 새 캐시에 병합
   - `customPromptEnglish` 별도 저장 (이미지 생성용)

4. **positivePrompt 자동 생성**
   - style, character, composition 중 하나라도 변경 시
   - `buildUnifiedPrompt()`로 새 positivePrompt 생성
   - 한국어 번역은 `translateBatchToKorean()`으로 수행

#### 번역 시점

1. **최초 이미지 분석 시**
   - 영어 분석 결과 → 한국어 번역
   - 전체 필드 번역 (22개 필드)
   - `initialTranslationProgress`로 진행 상태 표시

2. **세션 저장 시**
   - 변경된 내용만 감지하여 번역
   - 변경 없으면 번역 스킵
   - `saveProgress`로 진행 상태 표시

3. **이미지 생성 시**
   - 변경된 내용만 감지하여 번역
   - `additionalPrompt`는 항상 번역 (매번 새로 입력)
   - `user_custom_prompt`는 캐시된 영어 번역 사용
   - `generateProgress`로 진행 상태 표시

#### 데이터 구조

```typescript
// 한글 번역 캐시
interface KoreanAnalysisCache {
  style?: StyleAnalysis;
  character?: CharacterAnalysis;
  composition?: CompositionAnalysis;
  positivePrompt?: string;
  negativePrompt?: string;
  customPromptEnglish?: string;
}

// 세션에 추가
interface Session {
  // ... 기존 필드
  koreanAnalysis?: KoreanAnalysisCache;
}
```

### 사용 시나리오

#### 시나리오 1: 최초 분석

1. 사용자가 이미지 업로드 후 "이미지 분석" 클릭
2. Gemini API로 분석 (5초)
3. 자동으로 영어→한국어 번역 시작 (`initialTranslationProgress` 표시)
4. 전체 필드 번역 (2-5초, 22개 필드)
5. 세션 자동 생성 및 저장
6. "번역 완료!" 표시

**총 소요 시간**: 7-10초

#### 시나리오 2: 분석 카드 편집

1. 사용자가 Character 카드에서 "hair" 필드 수정
2. "저장" 버튼 클릭
3. `saveSessionWithoutTranslation` 호출
4. 번역 없이 영어 원본만 저장
5. 즉시 완료

**총 소요 시간**: <0.01초

#### 시나리오 3: 세션 저장 (변경 있음)

1. 사용자가 여러 카드 수정 후 "세션 저장" 클릭
2. `hasChangesToTranslate`로 변경 감지
3. 변경된 섹션만 번역 (`saveProgress` 표시)
4. 배치 번역 수행 (1-3초)
5. 세션 저장
6. "저장 완료!" 표시

**총 소요 시간**: 1-3초 (변경된 섹션 수에 따라)

#### 시나리오 4: 세션 저장 (변경 없음)

1. 사용자가 세션 이름만 변경
2. "세션 저장" 버튼 클릭
3. `hasChangesToTranslate`로 변경 감지 → 없음
4. 번역 스킵
5. 세션 메타데이터만 업데이트
6. "저장 완료!" 표시

**총 소요 시간**: <0.01초 (기존 대비 **99.9% 단축**)

#### 시나리오 5: 이미지 생성

1. 사용자가 "이미지 생성" 버튼 클릭
2. `hasChangesToTranslate`로 변경 감지
3. 변경 있으면 번역 (`generateProgress` 표시)
4. `additionalPrompt` 번역 (한국어인 경우)
5. 세션 저장
6. 이미지 생성 화면으로 이동

**총 소요 시간**: 변경 있으면 1-3초, 없으면 즉시

### ✅ 세션 관리 개선

**구현 완료** - `src/hooks/useSessionManagement.ts`, `src/components/common/Sidebar.tsx`

#### 주요 기능

1. **빈 세션 즉시 생성**
   - "새 세션 시작" 버튼 클릭 시 즉시 빈 세션 생성
   - 세션 목록에 바로 추가
   - 이미지 분석 시 빈 세션 업데이트

2. **세션 삭제 확인 다이얼로그**
   - 커스텀 확인 다이얼로그 구현 (Tauri 환경 대응)
   - `window.confirm` 대신 React 컴포넌트 사용
   - 배경 클릭 시 취소

3. **이미지 삭제 확인 다이얼로그**
   - 이미지 삭제 시 확인 팝업 표시
   - 분석 내용 손실 경고 메시지
   - 안전한 삭제 프로세스

### ✅ 로깅 시스템 개선

**구현 완료** - `src/lib/logger.ts`

#### 환경별 로깅

1. **개발 모드**
   - 모든 로그 출력 (debug, info, warn, error)

2. **프로덕션 모드**
   - 에러만 로깅
   - 성능 최적화

3. **일관된 로깅 인터페이스**
   ```typescript
   logger.debug('상세 디버그 정보');
   logger.info('일반 정보');
   logger.warn('경고');
   logger.error('에러');
   ```

### 향후 개선 가능성

1. **React.memo 최적화**
   - 카드 컴포넌트 메모이제이션
   - 불필요한 재렌더링 방지

2. **번역 캐시 영구 저장**
   - 번역 결과를 별도 저장소에 캐싱
   - 동일한 텍스트 재번역 방지

3. **오프라인 모드**
   - 번역 없이 영문만 저장
   - 온라인 복귀 시 번역 보충

---

## 추가 구현 기능

### ✅ 이미지 생성 시스템

**구현 완료** - `src/hooks/useGeminiImageGenerator.ts`, `src/components/ImageGeneratorPanel.tsx`

#### Gemini 3 Pro Image Preview API 통합

```typescript
// API 엔드포인트
https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent

// 요청 파라미터
{
  prompt: string,
  referenceImages: string[],  // 최대 14개
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4',
  imageSize: '1K' | '2K' | '4K',
  sessionType: 'CHARACTER' | 'STYLE'
}
```

#### 세션 타입별 생성 전략

**CHARACTER 세션**:
```
🚨 MISSION: Draw the EXACT SAME character from reference images, but in a NEW POSE.

STEP 1: APPLY NEW POSE (HIGHEST PRIORITY)
- 사용자가 요청한 포즈를 정확히 해석하고 적용
- 참조 이미지의 포즈는 완전히 무시

STEP 2: COPY CHARACTER APPEARANCE 100%
- 신체 비율 (등신대, 팔 길이, 다리 길이) 정확히 복사
- 머리, 얼굴, 의상 모든 디테일 복사
- "개선"하지 말고 정확히 복사

STEP 3: FRAMING
- 전신 표시 (머리부터 발끝까지)
- 순백색 배경
- 다리나 몸이 잘리지 않도록
```

**STYLE 세션**:
```
🎨 ABSOLUTE PRIORITY: REPLICATE THE VISUAL STYLE

스타일 복제 최우선:
- 아트 스타일 및 기법 정확히 복사
- 색상 팔레트 및 적용 방식 동일하게
- 선 스타일 및 두께 일치
- 음영 및 조명 기법 복제
- 전체적인 시각적 느낌 유지

피사체/구도는 사용자 프롬프트에 따라 변경 가능
```

#### ImageGeneratorPanel 기능

1. **프롬프트 입력**
   - CHARACTER: "추가 포즈/표정/동작"
   - STYLE: "추가 프롬프트"
   - 사용자 맞춤 프롬프트 자동 적용 표시

2. **이미지 설정**
   - 비율 선택 (1:1, 16:9, 9:16, 4:3, 3:4)
   - 크기 선택 (1K, 2K, 4K)
   - 참조 이미지 사용 토글 (CHARACTER는 강제 활성화)

3. **생성 결과**
   - 실시간 진행 상태 표시
   - 생성된 이미지 미리보기
   - 다운로드 버튼 (Blob URL 방식)

### ✅ 전역 드래그 앤 드롭

**구현 완료** - `src/App.tsx`

#### 기능

- **Tauri DragDrop API** 활용
- 앱 어디에서나 이미지 파일 드롭 가능
- 자동으로 현재 세션에 이미지 추가
- 중복 이벤트 방지 (500ms 디바운스)
- 이미지 파일 필터링 (png, jpg, jpeg, gif, webp)

### ✅ 사용자 맞춤 프롬프트

**구현 완료** - `src/components/AnalysisPanel.tsx`

#### 기능

- AI 분석 결과에 사용자 선호 요소 추가
- 예: "더 밝은 색감", "미소 짓는 표정", "동적인 포즈 선호"
- 세션 저장 시 함께 보존
- 이미지 생성 시 자동으로 프롬프트에 포함
- 분석 강화 시에도 유지

---

## 핵심 컴포넌트

### 1. App.tsx (메인 컨트롤러)

**역할**: 전체 애플리케이션 상태 관리 및 흐름 제어

**주요 상태**:
```typescript
const [apiKey, setApiKey] = useState('');
const [uploadedImages, setUploadedImages] = useState<string[]>([]);
const [currentSession, setCurrentSession] = useState<Session | null>(null);
const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
const [sessions, setSessions] = useState<Session[]>([]);
const [currentView, setCurrentView] = useState<'analysis' | 'generator'>('analysis');
```

**주요 핸들러**:
- `handleImageSelect()`: 이미지 추가
- `handleAnalyze()`: Gemini 분석 실행
- `handleSaveSession()`: 세션 저장
- `handleLoadSession()`: 세션 불러오기
- `handleGenerateImage()`: 이미지 생성 화면 전환
- `handleCustomPromptChange()`: 사용자 맞춤 프롬프트 업데이트

### 2. AnalysisPanel (분석 패널)

**역할**: 이미지 업로드, 분석 실행, 결과 표시

**주요 기능**:
- 이미지 업로드 인터페이스
- 분석 진행 상태 표시
- 분석 결과 시각화 (Style / Character / Composition)
- 분석 강화 버튼
- 사용자 맞춤 프롬프트 입력
- 세션 저장 버튼

### 3. ImageGeneratorPanel (이미지 생성 패널)

**역할**: 참조 이미지 기반 이미지 생성

**주요 기능**:
- 세션 타입 표시 및 안내
- 프롬프트 입력 (포즈/표정 또는 추가 요소)
- 이미지 설정 (비율, 크기)
- 참조 이미지 사용 토글
- 생성 실행 및 진행 상태
- 결과 이미지 표시 및 다운로드

### 4. Sidebar (사이드바)

**역할**: 세션 목록 및 관리

**주요 기능**:
- 세션 목록 표시
- 세션 선택 및 로드
- 세션 삭제
- 세션 내보내기/가져오기
- 새 세션 시작

### 5. SaveSessionModal (세션 저장 모달)

**역할**: 세션 이름 및 타입 설정

**주요 기능**:
- 세션 이름 입력
- 세션 타입 선택 (STYLE / CHARACTER)
- 타입별 설명 표시
- 저장 및 취소

---

## 데이터 구조

### ImageAnalysisResult

```typescript
interface ImageAnalysisResult {
  style: {
    art_style: string;
    technique: string;
    color_palette: string;
    lighting: string;
    mood: string;
  };
  character: {
    gender: string;
    age_group: string;
    hair: string;
    eyes: string;
    face: string;
    outfit: string;
    accessories: string;
    body_proportions: string;      // "2-head chibi", "6-head anime" 등
    limb_proportions: string;      // "short stubby arms", "normal proportions" 등
    torso_shape: string;           // "compact rounded torso" 등
    hand_style: string;            // "simplified 3-finger", "detailed 5-finger" 등
  };
  composition: {
    pose: string;
    angle: string;
    background: string;
    depth_of_field: string;
  };
  negative_prompt: string;
  user_custom_prompt?: string;     // 사용자 맞춤 프롬프트
}
```

### Session

```typescript
interface Session {
  id: string;                      // UUID
  name: string;                    // 사용자 정의 이름
  type: 'STYLE' | 'CHARACTER';     // 세션 타입
  createdAt: string;               // ISO 8601 타임스탬프
  updatedAt: string;               // ISO 8601 타임스탬프
  referenceImages: string[];       // Base64 data URL 배열
  analysis: ImageAnalysisResult;   // 분석 결과 (영어 원본)
  koreanAnalysis?: KoreanAnalysisCache; // 번역된 결과 캐시
  imageCount: number;              // 참조 이미지 개수
  generationHistory?: GenerationHistoryEntry[]; // 생성 히스토리
}

// 번역된 분석 결과 (캐싱용)
interface KoreanAnalysisCache {
  style?: StyleAnalysis;
  character?: CharacterAnalysis;
  composition?: CompositionAnalysis;
  negativePrompt?: string;         // 한국어 번역
  positivePrompt?: string;         // 한국어 번역
  customPromptEnglish?: string;    // 사용자 맞춤 프롬프트의 영어 번역 (이미지 생성용)
}

// 생성 히스토리 엔트리
interface GenerationHistoryEntry {
  id: string;                      // UUID
  timestamp: string;               // ISO 8601
  prompt: string;                  // 사용된 프롬프트
  negativePrompt?: string;         // 사용된 네거티브 프롬프트
  additionalPrompt?: string;       // 추가 포즈/동작 프롬프트 (원본 한글 또는 영어)
  imageBase64: string;             // 생성된 이미지 (Base64)
  settings: GenerationSettings;    // 사용된 설정
}
```

---

## 프롬프트 엔지니어링

### 신체 비율 정밀 분석

**문제**: 캐릭터 생성 시 팔/다리 길이가 참조와 달라지는 문제

**해결책**:

1. **분석 단계 강화**:
   ```
   - limb_proportions: 팔과 다리의 길이를 매우 정확히 측정
     - 팔 길이: 팔을 내렸을 때 손 위치 (엉덩이? 허벅지 중간? 무릎?)
     - 다리 길이: 전체 신체 대비 비율 (50%? 60%? 70%?)

   - torso_shape: 몸통의 형태와 비율을 상세히 관찰

   - negative_prompt: 신체 비율 관련 항목 추가
     (예: "elongated arms, realistic proportions")
   ```

2. **생성 단계 강화**:
   ```
   CRITICAL BODY PROPORTIONS (MUST BE IDENTICAL):
   - Head-to-body ratio MUST be exactly the same as reference
   - Arm length MUST be exactly the same as reference
     (measure where hands reach when arms hang down)
   - Leg length MUST be exactly the same as reference
     (same proportion to total body height)
   - Torso shape and length MUST be exactly the same as reference
   - DO NOT make arms or legs longer or shorter than the reference
   - DO NOT change body proportions in any way
   ```

### 캐릭터 일관성 강제

**핵심 전략**:

1. **참조 이미지 우선 배치**: 프롬프트보다 이미지를 먼저 전송
2. **명확한 지시 구조**:
   - STEP 1: 새 포즈 적용 (최우선)
   - STEP 2: 외형 100% 복사 (필수)
   - STEP 3: 프레이밍 (전신, 흰 배경)
3. **최종 체크리스트**: 생성 전 확인 사항 명시

### 스타일 일관성 유지

**핵심 전략**:

1. **스타일 복제 최우선**: "스타일은 성경(Bible)"
2. **6가지 스타일 요소 명시**:
   - 아트 스타일 & 기법
   - 색상 & 팔레트
   - 선 & 엣지
   - 음영 & 조명
   - 텍스처 & 표면
   - 전체 미학
3. **금지 사항**: 자체 해석, 스타일 변경, 기법 수정 금지

---

## 다음 단계

### Phase 3: 생성 엔진 연동 및 고급 제어

#### 3-1. 프롬프트 믹서 (Mixer) 구현 ✅ (부분 완료)

**현재 상태**: 기본 믹서 구현 완료
- 세션 고정 프롬프트 + 사용자 입력 조합
- 사용자 맞춤 프롬프트 자동 적용
- Negative Prompt 포함

**개선 사항**:
- 더 정교한 프롬프트 가중치 시스템
- 프롬프트 미리보기 기능

#### 3-2. Image-to-Image 파이프라인 구축 🔄 (부분 완료)

**현재 상태**: 참조 이미지 기본 활용 가능

**추가 필요 사항**:
- **영향력 슬라이더** (Denoising Strength)
  - 참조 이미지의 영향 정도 조절
  - 0% (새로 생성) ~ 100% (참조 복사)
- **UI 개선**:
  - 참조 이미지 썸네일 표시
  - 영향력 슬라이더 컨트롤

#### 3-3. 고급 설정 패널

**추가 필요**:
- Temperature, Top-K, Top-P 조절
- Seed 값 설정 (재현성)
- Negative Prompt 직접 편집
- 생성 히스토리 관리

### Phase 4: 완벽한 일관성 (Consistency Mastery)

#### 4-1. 포즈 가이드 (ControlNet) 지원

**계획**:
- 스케치 캔버스 또는 포즈 이미지 업로드
- OpenPose 또는 유사 기술 연동 (가능 시)
- 참고 포즈를 `control_image`로 전송

#### 4-2. 표정/감정 변화 도구

**계획**:
- 감정 드롭다운 (Happy, Sad, Angry, Surprised 등)
- 선택 시 캐릭터 프롬프트는 유지하되 표정 키워드만 교체
- 프리셋 표정 라이브러리

#### 4-3. 비교 및 수정 (A/B Test)

**계획**:
- 한 번에 여러 이미지 생성 (배치 생성)
- 그리드 뷰로 비교
- 가장 잘 나온 이미지를 새 "캐릭터 레퍼런스"로 설정
- 순환 개선 (Iterative Refinement)

### 최종 목표: 통합 참조 이미지 생성 시스템

**개념**:
1. 여러 캐릭터 세션 선택 (예: 기사, 마법사, 도적)
2. 각 캐릭터의 포즈/표정 설정
3. 전체 장면 설명 입력 (배경, 분위기, 구도)
4. 시스템이 각 캐릭터를 개별 생성 후 합성
5. 최종 일러스트 완성

**기술적 도전**:
- 여러 캐릭터의 크기/위치 조율
- 통일된 조명 및 배경
- 자연스러운 상호작용

---

## 주요 학습 포인트

### 1. Gemini API의 특성

- **finishReason 확인 필수**: SAFETY, RECITATION, MAX_TOKENS 등 에러 처리
- **JSON 응답 파싱**: 코드 블록(```) 제거, trailing commas 처리
- **maxOutputTokens**: 복잡한 분석 시 8192로 증가 필요

### 2. 참조 이미지 기반 생성

- **이미지 순서**: 프롬프트보다 이미지를 먼저 배치하는 것이 효과적
- **명시적 지시**: "EXACT SAME", "MUST", "DO NOT" 같은 강력한 표현 필요
- **체크리스트**: 생성 전 확인 사항 명시로 정확도 향상

### 3. 신체 비율 문제

- **상세 분석 필요**: "body_proportions"만으로는 부족, limb별 세부 분석 필수
- **반복 강조**: 생성 프롬프트에서 비율 유지를 여러 번 강조
- **Negative Prompt 활용**: "elongated arms" 같은 구체적인 회피 요소 명시

### 4. UX/UI 개선

- **세션 타입별 차별화**: 색상, 아이콘, 안내 문구로 명확히 구분
- **자동 적용 표시**: 사용자 맞춤 프롬프트가 자동 적용됨을 명시
- **진행 상태 피드백**: 모든 비동기 작업에 로딩/진행 상태 표시

---

## 알려진 이슈 및 제한사항

### 1. Gemini 3 Pro Image Preview 제약

- **베타 API**: 불안정할 수 있음, 갑자기 변경될 가능성
- **참조 이미지 최대 14개**: 그 이상은 자동으로 잘림
- **생성 시간**: 2K 이미지 기준 10-30초 소요
- **완벽한 일관성 어려움**: 복잡한 캐릭터는 여전히 변형 가능

### 2. 로컬 저장소 제약

- **LocalStorage 용량 제한**: 브라우저마다 다름 (일반적으로 5-10MB)
- **Base64 이미지 크기**: 많은 세션 저장 시 용량 초과 가능
- **해결 방안**: 향후 SQLite로 마이그레이션 고려

### 3. 이미지 품질

- **압축**: Base64 변환 과정에서 약간의 품질 저하
- **해상도**: 4K 옵션도 실제로는 제한적
- **아티팩트**: 가끔 이상한 노이즈나 왜곡 발생

---

## 파일 구조

```
StyleStudio-Tauri/
├── src/
│   ├── components/          # React 컴포넌트
│   │   ├── analysis/        # 분석 관련 컴포넌트
│   │   │   ├── AnalysisPanel.tsx
│   │   │   ├── AnalysisCard.tsx      # 통합 카드 컴포넌트
│   │   │   ├── StyleCard.tsx
│   │   │   ├── CharacterCard.tsx
│   │   │   ├── CompositionCard.tsx
│   │   │   ├── NegativePromptCard.tsx
│   │   │   ├── CustomPromptCard.tsx  # 사용자 맞춤 프롬프트
│   │   │   └── UnifiedPromptCard.tsx # 통합 프롬프트 (표시 전용)
│   │   ├── generator/       # 이미지 생성 관련 컴포넌트
│   │   │   ├── ImageGeneratorPanel.tsx
│   │   │   └── ImageUpload.tsx
│   │   ├── common/          # 공통 컴포넌트
│   │   │   ├── Sidebar.tsx
│   │   │   ├── SaveSessionModal.tsx
│   │   │   ├── SettingsModal.tsx
│   │   │   ├── ProgressIndicator.tsx # 진행 상태 표시
│   │   │   └── ErrorBoundary.tsx    # 에러 처리
│   │   └── Header.tsx
│   ├── hooks/               # 커스텀 훅
│   │   ├── api/             # API 관련 Hook
│   │   │   ├── useGeminiAnalyzer.ts
│   │   │   ├── useGeminiImageGenerator.ts
│   │   │   └── useGeminiTranslator.ts
│   │   ├── useTranslation.ts        # 번역 로직 중앙화
│   │   ├── useSessionPersistence.ts # 세션 저장 및 번역 통합
│   │   ├── useSessionManagement.ts # 세션 관리
│   │   ├── useImageHandling.ts     # 이미지 처리
│   │   ├── useAutoSave.ts          # 자동 저장 (분석 카드 편집용)
│   │   └── useFieldEditor.ts      # 필드 편집
│   ├── lib/                 # 유틸리티 및 라이브러리
│   │   ├── gemini/
│   │   │   └── analysisPrompt.ts
│   │   ├── storage.ts
│   │   ├── promptBuilder.ts
│   │   ├── logger.ts               # 환경별 로깅
│   │   └── analysisComparator.ts   # 변경 감지 시스템 (레거시)
│   ├── utils/               # 유틸리티 함수
│   │   └── sessionHelpers.ts      # 세션 헬퍼 함수
│   ├── types/               # TypeScript 타입 정의
│   │   ├── analysis.ts
│   │   └── session.ts
│   ├── App.tsx              # 메인 앱
│   ├── main.tsx             # 엔트리 포인트
│   └── index.css            # 전역 스타일
├── src-tauri/               # Tauri 백엔드
│   ├── src/
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── public/                  # 정적 파일
├── Plans/                   # 계획 및 문서
│   ├── STYLE_STUDIO_PLAN.md
│   └── STYLE_STUDIO_IMPLEMENTATION_STATUS.md (이 파일)
└── package.json
```

---

## 참고 자료

### Gemini API

- [Gemini API 공식 문서](https://ai.google.dev/docs)
- [Gemini 3 Pro Image Preview](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro)
- [Vision 및 Multimodal](https://ai.google.dev/gemini-api/docs/vision)

### Tauri

- [Tauri 공식 문서](https://tauri.app/)
- [Tauri 2.x Guide](https://v2.tauri.app/start/)

### React + TypeScript

- [React 공식 문서](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 개발 팁

### 디버깅

1. **콘솔 로그 활용**: 모든 주요 함수에 로그 추가됨
   ```
   🔑 - API Key 관련
   📷 - 이미지 관련
   🌐 - API 요청 관련
   ✅ - 성공
   ❌ - 오류
   ⚠️ - 경고
   ```

2. **Gemini 응답 확인**: 콘솔에서 전체 JSON 응답 확인 가능

3. **세션 디버깅**: LocalStorage 직접 확인
   ```javascript
   // 브라우저 콘솔에서
   JSON.parse(localStorage.getItem('style-studio-sessions'))
   ```

### 테스트

1. **다양한 이미지 테스트**: chibi, 리얼리즘, 픽셀 아트 등
2. **극단적 케이스**: 매우 긴 팔, 매우 짧은 다리 등
3. **여러 이미지 분석**: 일관성 테스트

### 최적화

1. **이미지 크기**: 분석 전 리사이즈 고려 (현재 원본 사용)
2. **API 호출 최소화**: 캐싱 전략 고려
3. **LocalStorage 관리**: 주기적인 정리 필요

---

## 마무리

**Style & Character Studio**는 Phase 2까지 성공적으로 구현되었으며, 핵심 기능인 **스타일 분석**, **캐릭터 일관성 유지**, **세션 관리**, **번역 시스템**이 모두 작동합니다.

**번역 시스템**은 변경 감지 기반 선택적 번역을 통해 세션 저장 시간을 최대 **99.9%** 단축시켜 사용자 경험을 크게 개선했습니다. 번역 로직을 중앙화하고 세션 저장과 통합하여 더욱 효율적인 시스템으로 개편했습니다.

**주요 개선 사항**:
- 번역 로직 중앙화 (`useTranslation.ts`)
- 세션 저장과 번역 통합 (`useSessionPersistence.ts`)
- 컴포넌트 구조 리팩토링 (analysis/, generator/, common/ 디렉토리 분리)
- Hook 구조 개선 (api/, utils/ 디렉토리 분리)
- 카드 컴포넌트 통합 (`AnalysisCard.tsx`)
- 로깅 시스템 개선 (`logger.ts`)
- 세션 관리 개선 (빈 세션 즉시 생성, 삭제 확인 다이얼로그)
- UI/UX 개선 (편집 모드 언어 유지, 진행 상태 표시)

다음 단계는 **Phase 3 (고급 제어)**와 **Phase 4 (완벽한 일관성)**를 통해 더욱 정교한 제어와 여러 캐릭터 통합 생성 기능을 구현하는 것입니다.

프로젝트는 최종 목표인 **"여러 캐릭터 세션을 통합하여 하나의 완성된 일러스트 생성"**을 향해 순조롭게 진행 중입니다.

---

**문서 버전**: 3.0
**작성일**: 2026-01-03
**주요 업데이트**: 번역 시스템 대폭 개편, 컴포넌트 구조 리팩토링, Hook 구조 개선, 세션 관리 개선
**다음 업데이트 예정**: Phase 3 완료 시
