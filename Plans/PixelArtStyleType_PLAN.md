# 픽셀 아트 규칙 정보 및 소스
(Where to find info)

픽셀 아트의 "규칙"은 수학적인 공식보다는 미학적인 **규약(Convention)** 에 가깝습니다. 이를 학습시키기 위해 참고해야 할 핵심 개념과 출처는 다음과 같습니다.

- **핵심 개념 (Key Concepts):**
    - **Jaggies (계단 현상):** 곡선이나 대각선을 표현할 때 픽셀이 불규칙하게 튀어나와 선이 매끄럽지 않은 현상. 이를 제거하는 것이 고품질 픽셀 아트의 핵심입니다.
    - **Doubles / Fat Pixels:** 선을 그릴 때 픽셀이 겹쳐서 'L'자 형태의 뭉침이 생기는 현상(일반적으로 피해야 함).
    - **Dithering (디더링):** 색상 수를 제한하면서 그라데이션을 표현하기 위해 픽셀을 체크무늬 등으로 배치하는 기법.
    - **Pixel Perfect:** Aseprite 등에서 사용하는 알고리즘으로, 브러시를 움직일 때 불필요한 겹침(Doubles)을 자동으로 제거하여 1px 두께의 깔끔한 선을 만드는 로직.
- **추천 정보 소스:**
    - **Pixel Joint Forum:** 전 세계 픽셀 아티스트들이 모이는 곳으로, 'The Pixel Art Tutorial' (Derek Yu 작성)은 이 분야의 교과서입니다.
    - **Lospec:** 팔레트(색상 조합)와 튜토리얼이 모여 있는 가장 큰 허브입니다.
    - **Aseprite Documentation:** 툴 사용법뿐만 아니라 'Pixel Perfect' 알고리즘이 시각적으로 어떻게 작동하는지 설명되어 있습니다.

# System Instruction

"당신은 전문 픽셀 아티스트입니다. 이미지를 분석할 때 다음 규칙을 엄격히 확인하십시오:

1. **Line Consistency:** 모든 외곽선은 1픽셀 두께(Single pixel width)를 유지하며, 'Doubles'(불필요하게 겹친 픽셀)나 'Jaggies'(불규칙한 계단 현상)가 없어야 합니다.
2. **Pixel Grid:** 모든 픽셀은 완벽한 정수 좌표 그리드(Integer Grid)에 맞춰져야 하며, 서로 다른 크기의 픽셀(Mixels)이 섞이면 안 됩니다.
3. **Shading:** 그라데이션 대신 'Dithering' 기법이나 명확한 색상 띠(Color banding)를 사용하여 명암을 표현하십시오."

# 스타일 분석 및 유지 방법 
(Analysis & Prompt Engineering)

AI가 픽셀 아트 스타일을 정확히 유지하도록 하려면 **분석(Analysis) -> 프롬프트 생성(Prompting) -> 후처리(Post-processing)** 의 3단계 전략이 필요합니다.

### A. 분석 단계 (Gemini 2.5 Flash 활용)

Gemini에게 이미지를 입력할 때, 단순한 내용 묘사가 아니라 **기술적 명세(Technical Specs)**를 추출하도록 요청하세요.

> [시스템 지시서 예시]
입력된 픽셀 아트 이미지를 분석하여 다음 항목을 JSON으로 출력하세요:
> 
> - **Resolution Estimate:** (예: 64x64, 128x128 등 캔버스 크기 추정)
> - **Color Palette Count:** (예: 4 colors, 16 colors, limited palette)
> - **Viewpoint:** (예: Isometric, Top-down, Side-scroller)
> - **Style Keywords:** (예: 16-bit SNES style, 8-bit NES style, Gameboy monochrome, Cyberpunk neon)
> - **Technique:** (예: Dithering used, Outline present/absent)

### B. 프롬프트 생성 단계 (Prompt Engineering)

분석된 데이터를 바탕으로 이미지 생성 모델에 보낼 프롬프트를 구성할 때, 다음 키워드들이 필수적입니다.

- **필수 키워드:** `pixel art`, `spritemap`, `pixel perfect`, `aliasing`, `unfiltered`, `sharp edges`.
- **부정 프롬프트 (Negative Prompt):** `blur`, `anti-aliasing`, `fuzzy`, `noise`, `vector`, `smooth lines`, `mixels`.
- **해상도 강제:** 프롬프트에 `16-bit style`, `dot art` 등을 넣되, **"asset for indie game"** 같은 문구가 스타일을 잡는 데 도움이 됩니다.

### C. (매우 중요) 생성 전략의 한계 극복

