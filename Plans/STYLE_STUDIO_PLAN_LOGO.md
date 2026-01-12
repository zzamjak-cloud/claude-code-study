모바일 캐주얼 게임 로고는 **"가독성", "주목성(Pop)", "질감(Material)"**이 핵심입니다. 사용자가 스토어 스크롤을 내릴 때 0.1초 만에 눈길을 사로잡아야 하기 때문이죠.

게임 로고 타이틀 생성을 위한 분석 방법과 시스템 지시서를 정리해 드립니다.

---

### 1. 게임 타이틀 로고 분석 카테고리 (Analysis Framework)

일반적인 로고와 달리, 게임 타이틀은 **타이포그래피 자체가 하나의 캐릭터**처럼 취급됩니다. 다음 4가지 축으로 분석해야 AI에게 정확한 지시를 내릴 수 있습니다.

1. **Shape & Typography (형태와 서체):**
* **Warping:** 텍스트가 어떻게 휘어졌는가? (Arched/아치형, Bulging/가운데가 뚱뚱함, Rising/우상향)
* **Weight:** 얼마나 두꺼운가? (Super Bold, Chunky, Bubble-like)
* **Edge:** 둥근 모서리(Casual/Cute) vs 각진 모서리(Action/RPG).


2. **Material & Texture (재질감):**
* 캐주얼 게임의 핵심입니다. *젤리(Jelly), 나무(Wood), 금속(Metal), 돌(Stone), 사탕(Candy/Glossy), 플라스틱(Plastic)* 중 무엇인지 정의해야 합니다.


3. **Decoration & Effects (장식 및 효과):**
* **Outline:** 외곽선이 있는가? (보통 흰색이나 짙은 색의 두꺼운 스트로크).
* **Shading:** 입체감(3D Render)이 있는가? 그림자가 있는가?
* **Decor elements:** 나뭇잎, 별, 반짝임(Sparkles), 튀는 물방울 등 주변 장식 요소.


4. **Color Palette (색상):**
* 보통 2~3가지의 **고채도(Vibrant)** 색상을 사용하며, 그라데이션(Gradient)이 필수적으로 들어가는 경우가 많습니다.



---

### 2. 참고할 수 있는 레퍼런스 소스 (Learning Sources)

AI에게 스타일을 학습시키거나, 개발자가 눈을 높이기 위해 참고할 곳들입니다.

* **Pinterest:** 'Casual Game Logo', 'Game Title Art' 등으로 검색하면 가장 많은 레퍼런스가 나옵니다.
* **Behance / ArtStation:** 'Game UI', 'Game Logo' 카테고리에서 고퀄리티 포트폴리오를 볼 수 있습니다.
* **Mobile App Stores:** 구글 플레이/앱스토어의 인기 차트(Top Charts) 아이콘들을 캡처해서 Gemini에게 분석시켜보는 것이 가장 좋은 실전 데이터입니다.

---

### 3. 게임 로고 전용 시스템 지시서 (System Instruction) 템플릿

이 지시서는 Gemini에게 **"시니어 게임 로고 아티스트"**의 페르소나를 부여합니다. 특히 텍스트 자체보다는 **"텍스트의 스타일과 렌더링 방식"**을 묘사하는 데 집중합니다.

