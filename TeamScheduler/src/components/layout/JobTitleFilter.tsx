// 직군 필터링 컴포넌트

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Users } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

export function JobTitleFilter() {
  const { members, selectedJobTitle, setSelectedJobTitle, selectedProjectId, projects } = useAppStore()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // 현재 프로젝트에 속한 구성원들의 직군 목록 추출
  const jobTitles = useMemo(() => {
    // 숨긴 구성원 제외
    let filteredMembers = members.filter((m) => !m.isHidden)

    // 선택된 프로젝트가 있으면 해당 프로젝트에 속한 구성원만
    if (selectedProjectId) {
      const project = projects.find((p) => p.id === selectedProjectId)
      if (project && project.memberIds) {
        filteredMembers = filteredMembers.filter((m) => project.memberIds.includes(m.id))
      }
    }

    // 직군 목록 추출 (중복 제거, 정렬)
    const titles = [...new Set(filteredMembers.map((m) => m.jobTitle).filter(Boolean))]
    return titles.sort((a, b) => a.localeCompare(b, 'ko'))
  }, [members, selectedProjectId, projects])

  // 직군 선택 핸들러
  const handleSelectJobTitle = (jobTitle: string | null) => {
    setSelectedJobTitle(jobTitle)
    setIsOpen(false)
  }

  // 직군이 없으면 표시하지 않음
  if (jobTitles.length === 0) {
    return null
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* 드롭다운 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center gap-2"
      >
        <Users className="w-4 h-4" />
        <span>{selectedJobTitle || '전체 직군'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 min-w-[150px]">
          {/* 전체 보기 */}
          <button
            onClick={() => handleSelectJobTitle(null)}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
              selectedJobTitle === null
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-foreground'
            }`}
          >
            전체 보기
          </button>

          <div className="border-t border-border" />

          {/* 직군 리스트 */}
          <div className="py-1 max-h-[300px] overflow-y-auto">
            {jobTitles.map((title) => (
              <button
                key={title}
                onClick={() => handleSelectJobTitle(title)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                  selectedJobTitle === title
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground'
                }`}
              >
                {title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
