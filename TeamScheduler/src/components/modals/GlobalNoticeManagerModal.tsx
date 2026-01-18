// 글로벌 공지 관리 모달

import { useState } from 'react'
import { X, Plus, Trash2, ChevronUp, ChevronDown, Save, Pencil } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import {
  createGlobalNotice,
  updateGlobalNotice,
  deleteGlobalNotice,
} from '../../lib/firebase/firestore'
import { GlobalNotice } from '../../types/globalNotice'

interface GlobalNoticeManagerModalProps {
  onClose: () => void
}

export function GlobalNoticeManagerModal({ onClose }: GlobalNoticeManagerModalProps) {
  const { globalNotices, workspaceId, currentUser } = useAppStore()
  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // 공지 추가
  const handleAdd = async () => {
    if (!newContent.trim() || !workspaceId || !currentUser) return

    setIsSubmitting(true)
    try {
      await createGlobalNotice(workspaceId, {
        content: newContent.trim(),
        order: globalNotices.length,
        isActive: true,
        createdBy: currentUser.uid,
      })
      setNewContent('')
    } catch (error) {
      console.error('공지 추가 실패:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 공지 수정
  const handleEdit = async (notice: GlobalNotice) => {
    if (!editContent.trim() || !workspaceId) return

    setIsSubmitting(true)
    try {
      await updateGlobalNotice(workspaceId, notice.id, {
        content: editContent.trim(),
      })
      setEditingId(null)
      setEditContent('')
    } catch (error) {
      console.error('공지 수정 실패:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 공지 삭제
  const handleDelete = async () => {
    if (!deleteConfirm || !workspaceId) return

    try {
      await deleteGlobalNotice(workspaceId, deleteConfirm)
      setDeleteConfirm(null)
    } catch (error) {
      console.error('공지 삭제 실패:', error)
    }
  }

  // 순서 변경 (위로)
  const handleMoveUp = async (index: number) => {
    if (index === 0 || !workspaceId) return

    const current = globalNotices[index]
    const prev = globalNotices[index - 1]

    await Promise.all([
      updateGlobalNotice(workspaceId, current.id, { order: prev.order }),
      updateGlobalNotice(workspaceId, prev.id, { order: current.order }),
    ])
  }

  // 순서 변경 (아래로)
  const handleMoveDown = async (index: number) => {
    if (index === globalNotices.length - 1 || !workspaceId) return

    const current = globalNotices[index]
    const next = globalNotices[index + 1]

    await Promise.all([
      updateGlobalNotice(workspaceId, current.id, { order: next.order }),
      updateGlobalNotice(workspaceId, next.id, { order: current.order }),
    ])
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">글로벌 공지 관리</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 새 공지 입력 */}
        <div className="p-4 border-b border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="새 공지 내용 입력..."
              className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  handleAdd()
                }
              }}
            />
            <button
              onClick={handleAdd}
              disabled={!newContent.trim() || isSubmitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              추가
            </button>
          </div>
        </div>

        {/* 공지 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          {globalNotices.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              등록된 공지가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {globalNotices.map((notice, index) => (
                <div
                  key={notice.id}
                  className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg group"
                >
                  {/* 내용 */}
                  {editingId === notice.id ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                            handleEdit(notice)
                          } else if (e.key === 'Escape') {
                            setEditingId(null)
                          }
                        }}
                      />
                      <button
                        onClick={() => handleEdit(notice)}
                        disabled={isSubmitting}
                        className="p-1 text-primary hover:bg-primary/10 rounded"
                        title="저장"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">
                        {notice.content}
                      </span>

                      {/* 버튼 그룹 (오른쪽 정렬, 호버 시 표시) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* 위로 */}
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="위로 이동"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        {/* 아래로 */}
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === globalNotices.length - 1}
                          className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="아래로 이동"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        {/* 편집 */}
                        <button
                          onClick={() => {
                            setEditingId(notice.id)
                            setEditContent(notice.content)
                          }}
                          className="p-1 text-muted-foreground hover:text-primary hover:bg-accent rounded"
                          title="편집"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {/* 삭제 */}
                        <button
                          onClick={() => setDeleteConfirm(notice.id)}
                          className="p-1 text-muted-foreground hover:text-destructive hover:bg-accent rounded"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 안내 */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            공지는 10초마다 자동으로 순환하며 모든 프로젝트에서 표시됩니다.
          </p>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-card border border-border rounded-lg shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2">공지 삭제</h3>
            <p className="text-muted-foreground mb-6">
              이 공지를 삭제하시겠습니까?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-accent transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GlobalNoticeManagerModal
