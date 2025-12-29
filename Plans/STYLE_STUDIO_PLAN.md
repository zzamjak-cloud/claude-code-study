# Style Studio 프로젝트 계획서 검토 및 실행 계획

## 🎯 요약

**원본 계획서**: `/Users/woody/Desktop/AI/claude-code-study/Plans/STYLE_STUDIO_PLAN.md`

**프로젝트 개요**:
Gemini로 이미지의 스타일/캐릭터를 분석하고, 이를 자산(Asset)으로 저장하여 일관성 있는 이미지 생성을 수행하는 로컬 데스크톱 앱

**핵심 기술:**
- **분석**: Gemini 2.5 Flash (이미지 → JSON 구조화)
- **생성**: Gemini 3 Pro Preview (Nano Banana Pro)
- **플랫폼**: Tauri + React + TypeScript

**확정된 방향:**
- ✅ 새 독립 프로젝트 (`StyleStudio-Tauri`)
- ✅ MVP는 Phase 1만 (이미지 분석 + 세션 저장)
- ✅ Tauri Store로 데이터 관리

---

## 📋 계획서 검토 결과

### ✅ 강점 (Strengths)

1. **명확한 컨셉**
   - Gemini = 분석가, Nano Banana Pro = 화가, 앱 = 감독 역할 정의가 명확함
   - 스타일과 캐릭터를 "자산(Asset)"으로 관리하는 개념이 우수함

2. **적절한 기술 스택**
   - Tauri: 경량화, 보안, OS 통합에 최적
   - React + Vite: 빠른 개발 및 핫 리로드
   - TailwindCSS: 일관된 UI 디자인
   - Zustand + SQLite: 상태 관리와 영구 저장 분리
   - Gemini API: 멀티모달 비전 분석 가능

3. **단계별 로드맵**
   - Phase 1-4로 점진적 개발 가능
   - 각 단계마다 명확한 목표와 기능 정의

4. **기존 코드베이스 활용 가능**
   - GamePlanner-Tauri 프로젝트에 이미 대부분의 의존성 설치됨
   - 유사한 아키텍처 (Sidebar, ChatPanel, MarkdownPreview 구조)
   - Gemini API 통합 경험 있음

### ⚠️ 개선 필요 사항 (Concerns)

1. **이미지 생성 모델 명확화 ✅**
   - **Nano Banana Pro = Gemini 3 Pro Preview (gemini-3-pro-preview)**
   - Google Gemini API 사용 (이미지 생성 기능)
   - 기존 GamePlanner-Tauri의 Gemini 연동 패턴 재사용 가능
   - **해결됨**: Gemini API로 통일되어 연동 복잡도 대폭 감소

2. **SQLite 대신 Tauri Store 사용 권장**
   - GamePlanner-Tauri는 이미 `@tauri-apps/plugin-store` 사용 중
   - SQLite 추가 시 복잡도 증가 (Rust 바인딩, 마이그레이션 등)
   - Tauri Store로도 세션/프롬프트 관리 충분히 가능
   - **권장**: SQLite 대신 Tauri Store 활용

3. **ControlNet 지원 구현 난이도**
   - Phase 4의 포즈 가이드(ControlNet)는 고급 기능
   - 스케치 캔버스 구현 복잡도 높음
   - Nano Banana Pro가 ControlNet을 지원하는지 확인 필요
   - **권장**: Phase 4는 선택적 기능으로 후순위 배치

4. **프로젝트 위치 및 구조**
   - 새 프로젝트를 어디에 만들 것인지 결정 필요
   - GamePlanner-Tauri 코드 재사용 vs 완전히 새 프로젝트
   - **결정 필요**: 프로젝트 생성 방식

## 🎯 권장 접근 방식

### Option A: 독립 프로젝트 (권장)
새로운 `StyleStudio-Tauri` 폴더에 프로젝트 생성
- GamePlanner-Tauri의 구조를 템플릿으로 활용
- 깔끔한 코드베이스로 시작
- 향후 배포/유지보수 용이
- Gemini API 연동 패턴을 그대로 복사 가능