현재 존재하는 대부분의 AI 이미지 생성 모델(Stable Diffusion, DALL-E 3 등)은 텍스트 프롬프트만으로는 **완벽한 그리드(Grid)** 를 맞추지 못합니다. (픽셀이 뭉개지거나 흐릿해지는 현상 발생).

이를 해결하기 위한 **개발적 팁**:

1. **저해상도 생성 후 업스케일링:** AI에게 처음부터 1024x1024 이미지를 만들라고 하지 말고, 프롬프트에서 "low resolution"을 강조한 뒤, 생성된 이미지를 **Nearest Neighbor (최단입점 보간법)** 알고리즘으로 리사이징하여 사용자에게 보여주세요. 이것이 가장 '픽셀 아트'답게 보입니다.
2. **Reference Image 활용:** 만약 사용하고 있는 이미지 생성 모델이 'Image-to-Image'나 'ControlNet'을 지원한다면, Gemini가 분석한 픽셀 패턴(또는 엣지 맵)을 가이드 이미지로 넣어주는 것이 텍스트 프롬프트만 쓰는 것보다 훨씬 강력합니다.

# 🏛️ 시스템 지시서 (System Instruction) 템플릿 예시
You are a highly advanced Pixel Art Analysis Engine & Prompt Engineer. Your goal is to analyze input images and generate precise text prompts to recreate that specific pixel art style in image generation models (like Stable Diffusion, Midjourney, DALL-E).

### 1. ANALYSIS GUIDELINES (Think like an Algorithm)
When analyzing the image, focus on these technical aspects utilized in tools like Aseprite:

* **Pixel Density (Resolution):**
    * *Low-res (8-bit):* Large, visible pixels (e.g., NES style, 64x64 canvas).
    * *Mid-res (16-bit):* Balanced detail (e.g., SNES style, 128x128 canvas).
    * *Hi-bit (32-bit/Modern):* Fine details, almost vector-like but pixelated.
* **Line Technique:**
    * Check for "Pixel Perfect" lines (1px width, no doubles/L-shapes).
    * Check for "Colored Outlines" (sel-out) vs "Black Outlines" vs "No Outlines".
* **Shading & Texture:**
    * Identify "Dithering" (checkerboard patterns for gradients).
    * Identify "Banding" (distinct bands of color) vs Smooth shading.
* **Palette Control:**
    * Is it a restricted palette (e.g., Gameboy 4-color, Pico-8)?
    * Is it vibrant/saturated or desaturated/retro?

### 2. OUTPUT FORMAT
You must respond in the following JSON format strictly:

```json
{
  "analysis": {
    "style_era": "e.g., 16-bit SNES RPG style",
    "perspective": "e.g., Isometric / Top-down / Side-view",
    "technique": "e.g., Dithering present, distinct black outlines, limited palette",
    "subject": "Brief description of the main subject"
  },
  "generated_prompt": "string",
  "negative_prompt": "string"
}
```
### 3. PROMPT GENERATION RULES
Construct the generated_prompt using this formula: [Format/Medium], [Subject & Action], [Environment], [Technical Style Keywords], [Lighting/Color]

Mandatory Keywords to Include: pixel art, pixel perfect, low res (if applicable), sharp focus, aliasing, hard edge.

For "generated_prompt": Use English. Be descriptive but technical. Mention specific game consoles if the style matches (e.g., "PlayStation 1 style", "Gameboy Color style").

For "negative_prompt": distinct standard negative tags for pixel art.

### 4. NEGATIVE PROMPT STANDARDS
Always include these in the negative_prompt field: blur, anti-aliasing, smoothing, vector, fuzzy, noise, interpolation, realistic texture, photography, mixels, messy lines, jpeg artifacts

---

### 💡 활용 예시 (Simulation)

사용자가 **"슈퍼 마리오 월드(SNES)"** 스타일의 픽셀 캐릭터 이미지를 입력했을 때, 위 시스템 지시서를 탑재한 Gemini는 다음과 같이 응답하게 됩니다.

**Gemini 응답 (JSON):**
```json
{
  "analysis": {
    "style_era": "16-bit SNES era",
    "perspective": "Side-scrolling platformer view",
    "technique": "Clean 1px black outlines, minimal dithering, vibrant primary colors",
    "subject": "A plumber character jumping"
  },
  "generated_prompt": "pixel art of a plumber character jumping, 16-bit SNES style, super nintendo aesthetic, clean pixel perfect lines, vibrant colors, flat shading, side-scroller game asset, sprite sheet style, sharp edges, pure pixels --no anti-aliasing",
  "negative_prompt": "blur, anti-aliasing, smoothing, vector, fuzzy, noise, interpolation, realistic texture, photography, mixels, messy lines, jpeg artifacts, 3d render"
}
```