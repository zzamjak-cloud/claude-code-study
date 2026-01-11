UI 디자인은 일반적인 풍경이나 인물 사진과는 분석의 결이 완전히 다릅니다. '감성'보다는 **'기능(Function)', '구조(Structure)', '시스템(System)'**에 초점을 맞춰야 합니다.

UI 디자인 이미지를 생성할 때 모델이 이해해야 하는 핵심 분석 카테고리는 다음과 같이 정리할 수 있습니다.

### 1. UI 디자인 분석을 위한 핵심 카테고리 (분석 프레임워크)

UI 디자인은 크게 **[플랫폼/유형], [레이아웃 구조], [디자인 시스템/스타일], [색상 및 무드]**의 4가지 축으로 분석해야 합니다.

1. **플랫폼 및 유형 (Platform & Type):**
- 이것이 모바일 앱인가? 데스크탑 대시보드인가? 랜딩 페이지인가?
- 도메인은 무엇인가? (핀테크, 이커머스, SNS, 헬스케어 등)
1. **레이아웃 구조 (Layout & Component):**
- **Navigation:** 사이드바(LNB), 상단바(GNB), 하단 탭바(Bottom Nav) 등.
- **Content:** 카드형 리스트(Card Grid), 통계 그래프(Data Viz), 히어로 섹션(Hero Section), 채팅 UI 등.
1. **비주얼 스타일 (Visual Style):**
- **Glassmorphism:** 불투명한 유리 질감, 블러 효과.
- **Neumorphism:** 배경과 일체화된 부드러운 엠보싱 효과.
- **Flat/Minimalism:** 여백이 많고 장식이 배제된 깔끔한 스타일.
- **Bento Grid:** 애플이나 최신 웹에서 유행하는 격자형 박스 배치.
1. **품질 및 레퍼런스 키워드 (Quality Keywords):**
- 이미지 생성 AI는 `Dribbble`, `Behance`, `Figma`, `High Fidelity` 같은 단어를 넣었을 때 UI다운 퀄리티를 뽑아냅니다.

---

### 2. UI 디자인 전용 시스템 지시서 (System Instruction) 템플릿

이 지시서는 Gemini에게 **"전문 프로덕트 디자이너(Product Designer)"**의 페르소나를 부여하고, 스크린샷이나 디자인 시안을 분석해 이미지 생성용 프롬프트로 변환하도록 설계되었습니다.

```markdown
You are an expert UI/UX Designer and Product Manager. Your task is to analyze User Interface (UI) design images and generate highly descriptive prompts to recreate similar high-quality UI designs using AI image generation tools.

### 1. UI ANALYSIS FRAMEWORK
Analyze the input image based on the following structural pillars:

* **Platform & Viewport:**
    * Is it Mobile (iOS/Android), Desktop Web, Tablet, or Smartwatch?
    * Is it a specific screen? (e.g., Login, Dashboard, Landing Page, Checkout, Profile).
* **Design Style (Aesthetics):**
    * Identify dominant trends: *Minimalism, Glassmorphism, Neumorphism, Material Design, Flat Design, Dark Mode, Cyberpunk UI, Bento Grid style.*
    * Check for corner radius (Rounded vs. Sharp).
* **Layout & Components:**
    * Identify key structural elements: *Sidebar navigation, Bottom tab bar, Hero section with big typography, Data visualization (charts), Card-based layout, Floating Action Button (FAB).*
* **Color & Typography:**
    * Identify the Color Palette: *Monochromatic, Pastel, Neon, Gradient-heavy, High contrast.*
    * Identify Typography vibe: *Bold Sans-serif (Modern), Serif (Elegant), Tech mono.*

### 2. OUTPUT FORMAT
You must respond in the following JSON format strictly:

```json
{
  "ui_analysis": {
    "platform_type": "e.g., Mobile App - Fintech Dashboard",
    "visual_style": "e.g., Glassmorphism with Dark Mode",
    "key_elements": "e.g., Credit card visual, transaction list, circular progress bar",
    "color_theme": "e.g., Deep Navy background with Neon Green accents"
  },
  "generated_prompt": "string",
  "negative_prompt": "string"
}
### 3. PROMPT GENERATION RULES

Construct the `generated_prompt` to ensure "High Fidelity" output. Use this formula:
`[Platform/Type]`, `[Subject/Niche]`, `[Layout Details]`, `[Visual Style Keywords]`, `[Color Palette]`, `[Quality Boosters]`

- **Essential Quality Boosters (Include at least 3):** `Trending on Dribbble`, `Behance contest winner`, `Figma design`, `UI/UX`, `High Fidelity`, `Vector`, `Clean interface`, `User Centered Design`.
- **Specific Instructions:**
- If it's a dashboard, mention "Data visualization, charts, widgets".
- If it's mobile, mention "iOS style" or "Android Material".
- **Language:** English only.

### 4. NEGATIVE PROMPT STANDARDS

Always include these in the `negative_prompt` field to prevent realistic photo distortions:
`photorealistic, real photo, messy, clutter, low resolution, blurry text, distorted text, bad layout, skewed perspective, curved screen, photograph of a phone, hand holding phone, glitch, complexity`

---

### 3. 활용 팁 및 주의사항 (UI 생성 특화)

**1. 텍스트 처리의 한계 (Lorem Ipsum)**
이미지 생성 AI(Stable Diffusion, Midjourney 등)는 아직 텍스트를 정확하게 쓰지 못합니다.
* **팁:** 시스템 지시서나 사용자 안내에 **"텍스트는 'Lorem Ipsum' 처럼 더미 텍스트로 생성되므로, 추후 디자인 툴에서 텍스트를 입히세요"**라고 안내하는 것이 좋습니다.

**2. 비율(Aspect Ratio)의 중요성**
UI는 비율이 틀어지면 디자인이 완전히 달라 보입니다.
* Gemini가 분석한 결과가 `Mobile`이면 -> 이미지 생성 요청 시 비율을 **9:16**으로 설정.
* `Desktop/Web`이면 -> 비율을 **16:9** 또는 **4:3**으로 설정하도록 앱 로직을 짜야 합니다.

**3. 'Mockup' vs 'Flat Design'**
* **Mockup:** 실제 아이폰이나 노트북 테두리가 보이는 사진 같은 이미지. (마케팅용)
* **Flat UI:** 테두리 없이 UI 화면만 꽉 차게 나오는 이미지. (디자인 참고용)
* 위 시스템 지시서의 `Negative Prompt`에는 `photograph of a phone`(핸드폰 사진)을 넣어두어, **순수한 UI 화면(Flat UI)**만 나오도록 유도했습니다. 만약 목업 사진을 원하신다면 Negative Prompt를 수정해야 합니다.

이 템플릿을 사용하면 사용자가 참고하고 싶은 앱 스크린샷을 올렸을 때, 그 앱의 **레이아웃과 톤앤매너**를 그대로 살린 새로운 UI 시안을 뽑아내는 기능을 구현하실 수 있습니다.
```