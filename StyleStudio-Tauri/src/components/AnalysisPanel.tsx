import { Sparkles, Save, RefreshCw, Plus, Trash2, Wand2 } from 'lucide-react';
import { ImageAnalysisResult } from '../types/analysis';
import { StyleCard } from './StyleCard';
import { CharacterCard } from './CharacterCard';
import { CompositionCard } from './CompositionCard';
import { NegativePromptCard } from './NegativePromptCard';
import { UnifiedPromptCard } from './UnifiedPromptCard';
import { Session } from '../types/session';

import { StyleAnalysis, CharacterAnalysis, CompositionAnalysis } from '../types/analysis';
import { KoreanAnalysisCache } from '../types/session';

interface AnalysisPanelProps {
  images: string[];
  isAnalyzing: boolean;
  analysisResult: ImageAnalysisResult | null;
  apiKey: string;
  koreanAnalysis?: KoreanAnalysisCache;
  onAnalyze: () => void;
  onSaveSession?: () => void;
  onReset?: () => void;
  onAddImage?: (imageData: string) => void;
  onRemoveImage?: (index: number) => void;
  onGenerateImage?: () => void;
  currentSession?: Session | null;
  onCustomPromptChange?: (customPrompt: string) => void;
  onStyleUpdate?: (style: StyleAnalysis) => void;
  onCharacterUpdate?: (character: CharacterAnalysis) => void;
  onCompositionUpdate?: (composition: CompositionAnalysis) => void;
  onNegativePromptUpdate?: (negativePrompt: string) => void;
}

export function AnalysisPanel({
  images,
  isAnalyzing,
  analysisResult,
  apiKey,
  koreanAnalysis,
  onAnalyze,
  onSaveSession,
  onReset,
  onAddImage,
  onRemoveImage,
  onGenerateImage,
  currentSession,
  onCustomPromptChange,
  onStyleUpdate,
  onCharacterUpdate,
  onCompositionUpdate,
  onNegativePromptUpdate,
}: AnalysisPanelProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* 왼쪽: 이미지 미리보기 그리드 */}
      <div className="flex-1 flex flex-col p-8 bg-gray-50 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full">
          {/* 참조 이미지 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">참조 이미지</h3>
              <p className="text-sm text-gray-500">총 {images.length}개</p>
            </div>
            <button
              onClick={onReset}
              className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold transition-all"
            >
              <RefreshCw size={18} />
              <span>새로 시작</span>
            </button>
          </div>

          {/* 이미지 그리드 */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            {images.map((image, index) => (
              <div key={index} className="relative group">
                <img
                  src={image}
                  alt={`Reference ${index + 1}`}
                  className="w-full h-auto rounded-xl shadow-lg"
                />

                {/* 삭제 버튼 */}
                {onRemoveImage && (
                  <button
                    onClick={() => onRemoveImage(index)}
                    className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                )}

                {/* 이미지 번호 */}
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
                  #{index + 1}
                </div>
              </div>
            ))}
          </div>

          {/* 이미지 추가 버튼 - 세션이 있을 때만 표시 */}
          {onAddImage && currentSession && (
            <div className="mb-4">
              <label className="cursor-pointer">
                <div className="border-2 border-dashed border-gray-300 hover:border-purple-500 rounded-xl p-8 flex flex-col items-center justify-center transition-all hover:bg-gray-100">
                  <Plus size={48} className="text-gray-400 mb-2" />
                  <p className="text-gray-600 font-semibold">이미지 추가하기</p>
                  <p className="text-sm text-gray-500">스타일 분석을 강화할 이미지를 추가하세요</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const result = ev.target?.result as string;
                        onAddImage(result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* 오른쪽: 분석 패널 */}
      <div className="w-[500px] bg-white border-l border-gray-200 p-6 flex flex-col overflow-y-auto">
        {/* 분석 전 상태 */}
        {!analysisResult && !isAnalyzing && (
          <>
            <p className="text-gray-600 mb-6">
              AI가 이미지의 스타일, 캐릭터, 구도를 분석합니다.
            </p>

            <button
              onClick={onAnalyze}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              <Sparkles size={20} />
              <span>이미지 분석 시작</span>
            </button>
          </>
        )}

        {/* 분석 중 상태 */}
        {isAnalyzing && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
            <p className="text-gray-600 font-semibold">Gemini가 분석 중...</p>
            <p className="text-sm text-gray-500 mt-2">스타일, 캐릭터, 구도 정보 추출 중</p>
          </div>
        )}

        {/* 분석 완료 상태 */}
        {analysisResult && !isAnalyzing && (
          <div className="space-y-4">
            {/* 액션 버튼 (상단) - 아이콘만 한 라인에 3개 */}
            <div className="flex gap-2 pb-4 border-b border-gray-200">
              {/* 이미지 생성 버튼 */}
              {onGenerateImage && (
                <button
                  onClick={onGenerateImage}
                  className="flex-1 flex items-center justify-center p-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all shadow-lg hover:shadow-xl"
                  title="이미지 생성하기"
                >
                  <Wand2 size={20} />
                </button>
              )}

              {/* 분석 강화 버튼 */}
              <button
                onClick={onAnalyze}
                className="flex-1 flex items-center justify-center p-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all"
                title={currentSession ? '분석 강화' : '다시 분석'}
              >
                <Sparkles size={20} />
              </button>

              {/* 세션 저장 버튼 */}
              {onSaveSession && (
                <button
                  onClick={onSaveSession}
                  className="flex-1 flex items-center justify-center p-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-lg transition-all shadow-lg hover:shadow-xl"
                  title="세션 저장"
                >
                  <Save size={20} />
                </button>
              )}
            </div>

            {/* 통합 프롬프트 카드 (최상단) */}
            <UnifiedPromptCard
              analysis={analysisResult}
              apiKey={apiKey}
              koreanPositivePrompt={koreanAnalysis?.positivePrompt}
              koreanNegativePrompt={koreanAnalysis?.negativePrompt}
              onCustomPromptChange={onCustomPromptChange}
            />

            {/* 스타일 카드 */}
            <StyleCard
              style={analysisResult.style}
              apiKey={apiKey}
              koreanStyle={koreanAnalysis?.style}
              onUpdate={onStyleUpdate}
            />

            {/* 캐릭터 카드 */}
            <CharacterCard
              character={analysisResult.character}
              apiKey={apiKey}
              koreanCharacter={koreanAnalysis?.character}
              onUpdate={onCharacterUpdate}
            />

            {/* 구도 카드 */}
            <CompositionCard
              composition={analysisResult.composition}
              apiKey={apiKey}
              koreanComposition={koreanAnalysis?.composition}
              onUpdate={onCompositionUpdate}
            />

            {/* 부정 프롬프트 카드 */}
            <NegativePromptCard
              negativePrompt={analysisResult.negative_prompt}
              apiKey={apiKey}
              koreanNegativePrompt={koreanAnalysis?.negativePrompt}
              onUpdate={onNegativePromptUpdate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
