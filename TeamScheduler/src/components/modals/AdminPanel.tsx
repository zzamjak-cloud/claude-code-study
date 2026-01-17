// 관리자 패널 (팀원 관리 + 공휴일 관리 + 프로젝트 관리)

import { useState, useMemo } from 'react'
import { X, Plus, UserPlus, Settings, Calendar, Check, Trash2, RefreshCw, FolderKanban, Pencil, ChevronUp, ChevronDown } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { addTeamMember, addEvent, createGlobalEvent, deleteEvent, createProject, updateProject, deleteProject as deleteProjectFirebase } from '../../lib/firebase/firestore'
import { COLOR_PRESETS, ANNUAL_LEAVE_COLOR } from '../../lib/constants/colors'
import { getHolidaysForYear, KoreanHoliday } from '../../lib/utils/koreanHolidays'
import { startOfDay, endOfDay, format } from 'date-fns'

interface AdminPanelProps {
  onClose: () => void
}

type TabType = 'team' | 'holiday' | 'project'

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('team')

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">관리</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'team'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            팀원
          </button>
          <button
            onClick={() => setActiveTab('project')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'project'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            프로젝트
          </button>
          <button
            onClick={() => setActiveTab('holiday')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'holiday'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="w-4 h-4" />
            공휴일
          </button>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'team' && <TeamManagement />}
          {activeTab === 'project' && <ProjectManagement />}
          {activeTab === 'holiday' && <HolidayManagement />}
        </div>
      </div>
    </div>
  )
}

