// 그리드 셀 컴포넌트

import { CELL_HEIGHT } from '../../lib/constants/grid'
import { getCellWidth } from '../../lib/utils/gridUtils'
import { useAppStore } from '../../store/useAppStore'

interface GridCellProps {
  dayIndex: number
}

export function GridCell({ dayIndex }: GridCellProps) {
  const { zoomLevel } = useAppStore()
  const cellWidth = getCellWidth(zoomLevel)

  return (
    <div
      className="border-r border-border bg-background hover:bg-muted/30 transition-colors"
      style={{
        width: `${cellWidth}px`,
        height: `${CELL_HEIGHT}px`,
      }}
    />
  )
}
