# 📱 GamePlanner AI: Tauri 2.0 데스크톱 앱 개발 명세서

## 1. 프로젝트 개요 및 기술 스택

이 프로젝트는 Google Gemini API를 활용하여 하이브리드 캐주얼 모바일 게임 기획서를 작성하고, 대화를 통해 고도화하는 데스크톱 애플리케이션입니다.

* **Core Framework:** **Tauri 2.0** (Rust + WebView) - 가볍고 안전한 데스크톱 앱
* **Frontend:** React + TypeScript + Vite
* **UI Library:** Tailwind CSS + Shadcn/UI (세련된 채팅 및 문서 UI)
* **State & Logic:** Zustand (상태 관리), React Markdown (문서 렌더링)
* **AI Engine:** **Google Generative AI SDK** (Client-side 실행)
* **Local Storage:** `tauri-plugin-store` (API Key 로컬 암호화 저장)

---

## 2. 서비스 아키텍처 (Tauri 최적화)

웹 서버를 거치지 않고, 사용자 컴퓨터에서 직접 Google 서버와 통신하며 결과물을 로컬에 저장합니다.

### A. 데이터 및 로직 흐름

1. **초기 설정:** 앱 실행 시 `tauri-plugin-store`를 확인. API Key가 없으면 **[설정 모달]** 팝업.
2. **프롬프트 주입:** 사용자가 입력한 아이디어를 시스템 프롬프트(페르소나 + 9단계 양식)와 결합.
3. **API 호출:** Frontend에서 Google SDK를 통해 직접 Gemini API 호출 (Streaming).
4. **응답 처리:** 응답 데이터 중 `<markdown_content>` 태그 내부 내용만 파싱하여 우측 패널에 실시간 렌더링.
5. **파일 저장:** '다운로드' 버튼 클릭 시 Rust Backend의 `dialog` 및 `fs` 기능을 호출하여 로컬 디스크에 `.md` 파일 저장.

---

## 3. 클로드 코드(Claude Code) 작업 지시 프롬프트 (Step-by-Step)


### 1단계: 프로젝트 스캐폴딩 및 UI 골격

```markdown
Tauri 2.0, Vite, React, TypeScript를 사용하여 'GamePlanner-Tauri' 프로젝트를 생성해줘. 패키지 매니저는 npm을 사용해.
UI 라이브러리는 Tailwind CSS와 Shadcn/UI를 설치하고 세팅해줘.
메인 레이아웃은 화면을 좌우 5:5로 분할하여, 좌측은 '채팅 인터페이스(Chat UI)', 우측은 '마크다운 프리뷰(Markdown Viewer)'가 배치되도록 잡아줘.
우측 상단에는 '설정(톱니바퀴)' 버튼과 '저장(다운로드)' 버튼을 배치해줘.

```

### 2단계: API Key 보안 저장 및 설정 기능 (중요)

```markdown
사용자의 Google Gemini API Key를 로컬에 안전하게 저장하기 위해 `tauri-plugin-store`를 설정해줘.
1. Rust 백엔드(`src-tauri`)에서 플러그인을 초기화하고 필요한 `capabilities` 권한을 설정해줘.
2. Frontend에 '설정 모달(Settings Modal)' 컴포넌트를 만들고, 여기서 API Key를 입력받아 Store에 저장하도록 해줘.
3. 앱이 시작될 때 Store에 저장된 키가 있는지 확인하고, 없으면 자동으로 설정 모달을 띄워줘.

```

### 3단계: Gemini API 연동 및 스트리밍 구현

```markdown
Google의 `@google/generative-ai` SDK를 설치해줘.
Frontend에서 Gemini API를 호출하는 커스텀 훅 `useGeminiChat`을 만들어줘.
1. `tauri-plugin-store`에서 저장된 API Key를 가져와서 인스턴스를 생성해야 해.
2. 응답은 `streamGenerateContent`를 사용하여 스트리밍으로 받아야 해.
3. 가장 중요한 점: AI 응답 텍스트에서 `<markdown_content>` 태그 안의 내용은 우측 프리뷰 상태로 업데이트하고, 태그 밖의 내용은 좌측 채팅 로그로 업데이트하는 파싱 로직을 구현해줘.

```

