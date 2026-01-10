# Style & Character Studio - 구현 현황 문서

> **최종 업데이트**: 2026-01-10
> **버전**: 6.0
> **상태**: Phase 3 완료, 7가지 세션 타입 지원 (픽셀아트 포함)

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

## 세션 타입 (7가지)

| 타입 | 아이콘 | 색상 | 목적 | 참조 이미지 | Grid 지원 |
|------|--------|------|------|------------|---------|
| **STYLE** | 🎨 Palette | 보라색 | 특정 화풍/아트 스타일 재현 | 선택 | ✗ |
| **CHARACTER** | 👤 User | 파란색 | 캐릭터 외형 유지, 포즈 변경 | 필수 | ✗ |
| **BACKGROUND** | ⛰️ Mountain | 녹색 | 배경 스타일 학습, 다양한 환경 생성 | 필수 | ✗ |
| **ICON** | 📦 Box | 주황색 | 아이템/아이콘 스타일 학습, 오브젝트 생성 | 필수 | ✓ (1x1~8x8) |
| **PIXELART_CHARACTER** | 🎮 Gamepad2 | 마젠타 | 픽셀아트 캐릭터 학습, 애니메이션 시트 생성 | 필수 | ✓ (1x1~8x8) |
| **PIXELART_BACKGROUND** | 🏞️ Grid3x3 | 청록색 | 픽셀아트 배경 학습, 게임 씬 생성 | 필수 | ✓ (1x1~8x8) |
| **PIXELART_ICON** | ✨ Sparkles | 인디고 | 픽셀아트 아이콘 학습, UI 요소 생성 | 필수 | ✓ (1x1~8x8) |

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
  - Grid 지원 (1x1 ~ 8x8): 여러 아이콘 세트 동시 생성

- **PIXELART_CHARACTER**: 픽셀아트 캐릭터 스프라이트 시트 생성
  - 픽셀 단위 정밀 복사 (1px 외곽선, 색상 팔레트, 해상도)
  - 현대 픽셀아트 음영 기법 (Hue shifting, Color banding)
  - Grid 지원 (1x1 ~ 8x8): 애니메이션 시퀀스 생성
  - 자동 업스케일링 지원

- **PIXELART_BACKGROUND**: 픽셀아트 배경 바리에이션 생성
  - 픽셀 단위 스타일 복사 (타일, 색상, 시점)
  - 환경 바리에이션 (시간대, 날씨, 각도)
  - Grid 지원 (1x1 ~ 8x8): 여러 씬 동시 생성
  - 비율 정확도 향상 (레터박스 방지)
  - 자동 업스케일링 지원

- **PIXELART_ICON**: 픽셀아트 아이콘 세트 생성
  - 픽셀 단위 스타일 복사 (외곽선, 음영, 배경)
  - UI 가독성 최적화
  - Grid 지원 (1x1 ~ 8x8): 아이템 세트 동시 생성
  - 자동 업스케일링 지원

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

## 최신 업데이트

### 2026-01-10: 수동 이미지 저장 기능 추가 (오후)

#### 기능 개요
- **자동 저장**: 이미지 생성 시 자동으로 지정된 폴더에 저장
- **수동 저장**: 사용자가 다운로드 버튼 클릭 시 원하는 위치에 저장 가능
- **경로 툴팁**: 저장 폴더 경로에 마우스 호버 시 전체 경로 표시

#### 구현 내용
1. **다운로드 버튼 추가**:
   - 위치: 생성된 이미지 좌측 상단 오버레이
   - 스타일: 반투명 배경 + 그림자, 호버 시 강조
   - 아이콘: `Download` (lucide-react)

2. **수동 저장 함수** (`handleManualSave`):
   - OS 네이티브 저장 다이얼로그 사용 (`@tauri-apps/plugin-dialog`의 `save`)
   - 기본 저장 경로: 사용자 지정 폴더 또는 `Downloads/AI_Gen`
   - 기본 파일명: `style-studio-[timestamp].jpg`
   - 덮어쓰기 확인: OS 다이얼로그에서 자동 처리

