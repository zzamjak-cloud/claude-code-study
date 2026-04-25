// 주간 보기 — 이름(구성원) 다중 선택 필터

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, UserCircle } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

export function WeekViewMemberFilter() {
  const { members, selectedProjectId, projects, weekViewMemberIds, setWeekViewMemberIds, selectedMemberId } =
    useAppStore()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const projectMembers = useMemo(() => {
    let list = members.filter((m) => !m.isHidden)
    if (selectedProjectId) {
      const project = projects.find((p) => p.id === selectedProjectId)
      if (project?.memberIds?.length) {
        list = list.filter((m) => project.memberIds!.includes(m.id))
      }
    }
    if (selectedMemberId) {
      list = list.filter((m) => m.id === selectedMemberId)
    }
    return [...list].sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [members, selectedProjectId, projects, selectedMemberId])

  const selectedSet = useMemo(() => new Set(weekViewMemberIds ?? []), [weekViewMemberIds])

  const toggleMember = (id: string) => {
    const base = weekViewMemberIds ?? projectMembers.map((m) => m.id)
    const next = new Set(base)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    const arr = [...next]
    if (arr.length === projectMembers.length) {
      setWeekViewMemberIds(null)
    } else {
      setWeekViewMemberIds(arr)
    }
  }

  const selectAll = () => {
    setWeekViewMemberIds(null)
  }

  const clearAll = () => {
    setWeekViewMemberIds([])
  }

  const label =
    weekViewMemberIds === null || weekViewMemberIds.length === projectMembers.length
      ? '전체 이름'
      : `${weekViewMemberIds.length}명 선택`

  if (projectMembers.length === 0) return null

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center gap-2"
      >
        <UserCircle className="w-4 h-4" />
        <span>{label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 min-w-[200px] max-h-[320px] overflow-y-auto">
          <div className="border-b border-border p-1 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={selectAll}
              className="text-left px-2 py-1.5 text-xs rounded hover:bg-accent text-foreground"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-left px-2 py-1.5 text-xs rounded hover:bg-accent text-foreground"
            >
              전체 해제
            </button>
          </div>
          <div className="px-3 pt-2 pb-1 text-[11px] text-muted-foreground">구성원 이름</div>
          <div className="py-1">
            {projectMembers.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={weekViewMemberIds === null ? true : selectedSet.has(m.id)}
                  onChange={() => toggleMember(m.id)}
                  className="rounded border-border"
                />
                <span className="truncate">{m.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
