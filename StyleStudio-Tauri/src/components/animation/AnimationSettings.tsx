import { AnimationGridLayout } from '../../types/animation';

interface AnimationSettingsProps {
  grid: AnimationGridLayout;
  loop: boolean;
  onGridChange: (grid: AnimationGridLayout) => void;
  onLoopChange: (loop: boolean) => void;
}

// 그리드 옵션 정의
const GRID_OPTIONS: { value: AnimationGridLayout; label: string; frames: number }[] = [
  { value: '2x2', label: '2x2', frames: 4 },
  { value: '3x3', label: '3x3', frames: 9 },
  { value: '4x4', label: '4x4', frames: 16 },
  { value: '5x5', label: '5x5', frames: 25 },
];

export default function AnimationSettings({
  grid,
  loop,
  onGridChange,
  onLoopChange,
}: AnimationSettingsProps) {
  return (
    <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-4">
      {/* 그리드 선택 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">그리드</span>
        <div className="flex items-center gap-1">
          {GRID_OPTIONS.map((option) => {
            const isSelected = grid === option.value;
            return (
              <button
                key={option.value}
                onClick={() => onGridChange(option.value)}
                className={`px-3 py-1 text-xs rounded-full border cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {option.label} ({option.frames})
              </button>
            );
          })}
        </div>
      </div>

      {/* 루프 체크박스 */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="animation-loop"
          checked={loop}
          onChange={(e) => onLoopChange(e.target.checked)}
          className="accent-emerald-600"
        />
        <label htmlFor="animation-loop" className="text-sm cursor-pointer">
          Loop
        </label>
      </div>
    </div>
  );
}
