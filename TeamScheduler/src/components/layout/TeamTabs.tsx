// 팀원 탭 컴포넌트

import { Users } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

export function TeamTabs() {
  const { members, selectedMemberId, selectMember } = useAppStore()

  // 통합 탭 + 팀원 탭
  const tabs = [
    { id: null, name: '통합', icon: <Users className="w-4 h-4" /> },
    ...members.map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
    })),
  ]

  return (
    <div className="bg-card border-b border-border px-6 overflow-x-auto scrollbar-thin">
      <div className="flex gap-2 py-2">
        {tabs.map((tab) => {
          const isSelected = tab.id === selectedMemberId
          const isUnified = tab.id === null

          return (
            <button
              key={tab.id || 'unified'}
              onClick={() => selectMember(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-t-md transition-colors font-medium
                ${
                  isSelected
                    ? 'bg-background text-foreground border-t border-x border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }
              `}
              style={
                !isUnified && 'color' in tab
                  ? {
                      borderBottomColor: isSelected ? tab.color : undefined,
                      borderBottomWidth: isSelected ? '2px' : undefined,
                    }
                  : undefined
              }
            >
              {isUnified && tab.icon}
              <span className="whitespace-nowrap">{tab.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
