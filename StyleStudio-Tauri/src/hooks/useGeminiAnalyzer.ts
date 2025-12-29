import {
  STYLE_ANALYZER_PROMPT,
  MULTI_IMAGE_ANALYZER_PROMPT,
  REFINEMENT_ANALYZER_PROMPT,
} from '../lib/gemini/analysisPrompt';
import { ImageAnalysisResult } from '../types/analysis';

interface AnalysisCallbacks {
  onProgress: (message: string) => void;
  onComplete: (result: ImageAnalysisResult) => void;
  onError: (error: Error) => void;
}

interface AnalysisOptions {
  previousAnalysis?: ImageAnalysisResult; // 기존 분석 결과 (분석 강화 모드용)
}

export function useGeminiAnalyzer() {
  const analyzeImages = async (
    apiKey: string,
    imageBase64Array: string[],
    callbacks: AnalysisCallbacks,
    options?: AnalysisOptions
  ) => {
    try {
      // API Key 검증
      const cleanApiKey = String(apiKey || '').trim();
      if (!cleanApiKey) {
        throw new Error('API Key가 비어있습니다');
      }

      console.log('🔑 API Key 정보:');
      console.log('   - 키 길이:', cleanApiKey.length);
      console.log('   - 키 시작:', cleanApiKey.substring(0, 15) + '...');
      console.log('   - 키 형식 확인:', cleanApiKey.startsWith('AIza') ? '✅ 올바른 형식' : '⚠️ 잘못된 형식');

      // 이미지 배열 검증
      if (!imageBase64Array || imageBase64Array.length === 0) {
        throw new Error('분석할 이미지가 없습니다');
      }

      console.log('📷 이미지 정보:');
      console.log('   - 이미지 개수:', imageBase64Array.length);

      callbacks.onProgress(`${imageBase64Array.length}개의 이미지를 Gemini에 전송 중...`);

      // 여러 이미지를 parts 배열로 변환
      const imageParts = imageBase64Array.map((imageBase64) => {
        // Base64에서 data URL prefix 제거
        const base64Data = imageBase64.includes(',')
          ? imageBase64.split(',')[1]
          : imageBase64;

        // 이미지 MIME 타입 추출
        const mimeMatch = imageBase64.match(/data:([^;]+);base64/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

        return {
          inline_data: {
            mime_type: mimeType,
            data: base64Data,
          },
        };
      });

      console.log('   - 처리된 이미지 parts:', imageParts.length);

      // 프롬프트 선택 로직
      let analysisPrompt: string;
      let promptType: string;

      if (options?.previousAnalysis) {
        // 분석 강화 모드: 기존 분석 결과를 포함한 프롬프트 사용
        const previousAnalysisJson = JSON.stringify(options.previousAnalysis, null, 2);
        analysisPrompt = REFINEMENT_ANALYZER_PROMPT(previousAnalysisJson);
        promptType = 'REFINEMENT';
        console.log('📋 프롬프트 선택: REFINEMENT (분석 강화 모드)');
        console.log('   - 기존 분석 결과 포함');
      } else {
        // 일반 분석 모드: 이미지 개수에 따라 프롬프트 선택
        analysisPrompt =
          imageBase64Array.length > 1 ? MULTI_IMAGE_ANALYZER_PROMPT : STYLE_ANALYZER_PROMPT;
        promptType = imageBase64Array.length > 1 ? 'MULTI_IMAGE' : 'SINGLE_IMAGE';
        console.log('📋 프롬프트 선택:', promptType);
      }

      // Gemini API 엔드포인트 (gemini-2.5-flash 사용)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cleanApiKey}`;

      console.log('🌐 API 요청 정보:');
      console.log('   - URL:', url.replace(cleanApiKey, 'API_KEY_MASKED'));
      console.log('   - 모델:', 'gemini-2.5-flash');

      callbacks.onProgress('Gemini가 이미지를 분석하고 있습니다...');

      // parts 배열 구성: [프롬프트, 이미지1, 이미지2, ...]
      const parts = [
        { text: analysisPrompt },
        ...imageParts,
      ];

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: parts,
            },
          ],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 4096, // 분석 강화 프롬프트를 위해 증가
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API 오류 발생:');
        console.error('   - 상태 코드:', response.status);
        console.error('   - 상태 텍스트:', response.statusText);
        console.error('   - 응답 내용:', errorText);

        // 에러 내용 파싱 시도
        try {
          const errorJson = JSON.parse(errorText);
          console.error('   - 파싱된 오류:', JSON.stringify(errorJson, null, 2));
        } catch {
          console.error('   - 원본 오류:', errorText);
        }

        throw new Error(`API 오류 (${response.status}): ${errorText}`);
      }

      callbacks.onProgress('분석 결과를 처리하고 있습니다...');

      const result = await response.json();
      console.log('✅ Gemini 응답 수신 성공');
      console.log('   - 전체 응답:', JSON.stringify(result, null, 2));

      // 응답에서 텍스트 추출
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.error('❌ 텍스트 추출 실패:');
        console.error('   - candidates:', result.candidates);
        console.error('   - content:', result.candidates?.[0]?.content);
        console.error('   - parts:', result.candidates?.[0]?.content?.parts);
        throw new Error('Gemini 응답에 텍스트가 없습니다');
      }

      console.log('📝 추출된 텍스트:');
      console.log('   - 길이:', text.length);
      console.log('   - 시작:', text.substring(0, 100) + '...');

      // JSON 파싱
      let analysisResult: ImageAnalysisResult;
      try {
        console.log('🔍 JSON 파싱 시도...');

        let jsonText = text;

        // 1단계: ```json ``` 또는 ``` ``` 코드 블록 제거
        if (text.includes('```')) {
          console.log('   - 코드 블록 감지, 제거 중...');
          // ```json ... ``` 패턴 매칭
          const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonBlockMatch) {
            jsonText = jsonBlockMatch[1];
            console.log('   - ```json``` 블록 추출 성공');
          } else {
            // ``` ... ``` 패턴 매칭
            const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
              jsonText = codeBlockMatch[1];
              console.log('   - ``` 블록 추출 성공');
            } else {
              // 백틱만 제거
              jsonText = text.replace(/```json|```/g, '');
              console.log('   - 백틱 수동 제거');
            }
          }
        }

        // 2단계: JSON 객체만 추출 (첫 { 부터 마지막 } 까지)
        const firstBrace = jsonText.indexOf('{');
        const lastBrace = jsonText.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonText = jsonText.substring(firstBrace, lastBrace + 1);
          console.log('   - JSON 객체 추출 성공');
        }

        console.log('   - 최종 JSON 텍스트 (앞 200자):', jsonText.substring(0, 200));

        // 3단계: JSON 파싱
        analysisResult = JSON.parse(jsonText.trim());
        console.log('✅ JSON 파싱 성공');
        console.log('   - 결과:', JSON.stringify(analysisResult, null, 2));
      } catch (parseError) {
        console.error('❌ JSON 파싱 실패:', parseError);
        console.error('   - 원본 텍스트 (앞 500자):', text.substring(0, 500));
        console.error('   - 원본 텍스트 (뒤 500자):', text.substring(text.length - 500));
        throw new Error('분석 결과를 JSON으로 파싱할 수 없습니다. Gemini 응답 형식을 확인하세요.');
      }

      // 결과 검증
      console.log('🔎 결과 검증 중...');
      if (
        !analysisResult.style ||
        !analysisResult.character ||
        !analysisResult.composition ||
        analysisResult.negative_prompt === undefined
      ) {
        console.error('❌ 결과 형식 오류:');
        console.error('   - style:', analysisResult.style);
        console.error('   - character:', analysisResult.character);
        console.error('   - composition:', analysisResult.composition);
        console.error('   - negative_prompt:', analysisResult.negative_prompt);
        throw new Error('분석 결과가 올바른 형식이 아닙니다');
      }

      // 새로운 필드 검증 및 기본값 설정
      if (
        !analysisResult.character.body_proportions ||
        !analysisResult.character.limb_proportions ||
        !analysisResult.character.torso_shape ||
        !analysisResult.character.hand_style
      ) {
        console.warn('⚠️ 일부 필드 누락:');
        console.warn('   - body_proportions:', analysisResult.character.body_proportions);
        console.warn('   - limb_proportions:', analysisResult.character.limb_proportions);
        console.warn('   - torso_shape:', analysisResult.character.torso_shape);
        console.warn('   - hand_style:', analysisResult.character.hand_style);
        // 누락된 필드에 기본값 설정
        if (!analysisResult.character.body_proportions) {
          analysisResult.character.body_proportions = 'not specified';
        }
        if (!analysisResult.character.limb_proportions) {
          analysisResult.character.limb_proportions = 'not specified';
        }
        if (!analysisResult.character.torso_shape) {
          analysisResult.character.torso_shape = 'not specified';
        }
        if (!analysisResult.character.hand_style) {
          analysisResult.character.hand_style = 'not specified';
        }
      }

      console.log('✅ 분석 완료!');
      callbacks.onComplete(analysisResult);
    } catch (error) {
      console.error('Gemini 분석 오류:', error);
      callbacks.onError(
        error instanceof Error ? error : new Error('알 수 없는 오류가 발생했습니다')
      );
    }
  };

  return { analyzeImages };
}
