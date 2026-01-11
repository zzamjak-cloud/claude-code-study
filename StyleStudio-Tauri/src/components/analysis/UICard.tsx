import { Monitor } from 'lucide-react';
import { UISpecificAnalysis } from '../../types/analysis';
import { AnalysisCard } from './AnalysisCard';

interface UICardProps {
  uiAnalysis: UISpecificAnalysis;
  koreanUIAnalysis?: UISpecificAnalysis;
  onUpdate?: (uiAnalysis: UISpecificAnalysis) => void;
  onKoreanUpdate?: (koreanUIAnalysis: UISpecificAnalysis) => void;
}

export function UICard({ uiAnalysis, koreanUIAnalysis, onUpdate, onKoreanUpdate }: UICardProps) {
  const fields: Array<{ key: keyof UISpecificAnalysis; label: string; icon?: string }> = [
    { key: 'platform_type', label: '플랫폼 및 유형', icon: '📱' },
    { key: 'visual_style', label: '비주얼 스타일', icon: '🎨' },
    { key: 'key_elements', label: '핵심 UI 요소', icon: '🧩' },
    { key: 'color_theme', label: '색상 테마', icon: '🌈' },
  ];

  return (
    <AnalysisCard<UISpecificAnalysis>
      title="UI 디자인 분석"
      icon={Monitor}
      iconColor="text-pink-600"
      borderColor="border-pink-200"
      bgColor="bg-pink-100"
      hoverColor="hover:text-pink-600 hover:bg-pink-50"
      focusColor="border-pink-500 focus:ring-pink-500"
      data={uiAnalysis}
      koreanData={koreanUIAnalysis}
      fields={fields}
      onUpdate={onUpdate}
      onKoreanUpdate={onKoreanUpdate}
    />
  );
}