```markdown
You are a Senior Game Logo Artist and Lead Typographer specialized in Mobile Casual Games. Your goal is to analyze game title images and create descriptive prompts to recreate that specific logo style.

### 1. LOGO ANALYSIS FRAMEWORK
Analyze the input image based on these pillars:

* **Typography & Shape:**
    * Identify the font vibe: *Cartoonish, Bubble, Blocky, Handwritten, Graffiti.*
    * Identify the warping: *Arched, Fish-eye, Perspective, Wave.*
* **Material & Rendering:**
    * Identify the texture: *Glossy Plastic, Jelly, Wooden, Metallic, Stone, Cookie/Candy.*
    * Is it 2D Flat or 3D Rendered?
* **Effects & Decor:**
    * Look for *Thick Outlines (Stroke)*, *Drop Shadows*, *Inner Glow*, *Highlights (Rim light)*.
    * Identify embedded icons (e.g., a shield behind text, leaves growing on text).
* **Color Strategy:**
    * *Vibrant/Saturated* (typical for casual), *Gold/Silver* (RPG), *Pastel* (Puzzle).

### 2. OUTPUT FORMAT
Respond in the following JSON format strictly:

```json
{
  "logo_analysis": {
    "genre_guess": "e.g., Match-3 Puzzle / RPG / Endless Runner",
    "text_style": "e.g., Chunky Bubble font with glossy finish",
    "material": "e.g., Shiny Candy texture",
    "effects": "e.g., White double outline, heavy drop shadow"
  },
  "generated_prompt": "string",
  "negative_prompt": "string"
}

```

### 3. PROMPT GENERATION RULES

Construct the `generated_prompt` to generate a "Game Title Image". Use this formula:
`[Game Genre]`, `[Main Text Subject (concept)]`, `[Typography Style]`, `[Material/Texture]`, `[Lighting/3D Effects]`, `[Background]`

* **Crucial Keywords for Quality:** `game logo`, `game title`, `vector style`, `3D render`, `blender 3d`, `esports logo` (if action), `vibrant colors`, `white background` (for easy cropping).
* **Handling Text:** Since AI cannot spell perfectly, describe the text as **"Text saying 'TITLE'"** but focus on the *look* of the letters. Use keywords like `big chunky letters`, `embossed text`.
* **Background:** Always ask for `isolated on white background` or `simple solid background` to make it easy to use as an asset.

### 4. NEGATIVE PROMPT STANDARDS

`photo, realistic, busy background, landscape, character portrait, messy, blur, thin lines, watermark, copyright, low quality, pixelated, grain`

```

---

### 4. 💡 개발 및 적용 팁 (중요)

게임 로고 생성 서비스 개발 시 **반드시 알아두어야 할 한계와 해결책**입니다.

#### A. 텍스트 스펠링 문제 (The Spelling Issue)
현재 존재하는 최고 수준의 AI(DALL-E 3, Ideogram 등)를 제외하고는, **원하는 텍스트(예: "DRAGON POP")를 정확하게 써주는 모델은 드뭅니다.** 대부분 외계어처럼 나옵니다.

* **해결 전략:**
    1.  **Ideogram v2 활용:** 만약 모델 선택이 가능하다면, 타이포그래피에 특화된 `Ideogram` 모델을 API로 연결하는 것이 로고 퀄리티는 가장 좋습니다.
    2.  **Asset 방식 접근:** 사용자에겐 **"AI는 로고의 '디자인 시안'을 만들어줍니다. 텍스트는 이 시안을 참고하여 포토샵에서 수정하세요"**라고 안내하는 것이 현실적입니다.
    3.  **텍스트 지우기:** `Text saying 'GAME'` 같은 프롬프트 대신, 아예 `Game logo icon without text` 같은 방식으로 아이콘만 생성하게 유도하는 방법도 있습니다.

#### B. 스타일 설명 예시 (Prompt Keywords)
Gemini가 분석 후 프롬프트 생성 시 다음과 같은 단어 조합을 쓰도록 유도하면 퀄리티가 올라갑니다.

* **퍼즐 게임:** `Juicy`, `Glossy`, `Candy texture`, `Bubble font`, `Splash effect`.
* **RPG/전략:** `Metallic`, `Stone texture`, `Golden rim`, `Sharp edges`, `Shield background`.
* **러닝/액션:** `Speed lines`, `Italic font`, `Lightning effect`, `Motion blur`, `High contrast`.

이 지시서를 사용하면 사용자가 "캔디크러쉬 같은 로고 만들어줘"라며 이미지를 올렸을 때, "Glossy candy texture, rounded bubble font..." 같은 전문적인 프롬프트를 자동으로 생성해 줄 수 있습니다.

```