### 4단계: 파일 시스템 저장 구현 (Rust 연동)

```markdown
우측 상단 '저장' 버튼을 누르면 작성된 기획서를 `.md` 파일로 저장하는 기능을 구현해줘.
1. Tauri의 `dialog.save` API를 사용하여 사용자가 저장 경로와 파일명을 지정하게 해줘.
2. 파일명 기본값은 기획서 내용 중 '게임명'을 파싱해서 제안해줘.
3. `fs.writeTextFile` API를 사용하여 실제 파일을 생성해줘.
4. `src-tauri/capabilities` 설정 파일에 `fs:allow-write-text-file` 및 `dialog:save` 권한을 반드시 추가해줘.

```

---

## 4. 시스템 프롬프트 (최종 확정본)

Gemini에게 주입할 "뇌"에 해당하는 부분입니다. 이 내용을 3단계 개발 시 코드 내 `systemInstruction` 변수에 할당하도록 지시하세요.

```markdown
# Role
당신은 글로벌 탑티어 모바일 게임 기획자입니다. 특히 '하이브리드 캐주얼' 장르의 문법과 수익화(BM) 구조에 정통합니다.

# Task
사용자의 아이디어를 바탕으로 개발자가 즉시 참고할 수 있는 상세한 게임 기획서를 작성하고, 대화를 통해 이를 발전시키십시오.

# Output Format Guidelines (Strict)
1. 사용자와의 대화(설명, 질문)는 일반 텍스트로 출력하십시오.
2. **게임 기획서 본문은 반드시 `<markdown_content>` 태그로 감싸서 출력하십시오.**
3. 기획서 내용이 수정될 경우, 수정된 부분만 보여주지 말고 **전체 기획서 내용을 업데이트하여 `<markdown_content>` 안에 다시 출력**하십시오. (사용자가 즉시 저장할 수 있도록)

# 기획서 구조 (Markdown Template)
<markdown_content>
# {게임명} 기획서

## 1. 레퍼런스 및 시장 분석
- **벤치마킹 게임:** (유사 장르 성공작 분석)
- **차별화 포인트:** (레퍼런스 대비 개선점)

## 2. 게임 개요
- **장르:** (하이브리드 캐주얼 등)
- **타겟층:** - **핵심 재미(Core Value):**

## 3. 초반 시나리오 (Retention)
- **프롤로그:** (30초 내 유저 훅)
- **임팩트 포인트:** ## 4. 게임 루프 및 시스템
- **Core Loop:** (플레이 -> 보상 -> 성장)
- **조작 방식:** (한 손, 터치 & 드래그 등 심플함 필수)

## 5. 경제 구조 (Economy)
- **재화 종류:** (골드, 젬 등)
- **획득 및 소비 흐름:**

## 6. 밸런싱 및 성장
- **초기/중기/후기 성장 곡선:**

## 7. BM (Business Model)
- **광고 모델:** (Reward/Interstitial)
- **인앱 결제:** (패키지, 패스 등)

## 8. 이벤트 시스템
- **시즌/월드 이벤트:**

## 9. 상세 기획
- **핵심 메카닉 상세:** (전투 공식, 건설 로직 등 구체적 서술)
</markdown_content>

```

---

### 💡 Tauri 개발자를 위한 팁

1. **권한 설정(Capabilities):** Tauri v2는 보안이 강화되어 `src-tauri/capabilities/default.json`에 명시하지 않은 API(파일 쓰기, 알림 등)는 작동하지 않습니다. 클로드에게 코드를 짤 때 **"capabilities 설정 파일 내용도 같이 수정해줘"**라고 꼭 말해야 합니다.
2. **빌드 시간:** Rust 백엔드는 첫 컴파일 시 시간이 조금 걸립니다(3~5분). 터미널이 멈춘 게 아니니 기다려주세요.
3. **디버깅:** 데스크톱 앱이지만 화면 우클릭 -> `Inspect Element`를 통해 크롬 개발자 도구를 똑같이 쓸 수 있습니다. API 호출 오류 등은 여기서 확인하세요.