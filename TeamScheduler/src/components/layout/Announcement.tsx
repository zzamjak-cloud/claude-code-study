// 공지사항 컴포넌트 (하단 고정 패널용)

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Megaphone } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { updateAnnouncement } from '../../lib/firebase/firestore'

export function Announcement() {
  const { announcements, isAdmin, workspaceId, currentUser, selectedProjectId } = useAppStore()
  const [isSaving, setIsSaving] = useState(false)

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

  // Debounce 저장 (관리자만)
  const saveAnnouncement = useCallback(
    async (content: string) => {
      if (!workspaceId || !currentUser || !isAdmin || !selectedProjectId) return

      setIsSaving(true)
      try {
        await updateAnnouncement(workspaceId, selectedProjectId, content, currentUser.uid)
      } catch (error) {
        console.error('공지사항 저장 실패:', error)
      } finally {
        setIsSaving(false)
      }
    },
    [workspaceId, currentUser, isAdmin, selectedProjectId]
  )

  // Debounce 처리 (관리자만)
  useEffect(() => {
    if (!isAdmin || !selectedProjectId) return
    if (editContent === (currentAnnouncement?.content || '')) return

    const timer = setTimeout(() => {
      saveAnnouncement(editContent)
    }, 1000)

    return () => clearTimeout(timer)
  }, [editContent, saveAnnouncement, currentAnnouncement?.content, isAdmin, selectedProjectId])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border-b border-border flex-shrink-0">
        <Megaphone className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">공지사항</span>
        {isSaving && (
          <span className="text-xs text-muted-foreground">저장 중...</span>
        )}
      </div>

      {/* 내용 */}
      <div className="flex-1 p-3 overflow-hidden">
        {isAdmin ? (
          // 관리자: 편집 가능
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
