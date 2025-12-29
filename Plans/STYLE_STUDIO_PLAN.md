**스타일 분석(Gemini)**과 **캐릭터 일관성 제어(Img2Img/Control)** 기능이 통합된 로컬 데스크톱 앱 개발 계획서를 작성했습니다.

이 프로젝트의 핵심은 Gemini를 **"분석가(Analyzer)"**로, Nano Banana Pro를 **"화가(Painter)"**로, 그리고 이 앱을 **"감독(Director)"**으로 정의하여 **완벽한 연출**을 수행하는 것입니다.

---

# 📱 Project: Style & Character Studio (Local AI Director)

## 1. 프로젝트 개요 (Overview)

사용자가 제공한 이미지를 Google Gemini로 정밀 분석하여 **"스타일(화풍)"**과 **"캐릭터(외형)"** 정보를 자산화(Asset)하고, 이를 기반으로 Nano Banana Pro와 연동하여 일관성 있는 고품질 이미지를 생성하는 로컬 애플리케이션입니다.

## 2. 기술 스택 (Tech Stack)

| 영역 | 기술 | 선정 이유 |
| --- | --- | --- |
| **App Shell** | **Tauri (Rust)** | Electron 대비 압도적으로 가볍고 보안이 강력하며, OS 파일 시스템/프로세스 제어에 유리 |
| **Frontend** | **Vite + React** | 빠른 렌더링 속도와 컴포넌트 기반의 복잡한 UI(설정 패널 등) 관리 용이 |
| **Styling** | **TailwindCSS** | 유틸리티 퍼스트 방식으로 빠르고 일관된 디자인 시스템 구축 |
| **State/DB** | **Zustand + SQLite** | 프론트엔드 상태 관리 및 로컬 데이터(세션, 프롬프트 로그) 영구 저장 |
| **AI Brain** | **Google Gemini API** | `gemini-1.5-flash/pro`의 멀티모달 기능을 활용한 이미지 시각 정보 구조화 분석 |
| **Generator** | **Nano Banana Pro** | 로컬 생성 엔진 (API 통신 또는 CLI 명령어로 제어) |

---

## 3. 시스템 아키텍처 (Architecture)

```mermaid
graph TD
    User[사용자] -->|1. 이미지 업로드| Client[Tauri Client]
    Client -->|2. 분석 요청 (Vision)| Gemini[Gemini API]
    
    Gemini -->|3. 구조화된 데이터 반환| Client
    subgraph Data Structure
    JSON["{ 스타일: '...', 캐릭터: '...', 구도: '...' }"]
    end
    
    Client -->|4. 세션 저장 (DB)| LocalDB[(SQLite)]
    
    User -->|5. 상황/포즈 변경 요청| Client
    Client -->|6. 프롬프트 조합 + 레퍼런스 img| Generator[Nano Banana Pro]
    
    Generator -->|7. 이미지 생성| Client

```

---

## 4. 상세 개발 로드맵 (Detailed Roadmap)

### Phase 1: 기반 구축 및 지능형 분석기 (The Intelligent Analyzer)

> **핵심 목표:** 이미지를 단순 텍스트가 아닌, **편집 가능한 구조적 데이터(JSON)**로 분석해내는 것.

* **1-1. Tauri 프로젝트 초기화**
* Rust Backend: `reqwest` (API 통신), `sqlx` 또는 `rusqlite` (DB 연결) 의존성 추가.
* Frontend: 이미지 업로드(Drag & Drop), 마크다운 뷰어 설정.


* **1-2. Gemini 프롬프트 엔지니어링 (JSON Mode)**
* Gemini에게 이미지를 보낼 때, 응답 형식을 강제합니다.
* **System Prompt:** *"너는 전문 비주얼 디렉터야. 이미지를 분석해서 다음 JSON 포맷으로 출력해. `style`(화풍, 기법, 조명), `character`(눈, 머리, 의상 고정 특징), `composition`(현재 포즈, 앵글, 배경)."*


* **1-3. 분석 결과 UI**
* 분석된 `Style`, `Character`, `Composition` 태그를 각각 별도의 카드 UI로 보여주고 수정 가능하게 구현.



### Phase 2: 세션 관리 시스템 (Session Manager)

> **핵심 목표:** 사용자가 분석된 데이터를 **"저장된 자산(Preset)"**으로 관리하도록 함.

* **2-1. 세션(Session) 유형 분리**
* **🎨 스타일 세션:** `Style` 프롬프트만 고정. (예: "사이버펑크 네온 스타일")
* **👤 캐릭터 세션:** `Style` + `Character` 프롬프트 고정. (예: "내 전용 캐릭터 철수")


* **2-2. 데이터베이스 스키마 설계**
* 세션 테이블: `id`, `name`, `type`, `fixed_prompt`, `reference_image_path`
* 히스토리 테이블: `session_id`, `user_prompt`, `generated_image_path`, `seed`