### Option B: 통합 프로젝트
GamePlanner-Tauri에 Style Studio 기능 추가
- 기존 인프라 재사용 (API 키 관리, 세션 시스템)
- 개발 속도 빠름 (useGeminiChat 훅 재사용)
- 앱이 다기능화되어 복잡해질 수 있음
- 세션 타입에 `STYLE_STUDIO` 추가만으로 시작 가능

## 📝 실행 계획 (Phase 1 우선)

### 사전 결정 사항 (의사 결정 필요)

1. **프로젝트 구조** ⭐ 가장 중요
   - [ ] 새 독립 프로젝트 생성 (StyleStudio-Tauri) - 깔끔하고 유지보수 용이
   - [ ] 기존 프로젝트에 통합 (GamePlanner-Tauri) - 빠른 개발, 인프라 재사용

2. **데이터 저장 방식**
   - [ ] Tauri Store (권장) - 기존 코드 패턴과 일치
   - [ ] SQLite - 더 복잡한 쿼리 필요 시

### Phase 1: 기반 구축 및 지능형 분석기

#### 1-1. 프로젝트 초기화 (선택에 따라)

**A안 (독립 프로젝트):**
```bash
# 새 Tauri 프로젝트 생성
cd /Users/woody/Desktop/AI/claude-code-study
npm create tauri-app@latest StyleStudio-Tauri

# 선택 사항:
# - Package manager: npm
# - UI template: React + TypeScript
# - UI flavor: Vite

# 필요한 의존성 설치
cd StyleStudio-Tauri
npm install @google/generative-ai zustand class-variance-authority clsx tailwind-merge lucide-react
npm install @tauri-apps/plugin-store @tauri-apps/plugin-dialog @tauri-apps/plugin-fs @tauri-apps/plugin-http
npm install -D @tailwindcss/typography
```

**B안 (통합 프로젝트):**
- GamePlanner-Tauri에 새 라우트/뷰 추가
- 세션 타입에 `STYLE_STUDIO` 추가

#### 1-2. 파일 구조 설계

```
src/
├── components/
│   ├── StyleStudio/
│   │   ├── ImageUpload.tsx          # 드래그앤드롭 이미지 업로드
│   │   ├── AnalysisResult.tsx       # 분석 결과 카드 UI
│   │   ├── StyleCard.tsx            # 스타일 태그 카드
│   │   ├── CharacterCard.tsx        # 캐릭터 태그 카드
│   │   └── CompositionCard.tsx      # 구도 태그 카드
│   ├── Session/
│   │   ├── SessionList.tsx          # 세션 목록 (🎨 스타일/👤 캐릭터)
│   │   └── SessionCard.tsx          # 세션 카드
│   └── Generator/
│       ├── PromptMixer.tsx          # 프롬프트 조합 UI
│       ├── ControlPanel.tsx         # 생성 제어 패널
│       └── ImageViewer.tsx          # 생성된 이미지 뷰어
├── hooks/
│   ├── useGeminiAnalyzer.ts         # Gemini 이미지 분석
│   ├── useNanaBanana.ts             # Nano Banana Pro 연동
│   └── useSessionManager.ts         # 세션 관리
├── lib/
│   ├── gemini/
│   │   └── prompts.ts               # Gemini 프롬프트 템플릿
│   ├── generator/
│   │   ├── api.ts                   # Nano Banana API 래퍼
│   │   └── promptBuilder.ts         # 프롬프트 빌더
│   └── store/
│       ├── sessionStore.ts          # 세션 저장/로드
│       └── types.ts                 # 타입 정의
└── App.tsx
```

#### 1-3. Gemini 프롬프트 엔지니어링

**파일**: `src/lib/gemini/prompts.ts`

```typescript
export const STYLE_ANALYZER_PROMPT = `
너는 전문 비주얼 디렉터이자 이미지 분석 전문가야.

사용자가 제공한 이미지를 정밀 분석하여 다음 JSON 포맷으로 출력해:

