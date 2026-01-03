import { User } from 'lucide-react';
import { CharacterAnalysis } from '../../types/analysis';
import { AnalysisCard } from './AnalysisCard';

interface CharacterCardProps {
  character: CharacterAnalysis;
  koreanCharacter?: CharacterAnalysis;
  onUpdate?: (character: CharacterAnalysis) => void;
  onKoreanUpdate?: (koreanCharacter: CharacterAnalysis) => void;
}

export function CharacterCard({ character, koreanCharacter, onUpdate, onKoreanUpdate }: CharacterCardProps) {
  const fields: Array<{ key: keyof CharacterAnalysis; label: string; icon?: string }> = [
    { key: 'gender', label: '성별', icon: '👤' },
    { key: 'age_group', label: '연령대', icon: '📅' },
    { key: 'hair', label: '머리', icon: '💇' },
    { key: 'eyes', label: '눈', icon: '👁️' },
    { key: 'face', label: '얼굴', icon: '😊' },
    { key: 'outfit', label: '의상', icon: '👔' },
    { key: 'accessories', label: '액세서리', icon: '💎' },
    { key: 'body_proportions', label: '등신대 비율', icon: '📏' },
    { key: 'limb_proportions', label: '팔다리 비율', icon: '🦵' },
    { key: 'torso_shape', label: '몸통 형태', icon: '🫁' },
    { key: 'hand_style', label: '손 표현', icon: '✋' },
  ];

  return (
    <AnalysisCard<CharacterAnalysis>
      title="캐릭터 분석"
      icon={User}
      iconColor="text-blue-600"
      borderColor="border-blue-200"
      bgColor="bg-blue-100"
      hoverColor="hover:text-blue-600 hover:bg-blue-50"
      focusColor="border-blue-500 focus:ring-blue-500"
      data={character}
      koreanData={koreanCharacter}
      fields={fields}
      onUpdate={onUpdate}
      onKoreanUpdate={onKoreanUpdate}
    />
  );
}
