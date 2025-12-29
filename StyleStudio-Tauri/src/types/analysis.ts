// 스타일 분석 결과
export interface StyleAnalysis {
  art_style: string;      // 화풍 (예: oil painting, anime, pixel art)
  technique: string;      // 기법 (예: thick impasto, cel shading)
  color_palette: string;  // 색상 특징
  lighting: string;       // 조명
  mood: string;          // 분위기
}

// 캐릭터 분석 결과
export interface CharacterAnalysis {
  gender: string;        // 성별
  age_group: string;     // 연령대
  hair: string;          // 머리 스타일과 색상 (고정 특징)
  eyes: string;          // 눈 색상과 형태 (고정 특징)
  face: string;          // 얼굴 특징 (고정 특징)
  outfit: string;        // 의상 (고정 특징)
  accessories: string;   // 액세서리나 특징적인 아이템
  body_proportions: string; // 등신대 비율 (예: 2-head, 3-head, realistic 8-head)
  limb_proportions: string; // 팔과 다리의 비례 (예: short stubby arms, normal proportions, elongated limbs)
  torso_shape: string;   // 몸통 형태 (예: compact rounded torso, rectangular body, slim waist)
  hand_style: string;    // 손 표현 방식 (예: simplified 3-finger, detailed 5-finger, mitten style)
}

// 구도 분석 결과
export interface CompositionAnalysis {
  pose: string;              // 현재 포즈/자세
  angle: string;             // 카메라 앵글
  background: string;        // 배경 설명
  depth_of_field: string;    // 심도
}

// 전체 분석 결과
export interface ImageAnalysisResult {
  style: StyleAnalysis;
  character: CharacterAnalysis;
  composition: CompositionAnalysis;
  negative_prompt: string; // 피해야 할 요소들 (예: realistic hands, detailed fingers, 8-head proportions)
}
