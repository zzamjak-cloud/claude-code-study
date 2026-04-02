import { Trash2 } from 'lucide-react';
import { GenerationHistoryEntry } from '../../types/session';

interface AnimationHistoryProps {
  history: GenerationHistoryEntry[];
  selectedId: string | null;
  onSelect: (entry: GenerationHistoryEntry) => void;
  onDelete: (id: string) => void;
}

// 생성 히스토리 썸네일 목록 (하단 가로 스크롤)
export default function AnimationHistory({
  history,
  selectedId,
  onSelect,
  onDelete,
}: AnimationHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="border-t border-gray-200 bg-gray-50 p-3">
        <p className="text-sm text-gray-400 text-center">
          생성된 이미지가 여기에 표시됩니다
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-3">
      <div className="flex gap-2 overflow-x-auto">
        {history.map((entry) => {
          const isSelected = entry.id === selectedId;
          const src = entry.imageBase64.startsWith('data:')
            ? entry.imageBase64
            : `data:image/png;base64,${entry.imageBase64}`;

          return (
            <div
              key={entry.id}
              className="relative flex-shrink-0 group"
            >
              {/* 썸네일 */}
              <button
                onClick={() => onSelect(entry)}
                className={`w-16 h-16 rounded border-2 overflow-hidden cursor-pointer transition-all ${
                  isSelected
                    ? 'border-emerald-500 ring-2 ring-emerald-300'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <img
                  src={src}
                  alt={entry.prompt.slice(0, 30)}
                  className="w-full h-full object-cover"
                />
              </button>

              {/* 삭제 버튼 (호버 시 표시) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(entry.id);
                }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="삭제"
              >
                <Trash2 size={10} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
