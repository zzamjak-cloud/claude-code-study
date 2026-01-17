// 팀원 탭 컴포넌트 (드래그 순서 변경 + 우클릭 메뉴 지원)

import { useState, useEffect, useRef } from 'react'
import { Users, Edit, Trash2, EyeOff, Archive } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { updateTeamMember, deleteTeamMember } from '../../lib/firebase/firestore'
import { TeamMember } from '../../types/team'
import { TeamMemberEditModal } from '../modals/TeamMemberEditModal'
import { HiddenMembersModal } from '../modals/HiddenMembersModal'
import { ConfirmDialog } from '../common/ConfirmDialog'

export function TeamTabs() {
  const { members, selectedMemberId, selectMember, reorderMembers, workspaceId } = useAppStore()

  // 드래그 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // 우클릭 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    member: TeamMember
  } | null>(null)

  // 편집 모달 상태
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)

  // 삭제 확인 상태
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null)

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

  // 우클릭 핸들러
  const handleContextMenu = (e: React.MouseEvent, member: TeamMember) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      member,
    })
  }

  // 편집 클릭
  const handleEditClick = () => {
    if (contextMenu) {
      setEditingMember(contextMenu.member)
      setContextMenu(null)
    }
  }

  // 삭제 클릭
  const handleDeleteClick = () => {
    if (contextMenu) {
      setDeletingMember(contextMenu.member)
      setContextMenu(null)
    }
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
      console.error('팀원 숨김 실패:', error)
    } finally {
      setContextMenu(null)
    }
  }

  // 삭제 확인
  const handleDeleteConfirm = async () => {
    if (!deletingMember || !workspaceId) return

    try {
      await deleteTeamMember(workspaceId, deletingMember.id)
      // 현재 선택된 탭이 삭제된 경우 통합 탭으로 이동
      if (selectedMemberId === deletingMember.id) {
        selectMember(null)
      }
    } catch (error) {
      console.error('팀원 삭제 실패:', error)
    } finally {
      setDeletingMember(null)
    }
  }

  // order 기준으로 정렬된 팀원 목록 (숨긴 팀원 제외)
  const sortedMembers = [...members]
    .filter((m) => !m.isHidden)
    .sort((a, b) => (a.order || 0) - (b.order || 0))

  // 숨긴 팀원 수
  const hiddenCount = members.filter((m) => m.isHidden).length

  // 통합 탭 + 팀원 탭
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

  // 드래그 오버 (드롭 허용)
  const handleDragOver = (e: React.DragEvent, memberIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (memberIndex !== draggedIndex) {
      setDragOverIndex(memberIndex)
    }
  }

  // 드래그 리브
  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  // 드롭
  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    setDragOverIndex(null)
    setDraggedIndex(null)

    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'))
    if (sourceIndex === targetIndex || isNaN(sourceIndex)) return

    // 순서 변경
    const newMembers = [...sortedMembers]
    const [movedMember] = newMembers.splice(sourceIndex, 1)
    newMembers.splice(targetIndex, 0, movedMember)

    // 새 order 값 할당
    const updatedMembers = newMembers.map((member, index) => ({
      ...member,
      order: index,
    }))

    // 로컬 상태 업데이트
    reorderMembers(updatedMembers)

    // Firebase 업데이트
    if (workspaceId) {
      try {
        for (const member of updatedMembers) {
          await updateTeamMember(workspaceId, member.id, { order: member.order })
        }
      } catch (error) {
        console.error('팀원 순서 변경 실패:', error)
      }
    }
  }

  // 드래그 종료
  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <>
      <div className="bg-card border-b border-border px-6 overflow-x-auto scrollbar-thin">
        <div className="flex gap-2 py-2">
          {/* 보관함 버튼 (숨긴 팀원이 있을 때만 표시) */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHiddenModal(true)}
              className="flex items-center gap-1 px-3 py-2 rounded-t-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="숨긴 팀원 보관함"
            >
              <Archive className="w-4 h-4" />
              <span className="text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded-full">
                {hiddenCount}
              </span>
            </button>
          )}
          {tabs.map((tab) => {
            const isSelected = tab.id === selectedMemberId
            const isUnified = tab.id === null
            const memberIndex = 'memberIndex' in tab ? tab.memberIndex : -1
            const isDragging = draggedIndex === memberIndex
            const isDragOver = dragOverIndex === memberIndex

            return (
              <div
                key={tab.id || 'unified'}
                draggable={tab.draggable}
                onDragStart={tab.draggable ? (e) => handleDragStart(e, memberIndex) : undefined}
                onDragOver={tab.draggable ? (e) => handleDragOver(e, memberIndex) : undefined}
                onDragLeave={tab.draggable ? handleDragLeave : undefined}
                onDrop={tab.draggable ? (e) => handleDrop(e, memberIndex) : undefined}
                onDragEnd={tab.draggable ? handleDragEnd : undefined}
                onContextMenu={tab.member ? (e) => handleContextMenu(e, tab.member) : undefined}
                className={`
                  flex items-center transition-all
                  ${isDragging ? 'opacity-50' : ''}
                  ${isDragOver ? 'ring-2 ring-primary ring-offset-2 rounded-md' : ''}
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
            )
          })}
        </div>
      </div>

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleEditClick}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
          >
            <Edit className="w-4 h-4" />
            편집
          </button>
          <button
            onClick={handleHideClick}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
          >
            <EyeOff className="w-4 h-4" />
            숨김
          </button>
          <button
            onClick={handleDeleteClick}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-accent transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            삭제
          </button>
        </div>
      )}

      {/* 팀원 편집 모달 */}
      {editingMember && (
        <TeamMemberEditModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
        />
      )}

      {/* 삭제 확인 다이얼로그 */}
      {deletingMember && (
        <ConfirmDialog
          title="팀원 삭제"
          message={`"${deletingMember.name}" 팀원을 삭제하시겠습니까? 해당 팀원의 모든 일정도 함께 삭제됩니다.`}
          confirmText="삭제"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingMember(null)}
          isDestructive
        />
      )}

      {/* 숨긴 팀원 보관함 모달 */}
      {showHiddenModal && (
        <HiddenMembersModal onClose={() => setShowHiddenModal(false)} />
      )}
    </>
  )
}