{
  "style": {
    "art_style": "화풍 (예: oil painting, anime, pixel art, 3D render)",
    "technique": "기법 (예: thick impasto, cel shading, watercolor)",
    "color_palette": "색상 특징 (예: vibrant colors, muted tones, neon)",
    "lighting": "조명 (예: dramatic lighting, soft ambient, high contrast)",
    "mood": "분위기 (예: melancholic, energetic, mysterious)"
  },
  "character": {
    "gender": "성별",
    "age_group": "연령대",
    "hair": "머리 스타일과 색상 (고정 특징)",
    "eyes": "눈 색상과 형태 (고정 특징)",
    "face": "얼굴 특징 (고정 특징)",
    "outfit": "의상 (고정 특징)",
    "accessories": "액세서리나 특징적인 아이템"
  },
  "composition": {
    "pose": "현재 포즈/자세",
    "angle": "카메라 앵글 (예: side profile, front view, low angle)",
    "background": "배경 설명",
    "depth_of_field": "심도 (예: shallow, deep focus)"
  }
}

**중요:**
- 각 항목을 명확하고 구체적으로 작성할 것
- 생성형 AI가 이해할 수 있는 영문 키워드 사용
- character 섹션은 절대 변하지 않을 고유 특징만 포함
- composition 섹션은 현재 이미지의 상황/포즈만 포함
`;
```

#### 1-4. 핵심 컴포넌트 구현 순서

1. **ImageUpload.tsx** - 드래그앤드롭 이미지 업로드
   - `@tauri-apps/plugin-dialog` 사용
   - 이미지 파일 선택 및 Base64 변환

2. **useGeminiAnalyzer.ts** - Gemini 분석 훅
   - 이미지 → Gemini API 전송
   - JSON 응답 파싱
   - 에러 핸들링

3. **AnalysisResult.tsx** - 분석 결과 UI
   - StyleCard, CharacterCard, CompositionCard 표시
   - 각 필드 편집 가능
   - "세션으로 저장" 버튼

4. **SessionManager** - 세션 저장/로드
   - Tauri Store 활용
   - 세션 타입 구분 (STYLE / CHARACTER)
   - 참조 이미지 경로 저장

### Phase 2: 이미지 생성 엔진 연동 (Gemini 3 Pro Preview)

**✅ 확정된 방법:**
- Gemini API 사용 (gemini-3-pro-preview 모델)
- 기존 GamePlanner-Tauri의 useGeminiChat 패턴 참고
- HTTP API 방식으로 직접 호출

#### 2-1. Gemini 이미지 생성 훅 (공식 API 스펙 기반)

**파일**: `src/hooks/useGeminiImageGenerator.ts`

