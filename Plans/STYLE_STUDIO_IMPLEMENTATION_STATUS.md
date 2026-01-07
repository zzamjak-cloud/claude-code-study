# Style & Character Studio - 구현 현황 문서

> **최종 업데이트**: 2026-01-07
> **버전**: 5.0
> **상태**: Phase 3 완료, 4가지 세션 타입 지원

---

## 프로젝트 개요

**Style & Character Studio**는 Google Gemini를 활용하여 이미지의 스타일과 캐릭터를 분석하고, 일관성 있는 이미지를 생성하는 Tauri 기반 데스크톱 애플리케이션입니다.

### 핵심 역할

- **Gemini 2.5 Flash**: 이미지 분석 (스타일, 캐릭터, 구도)
- **Gemini 3 Pro Image Preview**: 참조 이미지 기반 이미지 생성
- **앱**: 분석과 생성을 조율하고 세션으로 관리

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **App Shell** | Tauri 2.x (Rust) |
| **Frontend** | Vite + React + TypeScript |
| **Styling** | TailwindCSS |
| **State** | React Hooks |
| **Storage** | LocalStorage (Base64 이미지 포함) |
| **AI** | Gemini 2.5 Flash (분석), Gemini 3 Pro Image (생성) |

---

## 세션 타입 (4가지)

| 타입 | 아이콘 | 색상 | 목적 | 참조 이미지 |
|------|--------|------|------|------------|
| **STYLE** | 🎨 Palette | 보라색 | 특정 화풍/아트 스타일 재현 | 선택 |
| **CHARACTER** | 👤 User | 파란색 | 캐릭터 외형 유지, 포즈 변경 | 필수 |
| **BACKGROUND** | ⛰️ Mountain | 녹색 | 배경 스타일 학습, 다양한 환경 생성 | 필수 |
| **ICON** | 📦 Box | 주황색 | 아이템/아이콘 스타일 학습, 오브젝트 생성 | 필수 |

---

## 주요 기능

### 1. 이미지 분석

- **드래그 앤 드롭** 또는 **파일 선택**으로 이미지 업로드
- Gemini 2.5 Flash가 JSON 형식으로 분석:
  - **Style**: art_style, technique, color_palette, lighting, mood
  - **Character**: gender, age_group, hair, eyes, face, outfit, accessories, body_proportions, limb_proportions, torso_shape, hand_style
  - **Composition**: pose, angle, background, depth_of_field
  - **Negative Prompt**: 피해야 할 요소 자동 생성
  - **User Custom Prompt**: 사용자 맞춤 프롬프트 (선택)
- **분석 강화**: 기존 세션에 새 이미지 추가하여 분석 정확도 향상

### 2. 번역 시스템

- **자동 번역**: 분석 결과 영어 → 한국어 자동 번역
- **변경 감지**: 수정된 섹션만 선택적 번역
- **성능 최적화**:
  - 최초 분석 + 번역: 7-10초
  - 변경 없이 저장: <0.01초 (99.9% 단축)
  - 변경 후 저장: 1-3초 (86-90% 단축)

### 3. 세션 관리

- **신규 세션 생성**: 모달에서 타입 선택 + 이름 입력
- **세션 저장**: LocalStorage에 자동 저장 (이미지 Base64 포함)
- **세션 로드**: 사이드바에서 선택하여 즉시 복원
- **내보내기/가져오기**: JSON 파일로 백업 및 복원
- **세션 재정렬**: 드래그 앤 드롭으로 순서 변경
- **삭제 확인**: 커스텀 다이얼로그 (Tauri 환경 최적화)

### 4. 이미지 생성

#### 세션 타입별 생성 전략

- **CHARACTER**: 캐릭터 외형 100% 유지 + 포즈 변경
  - 신체 비율 정밀 복사 (head-to-body ratio, limb proportions)
  - 얼굴, 머리, 의상 디테일 완벽 유지
  - 순백색 배경, 전신 표시

- **STYLE**: 스타일 복제 최우선
  - 아트 스타일, 기법, 색상, 조명 완벽 복사
  - 피사체/구도는 사용자 프롬프트에 따라 변경

- **BACKGROUND**: 배경 스타일 유지 + 환경 변경
  - 색상 팔레트, 조명, 분위기 복사
  - 캐릭터 없이 순수 환경만 생성

