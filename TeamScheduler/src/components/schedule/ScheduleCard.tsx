// 일정 카드 컴포넌트 (Phase 1: 드래그 없이 정적 표시만)

import { Schedule } from '../../types/schedule'
import { CELL_HEIGHT } from '../../lib/constants/grid'
import { dateRangeToWidth } from '../../lib/utils/dateUtils'
import { useAppStore } from '../../store/useAppStore'
import { Link as LinkIcon } from 'lucide-react'

interface ScheduleCardProps {
  schedule: Schedule
  x: number
}

export function ScheduleCard({ schedule, x }: ScheduleCardProps) {
  const { zoomLevel } = useAppStore()

  const width = dateRangeToWidth(
    new Date(schedule.startDate),
    new Date(schedule.endDate),
    zoomLevel
  )

  return (
    <div
      className="absolute top-1 pointer-events-auto cursor-pointer"
      style={{
        left: `${x}px`,
        width: `${width}px`,
        height: `${CELL_HEIGHT - 8}px`,
      }}
    >
      <div
        className="h-full px-3 py-2 rounded-md border-2 border-transparent hover:border-primary transition-colors overflow-hidden"
        style={{
          backgroundColor: schedule.color,
          color: schedule.textColor || '#ffffff',
        }}
      >
        <div className="flex items-center gap-2 h-full">
          <span className="text-sm font-medium truncate flex-1">
            {schedule.title || '제목 없음'}
          </span>
          {schedule.link && (
            <LinkIcon className="w-4 h-4 flex-shrink-0 opacity-70" />
          )}
        </div>
      </div>
    </div>
  )
}