// 팀원 관리 탭
function TeamManagement() {
  const { workspaceId, members } = useAppStore()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!workspaceId || !name.trim()) {
      alert('이름을 입력해주세요.')
      return
    }

    setIsSubmitting(true)

    try {
      const order = members.length

      await addTeamMember(workspaceId, {
        name: name.trim(),
        role: role.trim() || '팀원',
        color: selectedColor,
        isHidden: false,
        order,
        rowCount: 1,
      })

      setName('')
      setRole('')
      setSelectedColor(COLOR_PRESETS[0])
      alert('팀원이 추가되었습니다.')
    } catch (error) {
      console.error('팀원 추가 실패:', error)
      alert('팀원 추가에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 팀원 추가 폼 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 이름 */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            이름 *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="김개발"
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        {/* 역할 */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            역할
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="개발자"
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* 색상 선택 */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            색상
          </label>
          <div className="flex gap-2 flex-wrap">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                className={`w-8 h-8 rounded-md border-2 transition-all ${
                  selectedColor === color
                    ? 'border-foreground scale-110'
                    : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? '추가 중...' : (
            <>
              <Plus className="w-4 h-4" />
              팀원 추가
            </>
          )}
        </button>
      </form>

      {/* 현재 팀원 목록 */}
      {members.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-foreground mb-3">
            현재 팀원 ({members.length}명)
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: member.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {member.name}
                  </p>
                  {member.role && (
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// 공휴일 관리 탭
function HolidayManagement() {
  const { workspaceId, currentYear, events, currentUser } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [customHolidayName, setCustomHolidayName] = useState('')
  const [customHolidayDate, setCustomHolidayDate] = useState('')

  // 현재 연도의 대한민국 공휴일 목록
  const koreanHolidays = useMemo(() => getHolidaysForYear(currentYear), [currentYear])

  // 이미 등록된 공휴일 확인 (events에서 holiday 타입)
  const registeredHolidayDates = useMemo(() => {
    return new Set(
      events
        .filter(e => e.type === 'holiday')
        .map(e => format(new Date(e.date), 'yyyy-MM-dd'))
    )
  }, [events])

  // 공휴일을 특이사항(events)에 등록
  const registerHoliday = async (holiday: KoreanHoliday) => {
    if (!workspaceId || !currentUser) return

    setIsLoading(true)
    try {
      const dateTimestamp = new Date(holiday.date).getTime()

      // events에 holiday 타입으로 등록 (주말처럼 배경색 적용용)
      await addEvent(workspaceId, {
        title: holiday.name,
        date: dateTimestamp,
        type: 'holiday',
        color: ANNUAL_LEAVE_COLOR,
        createdBy: currentUser.uid,
      })

      // 글로벌 이벤트(특이사항 행)에도 카드 추가
      await createGlobalEvent(workspaceId, {
        title: holiday.name,
        startDate: startOfDay(new Date(holiday.date)).getTime(),
        endDate: endOfDay(new Date(holiday.date)).getTime(),
        color: ANNUAL_LEAVE_COLOR,
        rowIndex: 0,
        createdBy: currentUser.uid,
      })

    } catch (error) {
      console.error('공휴일 등록 실패:', error)
      alert('공휴일 등록에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 모든 공휴일 일괄 등록
  const registerAllHolidays = async () => {
    if (!workspaceId || !currentUser) return

    const unregistered = koreanHolidays.filter(h => !registeredHolidayDates.has(h.date))
    if (unregistered.length === 0) {
      alert('모든 공휴일이 이미 등록되어 있습니다.')
      return
    }

    setIsLoading(true)
    try {
      for (const holiday of unregistered) {
        const dateTimestamp = new Date(holiday.date).getTime()

        await addEvent(workspaceId, {
          title: holiday.name,
          date: dateTimestamp,
          type: 'holiday',
          color: ANNUAL_LEAVE_COLOR,
          createdBy: currentUser.uid,
        })

        // 글로벌 이벤트(특이사항 행)에도 카드 추가
        await createGlobalEvent(workspaceId, {
          title: holiday.name,
          startDate: startOfDay(new Date(holiday.date)).getTime(),
          endDate: endOfDay(new Date(holiday.date)).getTime(),
          color: ANNUAL_LEAVE_COLOR,
          rowIndex: 0,
          createdBy: currentUser.uid,
        })
      }
      alert(`${unregistered.length}개의 공휴일이 등록되었습니다.`)
    } catch (error) {
      console.error('공휴일 일괄 등록 실패:', error)
      alert('공휴일 등록 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 커스텀 휴일 추가 (창립기념일 등)
  const addCustomHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceId || !currentUser || !customHolidayName.trim() || !customHolidayDate) return

    setIsLoading(true)
    try {
      const dateTimestamp = new Date(customHolidayDate).getTime()

      await addEvent(workspaceId, {
        title: customHolidayName.trim(),
        date: dateTimestamp,
        type: 'holiday',
        color: ANNUAL_LEAVE_COLOR,
        createdBy: currentUser.uid,
      })

      await createGlobalEvent(workspaceId, {
        title: customHolidayName.trim(),
        startDate: startOfDay(new Date(customHolidayDate)).getTime(),
        endDate: endOfDay(new Date(customHolidayDate)).getTime(),
        color: ANNUAL_LEAVE_COLOR,
        rowIndex: 0,
        createdBy: currentUser.uid,
      })

      setCustomHolidayName('')
      setCustomHolidayDate('')
      alert('휴일이 등록되었습니다.')
    } catch (error) {
      console.error('커스텀 휴일 등록 실패:', error)
      alert('휴일 등록에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 등록된 공휴일 삭제
  const removeHoliday = async (eventId: string) => {
    if (!workspaceId) return

    setIsLoading(true)
    try {
      await deleteEvent(workspaceId, eventId)
    } catch (error) {
      console.error('공휴일 삭제 실패:', error)
      alert('공휴일 삭제에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 대한민국 공휴일 섹션 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-foreground">
            🇰🇷 {currentYear}년 대한민국 공휴일
          </h4>
          <button
            onClick={registerAllHolidays}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            전체 등록
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          공휴일을 등록하면 타임라인에 주말처럼 배경색이 적용되고, 특이사항 행에 카드가 추가됩니다.
        </p>

        <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
          {koreanHolidays.map((holiday) => {
            const isRegistered = registeredHolidayDates.has(holiday.date)
            return (
              <div
                key={holiday.date}
                className={`flex items-center justify-between p-2 rounded-md text-sm ${
                  isRegistered ? 'bg-green-50 dark:bg-green-950/30' : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isRegistered && (
                    <Check className="w-4 h-4 text-green-600" />
                  )}
                  <span className={isRegistered ? 'text-green-700 dark:text-green-400' : 'text-foreground'}>
                    {holiday.name}
                  </span>
                  {holiday.isSubstitute && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      대체
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(holiday.date), 'M/d')}
                  </span>
                  {!isRegistered ? (
                    <button
                      onClick={() => registerHoliday(holiday)}
                      disabled={isLoading}
                      className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      등록
                    </button>
                  ) : (
                    <span className="text-xs text-green-600">등록됨</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 커스텀 휴일 추가 */}
      <div className="pt-4 border-t border-border">
        <h4 className="text-sm font-semibold text-foreground mb-3">
          📅 커스텀 휴일 추가
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          창립기념일, 사내 행사 등 커스텀 휴일을 추가할 수 있습니다.
        </p>

        <form onSubmit={addCustomHoliday} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={customHolidayName}
              onChange={(e) => setCustomHolidayName(e.target.value)}
              placeholder="휴일명 (예: 창립기념일)"
              className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <input
              type="date"
              value={customHolidayDate}
              onChange={(e) => setCustomHolidayDate(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !customHolidayName.trim() || !customHolidayDate}
            className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            휴일 추가
          </button>
        </form>
      </div>

      {/* 등록된 휴일 목록 */}
      {events.filter(e => e.type === 'holiday').length > 0 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-semibold text-foreground mb-3">
            ✅ 등록된 휴일 ({events.filter(e => e.type === 'holiday').length}개)
          </h4>
          <div className="space-y-1 max-h-36 overflow-y-auto scrollbar-thin">
            {events
              .filter(e => e.type === 'holiday')
              .sort((a, b) => a.date - b.date)
              .map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: event.color }}
                    />
                    <span className="text-foreground">{event.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(event.date), 'yyyy/M/d')}
                    </span>
                    <button
                      onClick={() => removeHoliday(event.id)}
                      disabled={isLoading}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// 프로젝트 관리 탭
function ProjectManagement() {
  const { workspaceId, projects, currentUser } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColor, setNewProjectColor] = useState(COLOR_PRESETS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // 정렬된 프로젝트 목록
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [projects])

  // 프로젝트 추가
  const addNewProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceId || !currentUser || !newProjectName.trim()) return

    setIsLoading(true)
    try {
      const maxOrder = projects.length > 0
        ? Math.max(...projects.map(p => p.order ?? 0)) + 1
        : 0

      await createProject(workspaceId, {
        name: newProjectName.trim(),
        color: newProjectColor,
        order: maxOrder,
        createdBy: currentUser.uid,
      })

      setNewProjectName('')
      setNewProjectColor(COLOR_PRESETS[0])
    } catch (error) {
      console.error('프로젝트 추가 실패:', error)
      alert('프로젝트 추가에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 프로젝트 삭제
  const removeProject = async (projectId: string) => {
    if (!workspaceId) return

    setIsLoading(true)
    try {
      await deleteProjectFirebase(workspaceId, projectId)
    } catch (error) {
      console.error('프로젝트 삭제 실패:', error)
      alert('프로젝트 삭제에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 프로젝트 이름 편집 시작
  const startEditing = (projectId: string, currentName: string) => {
    setEditingId(projectId)
    setEditingName(currentName)
  }

  // 프로젝트 이름 저장
  const saveProjectName = async () => {
    if (!workspaceId || !editingId || !editingName.trim()) {
      setEditingId(null)
      return
    }

    setIsLoading(true)
    try {
      await updateProject(workspaceId, editingId, { name: editingName.trim() })
      setEditingId(null)
      setEditingName('')
    } catch (error) {
      console.error('프로젝트 이름 수정 실패:', error)
      alert('프로젝트 이름 수정에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 프로젝트 순서 변경
  const moveProject = async (projectId: string, direction: 'up' | 'down') => {
    if (!workspaceId) return

    const currentIndex = sortedProjects.findIndex(p => p.id === projectId)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= sortedProjects.length) return

    const currentProject = sortedProjects[currentIndex]
    const targetProject = sortedProjects[targetIndex]

    setIsLoading(true)
    try {
      // 순서 교환
      await updateProject(workspaceId, currentProject.id, { order: targetProject.order ?? targetIndex })
      await updateProject(workspaceId, targetProject.id, { order: currentProject.order ?? currentIndex })
    } catch (error) {
      console.error('프로젝트 순서 변경 실패:', error)
      alert('프로젝트 순서 변경에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 프로젝트 추가 폼 */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">
          📁 프로젝트 추가
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          프로젝트를 등록하면 일정 생성 시 선택할 수 있습니다.
        </p>

        <form onSubmit={addNewProject} className="space-y-3">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="프로젝트명 (예: 웹사이트 리뉴얼)"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">색상</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewProjectColor(color)}
                  className={`w-7 h-7 rounded-md border-2 transition-all ${
                    newProjectColor === color
                      ? 'border-foreground scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !newProjectName.trim()}
            className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            프로젝트 추가
          </button>
        </form>
      </div>

      {/* 등록된 프로젝트 목록 */}
      {sortedProjects.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-semibold text-foreground mb-3">
            📋 등록된 프로젝트 ({sortedProjects.length}개)
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
            {sortedProjects.map((project, index) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  {editingId === project.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={saveProjectName}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveProjectName()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                      className="flex-1 px-2 py-0.5 text-sm border border-primary rounded bg-background text-foreground focus:outline-none"
                    />
                  ) : (
                    <span className="text-foreground truncate">{project.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {/* 순서 변경 버튼 */}
                  <button
                    onClick={() => moveProject(project.id, 'up')}
                    disabled={isLoading || index === 0}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                    title="위로 이동"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveProject(project.id, 'down')}
                    disabled={isLoading || index === sortedProjects.length - 1}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                    title="아래로 이동"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {/* 편집 버튼 */}
                  <button
                    onClick={() => startEditing(project.id, project.name)}
                    disabled={isLoading}
                    className="p-1 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                    title="이름 편집"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => removeProject(project.id)}
                    disabled={isLoading}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sortedProjects.length === 0 && (
        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground text-center py-4">
            등록된 프로젝트가 없습니다.
          </p>
        </div>
      )}
    </div>
  )
}
