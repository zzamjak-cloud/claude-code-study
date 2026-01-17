// 공지사항 컴포넌트 (하단 고정 패널용)

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Megaphone } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { updateAnnouncement } from '../../lib/firebase/firestore'

export function Announcement() {
  const { announcements, isAdmin, workspaceId, currentUser, selectedProjectId, projects, members } = useAppStore()
  const [isSaving, setIsSaving] = useState(false)

  // 현재 선택된 프로젝트
  const currentProject = useMemo(() => {
    if (!selectedProjectId) return null
    return projects.find(p => p.id === selectedProjectId) || null
  }, [projects, selectedProjectId])

  // 현재 사용자가 이 프로젝트의 구성원인지 확인
  const isProjectMember = useMemo(() => {
    if (!currentProject || !currentUser) return false
    // 현재 사용자의 이메일과 일치하는 팀원 찾기
    const userMember = members.find(m => m.email === currentUser.email)
    if (!userMember) return false
    // 프로젝트 구성원 목록에 포함되어 있는지 확인
    return currentProject.memberIds?.includes(userMember.id) || false
  }, [currentProject, currentUser, members])

  // 편집 가능 여부: 관리자이거나 프로젝트 구성원인 경우
  const canEdit = isAdmin || isProjectMember

  // 현재 선택된 프로젝트의 공지사항
  const currentAnnouncement = useMemo(() => {
    if (!selectedProjectId) return null
    return announcements.find(a => a.projectId === selectedProjectId) || null
  }, [announcements, selectedProjectId])

  const [editContent, setEditContent] = useState(currentAnnouncement?.content || '')

  // 공지사항 변경 시 동기화
  useEffect(() => {
    setEditContent(currentAnnouncement?.content || '')
  }, [currentAnnouncement?.content, selectedProjectId])

  // Debounce 저장 (편집 가능한 사용자만)
  const saveAnnouncement = useCallback(
    async (content: string) => {
      if (!workspaceId || !currentUser || !canEdit || !selectedProjectId) return

      setIsSaving(true)
      try {
        await updateAnnouncement(workspaceId, selectedProjectId, content, currentUser.uid)
      } catch (error) {
        console.error('공지사항 저장 실패:', error)
      } finally {
        setIsSaving(false)
      }
    },
    [workspaceId, currentUser, canEdit, selectedProjectId]
  )

  // Debounce 처리 (편집 가능한 사용자만)
  useEffect(() => {
    if (!canEdit || !selectedProjectId) return
    if (editContent === (currentAnnouncement?.content || '')) return

    const timer = setTimeout(() => {
      saveAnnouncement(editContent)
    }, 1000)

    return () => clearTimeout(timer)
  }, [editContent, saveAnnouncement, currentAnnouncement?.content, canEdit, selectedProjectId])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border-b border-border flex-shrink-0">
        <Megaphone className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">
          {currentProject ? `(${currentProject.name}) 공지사항` : '공지사항'}
        </span>
        {isSaving && (
          <span className="text-xs text-muted-foreground">저장 중...</span>
        )}
      </div>

      {/* 내용 */}
      <div className="flex-1 p-3 overflow-hidden">
        {canEdit ? (
          // 편집 가능한 사용자: 관리자 또는 프로젝트 구성원
          <div className="h-full flex flex-col">
            <textarea
              value={editContent}
              onChange={handleChange}
              placeholder="구성원들에게 전달할 공지사항을 입력하세요..."
              className="flex-1 w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              maxLength={500}
            />
            <div className="flex justify-end mt-1 flex-shrink-0">
              <span className="text-xs text-muted-foreground">
                {editContent.length} / 500
              </span>
            </div>
          </div>
        ) : (
          // 일반 사용자: 읽기 전용
          <div className="text-sm text-foreground whitespace-pre-wrap overflow-auto h-full">
            {currentAnnouncement?.content || '공지사항이 없습니다.'}
          </div>
        )}
      </div>
    </div>
  )
}