3. **저장 폴더 경로 표시 개선** (커스텀 툴팁):
   - 폴더 이름만 표시 (예: `AI_Gen`)
   - 마우스 호버 시 전체 경로 커스텀 툴팁 표시
   - 툴팁 위치: 오른쪽 정렬 (`right-0`) → 화면 끝에서도 잘리지 않음
   - 툴팁 스타일: 어두운 배경 (`bg-gray-900`), 그림자 효과, 애니메이션
   - 호버 시 배경색 변경으로 인터랙티브 피드백
   - 커서가 물음표 모양(`cursor-help`)으로 변경되어 툴팁 존재 표시

4. **구현 위치**:
   - Import 수정: `ImageGeneratorPanel.tsx:1-5`
   - 툴팁 상태 관리: `ImageGeneratorPanel.tsx:65-66`
   - 수동 저장 함수: `ImageGeneratorPanel.tsx:323-387`
   - UI 버튼: `ImageGeneratorPanel.tsx:1044-1050`
   - 커스텀 툴팁: `ImageGeneratorPanel.tsx:496-519`

#### 사용 흐름
1. 이미지 생성 완료
2. 자동으로 지정된 폴더에 저장
3. 사용자가 다운로드 버튼 클릭 (선택사항)
4. OS 네이티브 저장 다이얼로그 표시
5. 사용자가 경로 및 파일명 지정
6. 동일한 파일명이 있으면 OS가 덮어쓰기 확인
7. 저장 완료 후 경로 알림

### 2026-01-10: macOS 썸네일 표시 수정 (오후)

#### 문제 진단
- **이슈**: 자동 저장된 파일이 macOS Finder에서 썸네일 표시 안 됨 (일반 문서 아이콘만 표시)
- **원인**: 파일 확장자는 `.png`이지만 실제 파일 형식은 **JPEG** (Gemini API가 JPEG 데이터 반환)
- **확인 방법**: `file *.png` 명령으로 "JPEG image data" 출력 확인

#### 해결 방법
- **파일 확장자 변경**: `.png` → `.jpg`로 변경
- **구현 위치**: `ImageGeneratorPanel.tsx:276-321`
- **핵심 변경**:
  ```typescript
  // 기존
  const fileName = `style-studio-${timestamp}.png`;

  // 수정
  const fileName = `style-studio-${timestamp}.jpg`;
  ```

#### 결과
- ✅ 파일 형식과 확장자 일치
- ✅ macOS Finder에서 썸네일 정상 표시
- ✅ Quick Look 미리보기 지원
- ✅ 불필요한 재인코딩 단계 제거 (성능 향상)

### 2026-01-10: 픽셀아트 확장 및 Grid 시스템 강화

#### 1. PIXELART_ICON 세션 타입 추가
- **픽셀아트 아이콘 생성**: UI 요소 및 게임 아이템 아이콘 생성
- **Grid 지원 (1x1 ~ 8x8)**: 최대 64개 아이콘 세트 동시 생성
- **스타일 일관성**: 픽셀 단위 정밀 복사

#### 2. ICON 타입 Grid 지원 추가
- **Grid 옵션 (1x1 ~ 8x8)**: 일반 아이콘도 그리드 레이아웃 지원
- **여러 아이콘 동시 생성**: 바리에이션, 레벨, 색상 다양화

#### 3. Grid 옵션 확장
- **6x6 Grid (36프레임)**: 복잡한 애니메이션 및 대형 아이콘 세트
- **8x8 Grid (64프레임)**: 매우 상세한 애니메이션 및 초대형 아이콘 세트
- **UI 개선**: NxN 형식으로 간결하게 표시, 3열 2줄 배치

#### 4. 최신 픽셀아트 표현방식 적용
- **Dithering 제거**: 오래된 기법 제거
- **Hue shifting**: 색상 변화로 명암 표현
- **Color banding**: 명확한 색상 띠로 구분
- **Cell shading**: 애니메이션 스타일 음영
- **Gradient banding**: 부드러운 색상 전환을 단계적 띠로 표현

