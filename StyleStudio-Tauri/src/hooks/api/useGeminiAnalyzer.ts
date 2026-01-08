import {
  STYLE_ANALYZER_PROMPT,
  MULTI_IMAGE_ANALYZER_PROMPT,
  REFINEMENT_ANALYZER_PROMPT,
  PIXELART_ANALYZER_PROMPT,
} from '../../lib/gemini/analysisPrompt';
import { ImageAnalysisResult } from '../../types/analysis';
import { SessionType } from '../../types/session';
import { logger } from '../../lib/logger';

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
    sessionType?: SessionType,
    options?: AnalysisOptions
  ) => {
    try {
      // API Key 검증
      const cleanApiKey = String(apiKey || '').trim();
      if (!cleanApiKey) {
        throw new Error('API Key가 비어있습니다');
      }

      logger.debug('🔑 API Key 정보:');
      logger.debug('   - 키 길이:', cleanApiKey.length);
      logger.debug('   - 키 시작:', cleanApiKey.substring(0, 15) + '...');
      logger.debug('   - 키 형식 확인:', cleanApiKey.startsWith('AIza') ? '✅ 올바른 형식' : '⚠️ 잘못된 형식');

      // 이미지 배열 검증
      if (!imageBase64Array || imageBase64Array.length === 0) {
        throw new Error('분석할 이미지가 없습니다');
      }

      logger.debug('📷 이미지 정보:');
      logger.debug('   - 이미지 개수:', imageBase64Array.length);

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

      logger.debug('   - 처리된 이미지 parts:', imageParts.length);

      // 프롬프트 선택 로직
      let analysisPrompt: string;
      let promptType: string;

      // 픽셀아트 타입이면 픽셀아트 전용 프롬프트 사용
      if (sessionType === 'PIXELART_CHARACTER' || sessionType === 'PIXELART_BACKGROUND') {
        analysisPrompt = PIXELART_ANALYZER_PROMPT;
        promptType = 'PIXELART';
        logger.debug('📋 프롬프트 선택: PIXELART (픽셀아트 특화 분석)');
      } else if (options?.previousAnalysis) {
        // 분석 강화 모드: 기존 분석 결과를 포함한 프롬프트 사용
        const previousAnalysisJson = JSON.stringify(options.previousAnalysis, null, 2);
        analysisPrompt = REFINEMENT_ANALYZER_PROMPT(previousAnalysisJson);
        promptType = 'REFINEMENT';
        logger.debug('📋 프롬프트 선택: REFINEMENT (분석 강화 모드)');
        logger.debug('   - 기존 분석 결과 포함');
      } else {
        // 일반 분석 모드: 이미지 개수에 따라 프롬프트 선택
        analysisPrompt =
          imageBase64Array.length > 1 ? MULTI_IMAGE_ANALYZER_PROMPT : STYLE_ANALYZER_PROMPT;
        promptType = imageBase64Array.length > 1 ? 'MULTI_IMAGE' : 'SINGLE_IMAGE';
        logger.debug('📋 프롬프트 선택:', promptType);
      }

      // Gemini API 엔드포인트 (gemini-2.5-flash 사용)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cleanApiKey}`;

      logger.debug('🌐 API 요청 정보:');
      logger.debug('   - URL:', url.replace(cleanApiKey, 'API_KEY_MASKED'));
      logger.debug('   - 모델:', 'gemini-2.5-flash');

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
            maxOutputTokens: 8192, // JSON 응답 잘림 방지를 위해 증가
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('❌ API 오류 발생:');
        logger.error('   - 상태 코드:', response.status);
        logger.error('   - 상태 텍스트:', response.statusText);
        logger.error('   - 응답 내용:', errorText);

        // 에러 내용 파싱 시도
        try {
          const errorJson = JSON.parse(errorText);
          logger.error('   - 파싱된 오류:', JSON.stringify(errorJson, null, 2));
        } catch {
          logger.error('   - 원본 오류:', errorText);
        }

        throw new Error(`API 오류 (${response.status}): ${errorText}`);
      }

      callbacks.onProgress('분석 결과를 처리하고 있습니다...');

      const result = await response.json();
      logger.debug('✅ Gemini 응답 수신 성공');
      logger.debug('   - 전체 응답:', JSON.stringify(result, null, 2));

      // 응답에서 텍스트 추출
      const candidate = result.candidates?.[0];

      // 응답 차단 확인
      if (!candidate) {
        logger.error('❌ candidates가 없습니다');
        throw new Error('Gemini 응답에 candidates가 없습니다. API 키나 요청을 확인하세요.');
      }

      // finishReason 확인
      const finishReason = candidate.finishReason;
      logger.debug('   - finishReason:', finishReason);

      if (finishReason === 'SAFETY') {
        logger.error('❌ 안전 필터에 의해 차단됨');
        logger.error('   - safetyRatings:', candidate.safetyRatings);
        throw new Error('이미지가 안전 필터에 의해 차단되었습니다. 다른 이미지로 시도해주세요.');
      }

      if (finishReason === 'RECITATION') {
        logger.error('❌ 저작권 관련 차단');
        throw new Error('저작권 관련 문제로 분석이 차단되었습니다.');
      }

      if (finishReason === 'MAX_TOKENS') {
        logger.error('❌ 최대 토큰 수 초과로 응답 잘림');
        throw new Error('응답이 너무 길어서 잘렸습니다. 이미지 개수를 줄이거나 다시 시도해주세요.');
      }

      if (finishReason === 'OTHER' || finishReason === 'BLOCKLIST') {
        logger.error('❌ 기타 이유로 차단됨:', finishReason);
        throw new Error(`응답이 차단되었습니다: ${finishReason}`);
      }

      if (finishReason !== 'STOP') {
        logger.warn('⚠️ 비정상적인 finishReason:', finishReason);
        logger.warn('   - 응답이 완전하지 않을 수 있습니다');
      }

      const text = candidate.content?.parts?.[0]?.text;
      if (!text) {
        logger.error('❌ 텍스트 추출 실패:');
        logger.error('   - candidate:', JSON.stringify(candidate, null, 2));
        logger.error('   - content:', candidate.content);
        logger.error('   - parts:', candidate.content?.parts);
        logger.error('   - finishReason:', finishReason);
        logger.error('   - safetyRatings:', candidate.safetyRatings);

        // promptFeedback 확인
        if (result.promptFeedback) {
          logger.error('   - promptFeedback:', result.promptFeedback);
          if (result.promptFeedback.blockReason) {
            throw new Error(`프롬프트가 차단되었습니다: ${result.promptFeedback.blockReason}`);
          }
        }

        throw new Error('Gemini 응답에 텍스트가 없습니다. 이미지를 확인하거나 다시 시도해주세요.');
      }

      logger.debug('📝 추출된 텍스트:');
      logger.debug('   - 길이:', text.length);
      logger.debug('   - 시작:', text.substring(0, 100) + '...');

      // JSON 파싱
      let analysisResult: ImageAnalysisResult;
      let jsonText = text; // catch 블록에서도 접근 가능하도록 try 블록 밖에서 선언
      try {
        logger.debug('🔍 JSON 파싱 시도...');

        // 1단계: ```json ``` 또는 ``` ``` 코드 블록 제거
        if (text.includes('```')) {
          logger.debug('   - 코드 블록 감지, 제거 중...');
          // ```json ... ``` 패턴 매칭
          const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonBlockMatch) {
            jsonText = jsonBlockMatch[1];
            logger.debug('   - ```json``` 블록 추출 성공');
          } else {
            // ``` ... ``` 패턴 매칭
            const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
              jsonText = codeBlockMatch[1];
              logger.debug('   - ``` 블록 추출 성공');
            } else {
              // 백틱만 제거
              jsonText = text.replace(/```json|```/g, '');
              logger.debug('   - 백틱 수동 제거');
            }
          }
        }

        // 2단계: JSON 객체만 추출 (첫 { 부터 마지막 } 까지)
        const firstBrace = jsonText.indexOf('{');
        const lastBrace = jsonText.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonText = jsonText.substring(firstBrace, lastBrace + 1);
          logger.debug('   - JSON 객체 추출 성공');
        }

        // 3단계: JSON 클린업 - trailing commas 제거
        // ,} 또는 ,] 패턴을 } 또는 ]로 변경
        jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
        logger.debug('   - Trailing commas 제거 완료');

        logger.debug('   - 최종 JSON 텍스트 (앞 300자):', jsonText.substring(0, 300));
        logger.debug('   - 최종 JSON 텍스트 (전체 길이):', jsonText.length);

        // 4단계: JSON 파싱
        analysisResult = JSON.parse(jsonText.trim());
        logger.debug('✅ JSON 파싱 성공');
        logger.debug('   - 결과:', JSON.stringify(analysisResult, null, 2));
      } catch (parseError) {
        logger.error('❌ JSON 파싱 실패:', parseError);

        // 에러 위치 정보 추출 (처리된 jsonText 기준)
        const errorMessage = (parseError as Error).message;
        const positionMatch = errorMessage.match(/position (\d+)/);

        if (positionMatch) {
          const errorPos = parseInt(positionMatch[1]);
          const start = Math.max(0, errorPos - 100);
          const end = Math.min(jsonText.length, errorPos + 100);

          logger.error('   - 에러 발생 위치 주변 (±100자):', jsonText.substring(start, end));
          logger.error('   - 에러 위치:', errorPos);
        }

        // 전체 JSON 텍스트 출력 (처리된 jsonText)
        logger.error('   - 파싱 시도한 전체 JSON (길이:', jsonText.length, '):');
        logger.error(jsonText);

        // 원본 텍스트도 출력
        logger.error('   - 원본 Gemini 응답 (길이:', text.length, '):');
        logger.error(text);

        throw new Error('분석 결과를 JSON으로 파싱할 수 없습니다. Gemini 응답 형식을 확인하세요.');
      }

      // 결과 검증
      logger.debug('🔎 결과 검증 중...');
      if (
        !analysisResult.style ||
        !analysisResult.character ||
        !analysisResult.composition ||
        analysisResult.negative_prompt === undefined
      ) {
        logger.error('❌ 결과 형식 오류:');
        logger.error('   - style:', analysisResult.style);
        logger.error('   - character:', analysisResult.character);
        logger.error('   - composition:', analysisResult.composition);
        logger.error('   - negative_prompt:', analysisResult.negative_prompt);
        throw new Error('분석 결과가 올바른 형식이 아닙니다');
      }

      // 새로운 필드 검증 및 기본값 설정
      if (
        !analysisResult.character.body_proportions ||
        !analysisResult.character.limb_proportions ||
        !analysisResult.character.torso_shape ||
        !analysisResult.character.hand_style
      ) {
        logger.warn('⚠️ 일부 필드 누락:');
        logger.warn('   - body_proportions:', analysisResult.character.body_proportions);
        logger.warn('   - limb_proportions:', analysisResult.character.limb_proportions);
        logger.warn('   - torso_shape:', analysisResult.character.torso_shape);
        logger.warn('   - hand_style:', analysisResult.character.hand_style);
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

      // 분석 강화 모드인 경우 기존 사용자 맞춤 프롬프트 유지
      if (options?.previousAnalysis?.user_custom_prompt) {
        analysisResult.user_custom_prompt = options.previousAnalysis.user_custom_prompt;
        logger.debug('✅ 사용자 맞춤 프롬프트 유지:', analysisResult.user_custom_prompt);
      }

      logger.debug('✅ 분석 완료!');
      callbacks.onComplete(analysisResult);
    } catch (error) {
      logger.error('Gemini 분석 오류:', error);
      callbacks.onError(
        error instanceof Error ? error : new Error('알 수 없는 오류가 발생했습니다')
      );
    }
  };

  return { analyzeImages };
}