- **ICON**: 아이콘 스타일 유지 + 오브젝트 변경
  - 형태, 라인, 색상, 음영 스타일 복사
  - 명확한 실루엣, 단일 오브젝트 중심

#### 고급 설정

- **이미지 설정**: 비율 (1:1, 16:9, 9:16, 4:3, 3:4), 크기 (1K, 2K, 4K)
- **참조 영향력**: 0.0 (영감만) ~ 1.0 (완벽 복사)
- **고급 파라미터**: Seed, Temperature (0.0~2.0), Top-K (1~100), Top-P (0.0~1.0)
- **프리셋**:
  - 포즈/표정 변화 (Temp 0.8, Ref 0.95)
  - 다양한 캐릭터 디자인 (Temp 1.2, Ref 0.6)
  - 헤어/의상 변경 (Temp 1.0, Ref 0.85)

#### 생성 히스토리

- **썸네일 그리드**: 생성한 모든 이미지 히스토리 저장
- **핀 기능**: 즐겨찾기 표시 (노란색 테두리)
- **설정 복원**: 히스토리에서 설정값 불러오기
- **개별 삭제**: 확인 다이얼로그

---

## 데이터 구조

### SessionType

```typescript
export type SessionType = 'STYLE' | 'CHARACTER' | 'BACKGROUND' | 'ICON';
```

### Session

```typescript
interface Session {
  id: string;                      // UUID
  name: string;                    // 사용자 정의 이름
  type: SessionType;               // 세션 타입
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
  referenceImages: string[];       // Base64 data URL 배열
  analysis: ImageAnalysisResult;   // 분석 결과 (영어 원본)
  koreanAnalysis?: KoreanAnalysisCache; // 번역 캐시
  imageCount: number;              // 참조 이미지 개수
  generationHistory?: GenerationHistoryEntry[]; // 생성 히스토리
}
```

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
    body_proportions: string;
    limb_proportions: string;
    torso_shape: string;
    hand_style: string;
  };
  composition: {
    pose: string;
    angle: string;
    background: string;
    depth_of_field: string;
  };
  negative_prompt: string;
  user_custom_prompt?: string;
}
```

### KoreanAnalysisCache

```typescript
interface KoreanAnalysisCache {
  style?: StyleAnalysis;
  character?: CharacterAnalysis;
  composition?: CompositionAnalysis;
  negativePrompt?: string;
  positivePrompt?: string;
  customPromptEnglish?: string;    // 이미지 생성용 영어 번역
}
```

---

## 파일 구조

```
StyleStudio-Tauri/
├── src/
│   ├── components/
│   │   ├── analysis/              # 분석 패널 및 카드
│   │   │   ├── AnalysisPanel.tsx
│   │   │   ├── StyleCard.tsx
│   │   │   ├── CharacterCard.tsx
│   │   │   ├── CompositionCard.tsx
│   │   │   ├── NegativePromptCard.tsx
│   │   │   ├── CustomPromptCard.tsx
│   │   │   └── UnifiedPromptCard.tsx
│   │   ├── generator/             # 이미지 생성
│   │   │   ├── ImageGeneratorPanel.tsx
│   │   │   └── ImageUpload.tsx
│   │   └── common/                # 공통 컴포넌트
│   │       ├── Sidebar.tsx
│   │       ├── NewSessionModal.tsx     # 신규 세션 생성 (4가지 타입)
│   │       ├── SaveSessionModal.tsx
│   │       ├── SettingsModal.tsx
│   │       └── ProgressIndicator.tsx
│   ├── hooks/
│   │   ├── api/
│   │   │   ├── useGeminiAnalyzer.ts
│   │   │   ├── useGeminiImageGenerator.ts  # BACKGROUND, ICON 프롬프트 포함
│   │   │   └── useGeminiTranslator.ts
│   │   ├── useTranslation.ts      # 번역 로직 중앙화
│   │   ├── useSessionPersistence.ts  # 세션 저장 + 번역 통합
│   │   ├── useSessionManagement.ts
│   │   ├── useImageHandling.ts
│   │   └── useAutoSave.ts         # 분석 카드 편집 자동 저장
│   ├── lib/
│   │   ├── gemini/
│   │   │   └── analysisPrompt.ts  # 분석 프롬프트
│   │   ├── storage.ts
│   │   ├── promptBuilder.ts
│   │   └── logger.ts
│   ├── types/
│   │   ├── analysis.ts
│   │   └── session.ts
│   ├── App.tsx
│   └── main.tsx
└── src-tauri/
    ├── src/lib.rs
    ├── Cargo.toml
    └── tauri.conf.json
