// 구성원 탭 컴포넌트 (드래그 순서 변경 + 우클릭 메뉴 지원)

import { useState, useEffect, useRef, useMemo } from 'react'
import { Users, EyeOff, Archive } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { usePermissions } from '../../lib/hooks/usePermissions'
import { batchReorderTeamMembers, updateTeamMember, updateProject as updateProjectFirebase } from '../../lib/firebase/firestore'
import { TeamMember } from '../../types/team'
import { HiddenMembersModal } from '../modals/HiddenMembersModal'

export function TeamTabs() {
  // Zustand 선택적 구독
  const members = useAppStore(state => state.members)
  const selectedMemberId = useAppStore(state => state.selectedMemberId)
  const selectMember = useAppStore(state => state.selectMember)
  const reorderMembers = useAppStore(state => state.reorderMembers)
  const workspaceId = useAppStore(state => state.workspaceId)
  const selectedProjectId = useAppStore(state => state.selectedProjectId)
  const projects = useAppStore(state => state.projects)
  const selectedJobTitle = useAppStore(state => state.selectedJobTitle)
  const updateProjectStore = useAppStore(state => state.updateProject)

  // 최고 관리자 권한 확인
  const { isOwner } = usePermissions()

  // 드래그 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [insertPosition, setInsertPosition] = useState<number | null>(null)  // 삽입될 위치 (해당 인덱스 앞에 삽입)

  // 우클릭 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    member: TeamMember
  } | null>(null)

  // 보관함 모달 상태
  const [showHiddenModal, setShowHiddenModal] = useState(false)

  // 메뉴 ref (외부 클릭 감지용)
  const menuRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [contextMenu])

  // 우클릭 핸들러 (최고 관리자만 사용 가능)
  const handleContextMenu = (e: React.MouseEvent, member: TeamMember) => {
    e.preventDefault()
    // 최고 관리자가 아니면 컨텍스트 메뉴 표시하지 않음
    if (!isOwner) return

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      member,
    })
  }

  // 숨김 클릭
  const handleHideClick = async () => {
    if (!contextMenu || !workspaceId) return

    try {
      await updateTeamMember(workspaceId, contextMenu.member.id, { isHidden: true })
      // 현재 선택된 탭이 숨겨진 경우 통합 탭으로 이동
      if (selectedMemberId === contextMenu.member.id) {
        selectMember(null)
      }
    } catch (error) {
      console.error('구성원 숨김 실패:', error)
    } finally {
      setContextMenu(null)
    }
  }

  // 현재 선택된 프로젝트
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null
    return projects.find((p) => p.id === selectedProjectId) || null
  }, [selectedProjectId, projects])

  // order 기준으로 정렬된 구성원 목록 (숨긴 구성원 제외 + 프로젝트 필터링 + 직군 필터링)
  const sortedMembers = useMemo(() => {
    // 숨긴 구성원 제외
    let filtered = members.filter((m) => !m.isHidden)

    // 선택된 프로젝트가 있으면 해당 프로젝트에 속한 구성원만 표시
    if (selectedProject && selectedProject.memberIds) {
      filtered = filtered.filter((m) => selectedProject.memberIds.includes(m.id))
    }

    // 선택된 직군이 있으면 해당 직군만 표시
    if (selectedJobTitle) {
      filtered = filtered.filter((m) => m.jobTitle === selectedJobTitle)
    }

    // 프로젝트가 선택되어 있고 memberOrder가 있으면 프로젝트 순서 사용
    if (selectedProject && selectedProject.memberOrder && selectedProject.memberOrder.length > 0) {
      const orderMap = new Map<string, number>()
      selectedProject.memberOrder.forEach((id, index) => {
        orderMap.set(id, index)
      })
      // memberOrder에 있는 구성원은 해당 순서로, 없는 구성원은 뒤로 (member.order 기준)
      return filtered.sort((a, b) => {
        const orderA = orderMap.has(a.id) ? orderMap.get(a.id)! : 10000 + (a.order || 0)
        const orderB = orderMap.has(b.id) ? orderMap.get(b.id)! : 10000 + (b.order || 0)
        return orderA - orderB
      })
    }

    // 프로젝트 선택 안됨 또는 memberOrder 없음: 기존 member.order 사용
    return filtered.sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [members, selectedProject, selectedJobTitle])

  // 숨긴 구성원 수
  const hiddenCount = members.filter((m) => m.isHidden).length

  // 통합 탭 + 구성원 탭
  const tabs = [
    { id: null, name: '통합', icon: <Users className="w-4 h-4" />, draggable: false, member: null },
    ...sortedMembers.map((m, index) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      draggable: true,
      memberIndex: index,
      member: m,
    })),
  ]

  // 드래그 시작
  const handleDragStart = (e: React.DragEvent, memberIndex: number) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', memberIndex.toString())
    setDraggedIndex(memberIndex)
  }

  // 드래그 오버 (드롭 허용) - 마우스 위치에 따라 삽입 위치 결정
  const handleDragOver = (e: React.DragEvent, memberIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    if (draggedIndex === null) return

    // 현재 요소의 중심점 기준으로 왼쪽/오른쪽 판단
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const isLeftHalf = e.clientX < centerX

    // 삽입 위치 계산
    let newInsertPosition: number
    if (isLeftHalf) {
      newInsertPosition = memberIndex  // 이 탭 앞에 삽입
    } else {
      newInsertPosition = memberIndex + 1  // 이 탭 뒤에 삽입
    }

    // 드래그 중인 요소와 같은 위치면 무시
    if (newInsertPosition === draggedIndex || newInsertPosition === draggedIndex + 1) {
      setInsertPosition(null)
      return
    }

    setInsertPosition(newInsertPosition)
  }

  // 드래그 리브
  const handleDragLeave = (e: React.DragEvent) => {
    // 자식 요소로 이동할 때는 무시
    const relatedTarget = e.relatedTarget as HTMLElement
    if (e.currentTarget.contains(relatedTarget)) return
    setInsertPosition(null)
  }

  // 컨테이너 드래그 리브 (탭 영역을 완전히 벗어날 때)
  const handleContainerDragLeave = (e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement
    if (e.currentTarget.contains(relatedTarget)) return
    setInsertPosition(null)
  }

  // 드롭
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()

    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'))
    const targetPosition = insertPosition

    setInsertPosition(null)
    setDraggedIndex(null)

    if (targetPosition === null || isNaN(sourceIndex)) return

    // 실제 삽입될 인덱스 계산
    let targetIndex = targetPosition
    if (sourceIndex < targetPosition) {
      targetIndex = targetPosition - 1  // 원본이 앞에 있으면 제거 후 인덱스 조정
    }

    if (sourceIndex === targetIndex) return

    // 순서 변경 (sortedMembers 기준)
    const newSortedMembers = [...sortedMembers]
    const [movedMember] = newSortedMembers.splice(sourceIndex, 1)
    newSortedMembers.splice(targetIndex, 0, movedMember)

    // 새 순서의 ID 배열
    const newMemberOrder = newSortedMembers.map(m => m.id)

    // 프로젝트가 선택된 경우: 프로젝트의 memberOrder만 업데이트
    if (selectedProject && workspaceId) {
      // 로컬 상태 업데이트
      updateProjectStore(selectedProject.id, { memberOrder: newMemberOrder })

      // Firebase 업데이트
      try {
        await updateProjectFirebase(workspaceId, selectedProject.id, { memberOrder: newMemberOrder })
      } catch (error) {
        console.error('프로젝트 구성원 순서 변경 실패:', error)
      }
      return
    }

    // 프로젝트 미선택: 기존 로직 (전역 member.order 업데이트)
    // 필터링된 구성원 ID Set
    const filteredMemberIds = new Set(sortedMembers.map(m => m.id))

    // 전체 members를 기존 order 기준으로 정렬
    const allMembersSorted = [...members].sort((a, b) => (a.order || 0) - (b.order || 0))

    // 전체 정렬 목록에서 필터링된 구성원들의 새 순서를 반영
    // 1. 필터링되지 않은 구성원들의 위치 유지
    // 2. 필터링된 구성원들을 새 순서대로 끼워넣기
    const finalSortedMembers: typeof members = []
    let filteredIndex = 0

    for (const member of allMembersSorted) {
      if (filteredMemberIds.has(member.id)) {
        // 필터링된 구성원은 새 순서의 구성원으로 대체
        finalSortedMembers.push(newSortedMembers[filteredIndex])
        filteredIndex++
      } else {
        // 필터링되지 않은 구성원은 그대로 유지
        finalSortedMembers.push(member)
      }
    }

    // 전체 members에 대해 0부터 순차적으로 order 재할당
    const updatedAllMembers = finalSortedMembers.map((member, index) => ({
      ...member,
      order: index,
    }))

    // 로컬 상태 업데이트 (전체 members)
    reorderMembers(updatedAllMembers)

    // Firebase 배치 업데이트 (전체 구성원의 order 업데이트)
    if (workspaceId) {
      try {
        const memberOrders = updatedAllMembers.map((member) => ({
          memberId: member.id,
          order: member.order,
        }))
        await batchReorderTeamMembers(workspaceId, memberOrders)
      } catch (error) {
        console.error('구성원 순서 변경 실패:', error)
      }
    }
  }

  // 드래그 종료
  const handleDragEnd = () => {
    setDraggedIndex(null)
    setInsertPosition(null)
  }

  // 삽입 인디케이터 컴포넌트
  const InsertIndicator = () => (
    <div className="flex items-center h-full py-1">
      <div className="w-0.5 h-8 bg-primary rounded-full animate-pulse" />
    </div>
  )

  return (
    <>
      <div className="bg-card border-b border-border px-6 overflow-x-auto scrollbar-thin">
        <div
          className="flex gap-1 py-2"
          onDragLeave={handleContainerDragLeave}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {tabs.map((tab) => {
            const isSelected = tab.id === selectedMemberId
            const isUnified = tab.id === null
            const memberIndex = 'memberIndex' in tab ? tab.memberIndex : -1
            const isDragging = draggedIndex === memberIndex
            // 이 탭 앞에 인디케이터 표시 여부 (구성원 탭만, 통합 탭은 제외)
            const showInsertBefore = !isUnified && insertPosition === memberIndex
            // 마지막 탭 뒤에 인디케이터 표시 (구성원 탭이 있고, 마지막 구성원 탭인 경우)
            const isLastMemberTab = memberIndex === sortedMembers.length - 1
            const showInsertAfter = isLastMemberTab && insertPosition === sortedMembers.length

            return (
              <div key={tab.id || 'unified'} className="flex items-center">
                {/* 이 탭 앞의 삽입 인디케이터 */}
                {showInsertBefore && <InsertIndicator />}

                <div
                  draggable={tab.draggable}
                  onDragStart={tab.draggable ? (e) => handleDragStart(e, memberIndex) : undefined}
                  onDragOver={tab.draggable ? (e) => handleDragOver(e, memberIndex) : undefined}
                  onDragLeave={tab.draggable ? handleDragLeave : undefined}
                  onDragEnd={tab.draggable ? handleDragEnd : undefined}
                  onContextMenu={tab.member ? (e) => handleContextMenu(e, tab.member) : undefined}
                  className={`
                    flex items-center transition-all
                    ${isDragging ? 'opacity-50' : ''}
                  `}
                >
                  <button
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
                </div>

                {/* 마지막 탭 뒤의 삽입 인디케이터 */}
                {showInsertAfter && <InsertIndicator />}
              </div>
            )
          })}

          {/* 빈 공간 (flex-1로 오른쪽으로 밀기) */}
          <div className="flex-1" />

          {/* 보관함 버튼 (숨긴 구성원이 있을 때만 표시, 오른쪽 끝) */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHiddenModal(true)}
              className="flex items-center gap-1 px-3 py-2 rounded-t-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="숨긴 구성원 보관함"
            >
              <Archive className="w-4 h-4" />
              <span className="text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded-full">
                {hiddenCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 우클릭 컨텍스트 메뉴 (숨김만) */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[100px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleHideClick}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
          >
            <EyeOff className="w-4 h-4" />
            숨김
          </button>
        </div>
      )}

      {/* 숨긴 구성원 보관함 모달 */}
      {showHiddenModal && (
        <HiddenMembersModal onClose={() => setShowHiddenModal(false)} />
      )}
    </>
  )
}