* **2-3. 사이드바 네비게이션**
* 생성된 세션들을 폴더 구조로 관리하고 원클릭으로 작업 환경 전환.



### Phase 3: 생성 엔진 연동 및 고급 제어 (Director & Generator)

> **핵심 목표:** 텍스트(Prompt)와 이미지(Img2Img)를 동시에 활용해 Nano Banana Pro 제어.

* **3-1. 프롬프트 믹서(Mixer) 구현**
* 최종 프롬프트 = `[세션 고정 프롬프트]` + `[사용자 입력(동작/배경)]` + `[부정 프롬프트]`
* 사용자가 입력창에 "춤추는 모습"이라고만 적어도, 자동으로 "사이버펑크 스타일의 철수가 춤추는 모습"으로 변환되어 전송됨.


* **3-2. Image-to-Image 파이프라인 구축**
* **UI:** 원본 이미지 썸네일 표시 및 **영향력 슬라이더(Denoising Strength)** 구현.
* **로직:** 캐릭터 세션일 경우, 등록된 캐릭터 원본 이미지를 생성 엔진의 `init_image` 파라미터로 자동 첨부.


* **3-3. Nano Banana Pro 통신**
* HTTP API 방식 혹은 로컬 프로세스 실행(`Command::new`) 방식 연동.
* 비동기 처리(Async)로 이미지 생성 중에도 UI가 멈추지 않도록 구현.



### Phase 4: 완벽한 일관성 (Consistency Mastery)

> **핵심 목표:** 구도와 포즈를 자유자재로 바꾸면서 얼굴은 유지하기.

* **4-1. 포즈 가이드 (ControlNet) 지원**
* **스케치 캔버스:** 앱 내에 졸라맨(Stickman)을 그리거나, 참고하고 싶은 포즈 사진을 올릴 수 있는 영역 추가.
* 이 이미지를 `control_image`로 전송하여 포즈만 복사하도록 구현.


* **4-2. 표정/감정 변화 도구**
* UI에 "감정(Emotion)" 드롭다운 추가 (Happy, Angry, Crying 등).
* 선택 시 `Character` 프롬프트는 유지하되, 표정 관련 키워드만 동적으로 교체하는 로직 적용.


* **4-3. 비교 및 수정 (A/B Test)**
* 생성된 이미지 4장을 그리드 뷰로 보고, 가장 잘 나온 이미지를 다시 "캐릭터 레퍼런스"로 갱신하는 순환 구조.



---

## 5. 핵심 기능 상세 (Key Features)

### 🧩 1. 프롬프트 구조화 (The Prompt Parser)

Gemini가 분석한 내용을 다음과 같이 내부적으로 분리하여 저장합니다.

```json
{
  "style_prompt": "oil painting, thick impasto, vibrant colors, van gogh style", // [세션 고정]
  "character_prompt": "a young woman, silver hair, blue eyes, wearing red scarf", // [캐릭터 고정]
  "pose_prompt": "looking at the sky, side profile", // [사용자 입력에 따라 변경됨]
  "negative_prompt": "photorealistic, 3d render, blurry, deformed hands" // [기본값]
}

```

* **작동 방식:** 사용자가 "커피 마시는 모습"을 입력하면 -> `pose_prompt` 부분만 교체하고 나머지는 그대로 유지하여 생성 엔진에 전달.

### 🎛️ 2. 시각적 제어 패널 (Visual Control Panel)

단순한 채팅창이 아닌, 전문 대시보드 형태의 UI를 제공합니다.

* **좌측 (Assets):** 내 스타일 세션 목록, 캐릭터 카드 목록.
* **중앙 (Canvas):** 생성된 이미지 뷰어, 스케치 패드(포즈 가이드용).
* **우측 (Controller):**
* 프롬프트 입력창 ("어떤 상황인가요?")
* **Similarity Slider:** "얼굴을 얼마나 닮게 할까요?" (Img2Img Strength)
* **Pose Strength:** "포즈를 얼마나 강제할까요?" (ControlNet Weight)



---

## 6. 기대 효과 (Expected Outcome)

이 시스템이 구축되면 다음과 같은 시나리오가 가능해집니다.

1. **A 스타일 세션 로드:** 3D 픽셀 아트 스타일 세션을 켭니다.
2. **캐릭터 세션 로드:** 내가 만든 '기사' 캐릭터 정보를 불러옵니다.
3. **지시(Prompt):** "말을 타고 달리는 모습" 입력.
4. **제어(Img2Img):** 내가 대충 그린 '말 타는 졸라맨' 그림 업로드.
5. **결과:** **[3D 픽셀 아트]** 풍의 **[내 기사 캐릭터]**가 **[내가 그린 구도대로]** 말을 타고 있는 이미지가 생성됨.

---

### 🚀 Next Step: 프로젝트 착수