```typescript
interface ImageGenerationParams {
  prompt: string; // 서술적 문장 권장 (키워드 나열 X)
  referenceImages?: string[]; // base64 이미지 배열 (최대 5개 캐릭터 + 6개 객체)
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  imageSize?: '1K' | '2K' | '4K'; // Gemini 3 Pro만 지원
}

interface GenerationCallbacks {
  onProgress?: (status: string) => void;
  onComplete: (imageBase64: string, textResponse?: string) => void;
  onError: (error: Error) => void;
}

export function useGeminiImageGenerator() {
  const generateImage = async (
    apiKey: string,
    params: ImageGenerationParams,
    callbacks: GenerationCallbacks
  ) => {
    try {
      callbacks.onProgress?.('이미지 생성 요청 중...');

      // Gemini 3 Pro Image Preview API 엔드포인트
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;

      // contents 배열 구성
      const parts: any[] = [{ text: params.prompt }];

      // 참조 이미지 추가 (최대 14개: 캐릭터 5 + 객체 6)
      if (params.referenceImages && params.referenceImages.length > 0) {
        for (const imageBase64 of params.referenceImages) {
          parts.push({
            inline_data: {
              mime_type: 'image/png', // 또는 image/jpeg
              data: imageBase64,
            },
          });
        }
      }

      const requestBody = {
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'], // 이미지 + 텍스트 응답
          imageConfig: {
            aspectRatio: params.aspectRatio || '1:1',
            imageSize: params.imageSize || '2K',
          },
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 오류 (${response.status}): ${errorText}`);
      }

      callbacks.onProgress?.('이미지 생성 완료, 로딩 중...');

      const result = await response.json();

      // 응답 파싱: candidates[0].content.parts[]
      const parts = result.candidates?.[0]?.content?.parts || [];

      let imageBase64 = '';
      let textResponse = '';

      for (const part of parts) {
        if (part.inline_data) {
          imageBase64 = part.inline_data.data;
        } else if (part.text) {
          textResponse += part.text;
        }
      }

      if (!imageBase64) {
        throw new Error('생성된 이미지가 없습니다');
      }

      callbacks.onComplete(imageBase64, textResponse);
    } catch (error) {
      console.error('Gemini Image Generation Error:', error);
      callbacks.onError(
        error instanceof Error ? error : new Error('이미지 생성 실패')
      );
    }
  };

  return { generateImage };
}
```

**✅ API 정보 확정** (공식 문서 기반):
- **엔드포인트**: `generateContent` (텍스트 생성과 동일 엔드포인트)
- **모델**: `gemini-3-pro-image-preview`
- **참조 이미지**: 최대 14개 (캐릭터 5 + 객체 6)
- **응답 형식**: `candidates[0].content.parts[]`에 `inline_data`로 base64 이미지 포함
- **프롬프트**: 서술적 문장 권장 (키워드 나열 지양)

#### 2-2. 프롬프트 믹서

```typescript
// src/lib/generator/promptBuilder.ts
export function buildPrompt(
  session: Session,
  userInput: string,
  options?: {
    emotionOverride?: string;
    compositionOverride?: string;
  }
): string {
  const parts: string[] = [];

  // 1. 스타일 (고정)
  if (session.style) {
    parts.push(session.style.art_style);
    parts.push(session.style.technique);
    parts.push(session.style.color_palette);
    parts.push(session.style.lighting);
  }

  // 2. 캐릭터 (고정)
  if (session.character) {
    parts.push(`${session.character.gender}, ${session.character.age_group}`);
    parts.push(session.character.hair);
    parts.push(session.character.eyes);
    parts.push(session.character.face);
    parts.push(session.character.outfit);
  }

  // 3. 사용자 입력 (동적)
  parts.push(userInput);

  // 4. 감정 오버라이드 (옵션)
  if (options?.emotionOverride) {
    parts.push(options.emotionOverride);
  }

  return parts.filter(Boolean).join(', ');
}
```

#### 2-3. ControlPanel UI

- 프롬프트 입력창 ("어떤 상황인가요?")
- Similarity Slider (Img2Img Strength: 0.3 ~ 0.9)
- Seed 입력 (재현성)
- Negative Prompt 입력
- "생성" 버튼

### Phase 3: 고급 기능 (선택적)

#### 3-1. A/B 테스트 그리드
- 한 번에 4장 생성 (다른 seed)
- 그리드 뷰로 비교
- 클릭하여 "레퍼런스 이미지로 설정"

#### 3-2. 히스토리 관리
- 세션별 생성 이력 저장
- 이미지 썸네일 + 프롬프트 + seed
- 재생성 가능

### Phase 4: ControlNet (후순위)

**조건부 구현 (Nano Banana Pro 지원 확인 후):**
- 스케치 캔버스 (HTML5 Canvas 또는 외부 라이브러리)
- OpenPose / Canny Edge 등 프리프로세서 지원
- ControlNet 가중치 슬라이더

## 🛠️ 구현 시 주의사항

1. **보안**
   - API 키를 Tauri Store에 안전하게 저장
   - 생성된 이미지 파일 경로 검증 (Path Traversal 방지)

2. **성능**
   - 이미지 생성 중 UI 블로킹 방지 (비동기 처리)
   - 큰 이미지는 썸네일 생성 후 표시

3. **에러 핸들링**
   - Gemini API 실패 시 재시도 로직
   - Nano Banana Pro 실행 실패 시 사용자 안내
   - 네트워크 오류 처리

4. **UX**
   - 로딩 상태 명확히 표시
   - 프로그레스바 (생성 진행률 표시 가능 시)
   - 생성 취소 기능

## 📦 필요한 추가 조사

1. **Gemini 3 Pro Preview API** ✅ 완료
   - [x] 공식 문서 확인 (이미지 생성 API 스펙)
   - [x] 정확한 API 엔드포인트 확인
   - [x] 요청/응답 형식 확인
   - [x] 지원 파라미터 확인 (aspectRatio, imageSize, referenceImages)
   - [x] Img2Img (참조 이미지) 지원 여부 확인 → **최대 14개 지원**
   - [x] 생성 가능한 이미지 크기 및 제한사항 → **1K, 2K, 4K**

2. **프로젝트 구조** ⚠️ 사용자 결정 필요
   - [ ] 사용자 의사 결정: 독립 프로젝트 vs 통합
   - [ ] 저장소 구조 결정
   - [ ] 데이터 저장 방식 결정 (Tauri Store vs SQLite)

## 🎯 첫 번째 마일스톤 (MVP)

**목표**: 이미지를 업로드하면 Gemini로 분석하고, 결과를 세션으로 저장

1. 이미지 업로드 UI
2. Gemini 분석 (JSON 파싱)
3. 분석 결과 카드 UI (수정 가능)
4. 세션 저장 (Tauri Store)
5. 세션 목록 표시

**예상 소요**: Phase 1 완료 시점

---

## 결론

### ✅ 계획서 평가

계획서의 **컨셉과 기술 스택은 매우 적절하며 실현 가능**합니다.

**주요 강점:**
1. Gemini 2.5 Flash (분석) + Gemini 3 Pro Preview (생성)으로 단일 API 생태계 사용
2. 기존 GamePlanner-Tauri의 Gemini 연동 경험 활용 가능
3. 스타일/캐릭터를 "자산"으로 관리하는 명확한 개념
4. 단계별 로드맵이 체계적

### ⚠️ 실제 구현 전 필수 사항

1. **Gemini 3 Pro Preview API 조사** (최우선)
   - 공식 문서에서 이미지 생성 API 엔드포인트 확인
   - 파라미터 및 응답 형식 파악
   - 참조 이미지(Img2Img) 지원 여부 확인

2. **프로젝트 구조 결정**
   - 독립 프로젝트 (StyleStudio-Tauri) vs 통합 (GamePlanner-Tauri)
   - **권장**: 기능이 완전히 다르므로 독립 프로젝트 추천

3. **Phase별 우선순위**
   - Phase 1-2: 필수 (이미지 분석 + 생성)
   - Phase 3: 중요 (세션 관리, A/B 테스트)
   - Phase 4: 선택적 (ControlNet - API 지원 확인 후)

### 🚀 최종 결정 사항

✅ **확정된 방향:**
1. **프로젝트 구조**: 새 독립 프로젝트 (StyleStudio-Tauri)
2. **MVP 범위**: Phase 1만 구현 (이미지 분석 + 세션 저장)
3. **데이터 저장**: Tauri Store

### 📋 Phase 1 MVP 구현 체크리스트

**목표**: 이미지를 업로드하면 Gemini로 분석하고, 스타일/캐릭터 정보를 세션으로 저장

#### 1. 프로젝트 초기화
- [ ] Tauri 프로젝트 생성 (`StyleStudio-Tauri`)
- [ ] React + TypeScript + Vite 설정
- [ ] TailwindCSS, Zustand, Lucide-react 설치
- [ ] Tauri 플러그인 설치 (store, dialog, fs, http)
- [ ] `@google/generative-ai` 패키지 설치

#### 2. 기본 UI 구조
- [ ] `src/App.tsx` - 메인 레이아웃
- [ ] `src/components/Header.tsx` - 상단 헤더 (설정 버튼)
- [ ] `src/components/Sidebar.tsx` - 세션 목록
- [ ] `src/components/ImageUpload.tsx` - 드래그앤드롭 이미지 업로드
- [ ] `src/components/AnalysisPanel.tsx` - 분석 결과 표시

#### 3. Gemini 이미지 분석
- [ ] `src/hooks/useGeminiAnalyzer.ts` - Gemini 2.5 Flash로 이미지 분석
- [ ] `src/lib/gemini/analysisPrompt.ts` - 분석용 프롬프트 템플릿 (JSON 응답)
- [ ] `src/types/analysis.ts` - 분석 결과 타입 정의 (Style, Character, Composition)
- [ ] 이미지 → Base64 변환 유틸리티

#### 4. 분석 결과 UI
- [ ] `src/components/StyleCard.tsx` - 스타일 정보 카드 (편집 가능)
- [ ] `src/components/CharacterCard.tsx` - 캐릭터 정보 카드 (편집 가능)
- [ ] `src/components/CompositionCard.tsx` - 구도 정보 카드
- [ ] JSON 데이터 → UI 필드 매핑

#### 5. 세션 관리
- [ ] `src/store/useSessionStore.ts` - Zustand 세션 스토어
- [ ] `src/lib/storage.ts` - Tauri Store 연동 (저장/로드)
- [ ] 세션 타입 정의 (STYLE / CHARACTER)
- [ ] 세션 생성/수정/삭제 기능
- [ ] 참조 이미지 파일 저장 경로 관리

#### 6. 설정 모달
- [ ] `src/components/SettingsModal.tsx` - API 키 설정
- [ ] Gemini API 키 저장 (Tauri Store)
- [ ] API 키 유효성 검증

#### 7. 테스트 및 마무리
- [ ] 전체 플로우 테스트 (업로드 → 분석 → 저장 → 로드)
- [ ] 에러 핸들링 (API 실패, 이미지 로드 실패)
- [ ] 로딩 상태 UI
- [ ] 빈 상태(Empty State) UI

### ⏭️ Phase 2 이후 계획 (선택적)

Phase 1 완료 후 진행:
- **Phase 2**: Gemini 3 Pro Preview로 이미지 생성
- **Phase 3**: A/B 테스트, 히스토리 관리
- **Phase 4**: ControlNet 포즈 제어 (API 지원 확인 후)

---

## 📚 참고 자료

### Gemini 3 Pro Image Preview (Nano Banana Pro)

**공식 문서:**
- [Image generation with Gemini (Nano Banana Pro)](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini 3 Pro Image | Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image)
- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)

**주요 특징:**
- 최대 14개 참조 이미지 지원 (캐릭터 5 + 객체 6)
- 멀티턴 이미지 생성 및 편집 지원
- 텍스트 렌더링 우수
- 2K/4K 출력 지원
- SynthID 워터마크 자동 포함

**가격:** (2025 기준)
- 2K: $0.134 per image
- 4K: $0.24 per image

### GamePlanner-Tauri 참고 파일

**Gemini 연동 패턴:**
- `/Users/woody/Desktop/AI/claude-code-study/GamePlanner-Tauri/src/hooks/useGeminiChat.ts`
- API 키 관리: `src/lib/store.ts`
- 세션 타입: `src/store/useAppStore.ts`

---

## 🚀 구현 시작하기

### 첫 번째 명령어

```bash
cd /Users/woody/Desktop/AI/claude-code-study
npm create tauri-app@latest StyleStudio-Tauri
```

**선택 사항:**
- Package manager: npm
- UI template: React
- UI flavor: TypeScript + Vite
- Add TailwindCSS: Yes

### 다음 단계

1. 프로젝트 생성 후 의존성 설치
2. GamePlanner-Tauri의 `useGeminiChat.ts` 패턴을 참고하여 `useGeminiAnalyzer.ts` 구현
3. 이미지 업로드 UI 구현
4. Gemini 분석 프롬프트 작성 (JSON 응답 형식)
5. 분석 결과 표시 UI 구현

---

## ✅ 검토 완료

이 계획서는 원본 STYLE_STUDIO_PLAN.md를 기반으로:
1. ✅ Gemini 3 Pro Preview API 조사 완료
2. ✅ 기술적 실현 가능성 검증 완료
3. ✅ 사용자 의사결정 완료 (독립 프로젝트, Phase 1 MVP, Tauri Store)
4. ✅ 구체적인 구현 체크리스트 작성 완료