```

---

## 핵심 Hook 구조

### App.tsx

```typescript
// 이미지 처리
const { uploadedImages, setUploadedImages, handleImageSelect, handleRemoveImage } =
  useImageHandling();

// 세션 관리
const { apiKey, sessions, currentSession, setCurrentSession, ... } =
  useSessionManagement();

// 번역
const { translateAnalysisResult, hasChangesToTranslate, translateAndUpdateCache } =
  useTranslation();

// 세션 저장 (번역 통합)
const { saveProgress, saveSession } = useSessionPersistence({
  apiKey,
  currentSession,
  sessions,
  setSessions,
  setCurrentSession,
  analysisResult,
  uploadedImages,
});

// Gemini 분석
const { analyzeImages } = useGeminiAnalyzer();

// 자동 저장 (분석 카드 편집용)
const { progress } = useAutoSave({
  currentSession,
  analysisResult,
  apiKey,
  uploadedImages,
  onSessionUpdate: handleSessionUpdate,
  autoSaveEnabled: true,
});
```

---

## 알려진 이슈

### 1. Gemini 3 Pro Image Preview 제약

- **베타 API**: 불안정, 변경 가능성
- **참조 이미지 최대 14개**
- **생성 시간**: 2K 기준 10-30초
- **완벽한 일관성 어려움**: 복잡한 캐릭터는 변형 가능

### 2. 로컬 저장소 제약

- **LocalStorage 용량 제한**: 5-10MB (브라우저마다 다름)
- **Base64 이미지 크기**: 많은 세션 저장 시 용량 초과 가능

### 3. Phase 4-1 제거 (2026-01-07)

- **포즈 가이드 기능 제거**: 포즈 가이드 이미지 첨부 시 참조 이미지 스타일을 무시하는 문제로 제거
- **대안**: 텍스트 프롬프트로 포즈 설명하는 방식이 더 안정적

---

## 최신 업데이트 (2026-01-07)

### 4가지 세션 타입 지원

- **BACKGROUND 타입 추가**: 배경 스타일 학습 및 다양한 환경 생성
- **ICON 타입 추가**: 아이템/아이콘 스타일 학습 및 오브젝트 생성
- **NewSessionModal**: 신규 세션 생성 시 타입 선택 모달 추가
- **Sidebar**: 4가지 타입별 아이콘 및 색상 구분
- **ImageGeneratorPanel**: 타입별 프롬프트 플레이스홀더 및 안내 문구
- **useGeminiImageGenerator**: BACKGROUND, ICON 타입별 생성 프롬프트 추가

### 분석 강화 개선

- **커스텀 다이얼로그**: window.confirm 대신 React 다이얼로그 사용 (Tauri 환경 최적화)
- **번역 수행**: 분석 강화 후에도 즉시 한국어 번역
- **3개 버튼 레이아웃**: 분석 강화, 세션 저장, 이미지 생성 버튼이 한 라인에 표시

---

## 구현 완료 기능

- ✅ Tauri 2.x 프로젝트 구조
- ✅ 4가지 세션 타입 (STYLE, CHARACTER, BACKGROUND, ICON)
- ✅ 이미지 분석 (Gemini 2.5 Flash)
- ✅ 번역 시스템 (변경 감지 기반 선택적 번역)
- ✅ 세션 관리 (신규 생성, 저장, 로드, 내보내기/가져오기)
- ✅ 이미지 생성 (Gemini 3 Pro Image Preview)
- ✅ 고급 설정 (Seed, Temperature, Top-K, Top-P, Reference Strength)
- ✅ 프리셋 시스템
- ✅ 생성 히스토리 (핀 기능 포함)
- ✅ 드래그 앤 드롭 (Tauri 네이티브 API)
- ✅ 자동 저장 (분석 카드 편집 시)

---

**문서 버전**: 5.0
**작성일**: 2026-01-07
**다음 단계**: 여러 캐릭터 세션 통합 생성 시스템