#### 5. 픽셀아트 배경 비율 문제 해결
- **레터박스 방지**: 9:16, 16:9 등 비율 선택 시 화면 전체 채움
- **정확한 비율 준수**: 픽셀아트가 지정된 비율로 정확히 생성

### 2026-01-07: 4가지 세션 타입 지원

- **BACKGROUND 타입 추가**: 배경 스타일 학습 및 다양한 환경 생성
- **ICON 타입 추가**: 아이템/아이콘 스타일 학습 및 오브젝트 생성
- **NewSessionModal**: 신규 세션 생성 시 타입 선택 모달 추가
- **Sidebar**: 4가지 타입별 아이콘 및 색상 구분
- **ImageGeneratorPanel**: 타입별 프롬프트 플레이스홀더 및 안내 문구
- **useGeminiImageGenerator**: BACKGROUND, ICON 타입별 생성 프롬프트 추가
- **커스텀 다이얼로그**: window.confirm 대신 React 다이얼로그 사용 (Tauri 환경 최적화)
- **번역 수행**: 분석 강화 후에도 즉시 한국어 번역
- **3개 버튼 레이아웃**: 분석 강화, 세션 저장, 이미지 생성 버튼이 한 라인에 표시

---

## 구현 완료 기능

- ✅ Tauri 2.x 프로젝트 구조
- ✅ 7가지 세션 타입 (STYLE, CHARACTER, BACKGROUND, ICON, PIXELART_CHARACTER, PIXELART_BACKGROUND, PIXELART_ICON)
- ✅ 이미지 분석 (Gemini 2.5 Flash)
  - 픽셀아트 전용 분석 프롬프트
  - 현대 픽셀아트 음영 기법 (Hue shifting, Color banding)
- ✅ 번역 시스템 (변경 감지 기반 선택적 번역)
- ✅ 세션 관리 (신규 생성, 저장, 로드, 내보내기/가져오기)
- ✅ 이미지 생성 (Gemini 3 Pro Image Preview)
  - Grid 시스템 (1x1 ~ 8x8): 픽셀아트 & 아이콘 타입
  - 픽셀아트 비율 정확도 향상 (레터박스 방지)
- ✅ 고급 설정 (Seed, Temperature, Top-K, Top-P, Reference Strength)
- ✅ 프리셋 시스템
- ✅ 생성 히스토리 (핀 기능 포함)
- ✅ 드래그 앤 드롭 (Tauri 네이티브 API)
- ✅ 자동 저장 (분석 카드 편집 시)

---

## Grid 시스템 상세

### 지원 타입
- **ICON**: 1x1 ~ 8x8 (최대 64개 아이콘)
- **PIXELART_CHARACTER**: 1x1 ~ 8x8 (최대 64프레임 애니메이션)
- **PIXELART_BACKGROUND**: 1x1 ~ 8x8 (최대 64개 배경 바리에이션)
- **PIXELART_ICON**: 1x1 ~ 8x8 (최대 64개 픽셀아트 아이콘)

### Grid 옵션

| Grid | 프레임 수 | 셀 크기 | 권장 픽셀 크기 | 용도 |
|------|----------|---------|-------------|------|
| 1x1 | 1 | 1024px | 256px | 단일 이미지/아이콘 |
| 2x2 | 4 | 512px | 128px | 간단한 바리에이션 |
| 4x4 | 16 | 256px | 64px | 기본 애니메이션 시퀀스 |
| 6x6 | 36 | 170px | 42px | 복잡한 애니메이션/대형 세트 |
| 8x8 | 64 | 128px | 32px | 매우 상세한 애니메이션/초대형 세트 |

### 특징
- **정확한 그리드 배치**: ASCII 그리드 구조 프롬프트로 정확한 위치 지정
- **픽셀 퍼펙트**: 픽셀아트는 정수 좌표 그리드에 정렬
- **자동 업스케일링**: 픽셀아트는 생성 후 자동으로 확대 (Nearest Neighbor)
- **검은 배경**: 쉬운 프레임 분리를 위한 #000000 배경

---

**문서 버전**: 6.0
**작성일**: 2026-01-10
**다음 단계**: 여러 캐릭터 세션 통합 생성 시스템
