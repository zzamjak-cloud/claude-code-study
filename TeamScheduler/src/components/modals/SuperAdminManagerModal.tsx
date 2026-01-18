// 최고 관리자 관리 모달

import { useState } from 'react'
import { X, Plus, Trash2, Shield, Crown } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { addSuperAdmin, deleteSuperAdmin } from '../../lib/firebase/firestore'

interface SuperAdminManagerModalProps {
  onClose: () => void
}

// 최초 관리자 이메일 (환경 변수에서 첫 번째 이메일)
const PRIMARY_ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')[0]
  ?.trim()
  .toLowerCase() || ''

export default function SuperAdminManagerModal({ onClose }: SuperAdminManagerModalProps) {
  const { workspaceId, currentUser, superAdmins } = useAppStore()

  // 입력 상태
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')

  // 삭제 확인 상태
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // 최고 관리자 추가
  const handleAdd = async () => {
    if (!workspaceId || !currentUser) return

    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()

    // 유효성 검사
    if (!trimmedName) {
      setError('이름을 입력해주세요.')
      return
    }
    if (!trimmedEmail) {
      setError('이메일을 입력해주세요.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('올바른 이메일 형식이 아닙니다.')
      return
    }

    // 중복 확인
    if (superAdmins.some(a => a.email.toLowerCase() === trimmedEmail)) {
      setError('이미 등록된 이메일입니다.')
      return
    }

    setIsAdding(true)
    setError('')

    try {
      await addSuperAdmin(workspaceId, { name: trimmedName, email: trimmedEmail }, currentUser.uid)
      setName('')
      setEmail('')
    } catch (err) {
      console.error('최고 관리자 추가 실패:', err)
      setError('추가 중 오류가 발생했습니다.')
    } finally {
      setIsAdding(false)
    }
  }

  // 최고 관리자 삭제
  const handleDelete = async (adminId: string) => {
    if (!workspaceId) return

    try {
      await deleteSuperAdmin(workspaceId, adminId)
      setDeleteConfirm(null)
    } catch (err) {
      console.error('최고 관리자 삭제 실패:', err)
    }
  }

  // 알파벳 순 정렬된 관리자 목록
  const sortedAdmins = [...superAdmins].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">최고 관리자 관리</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 안내 문구 */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            <p>최고 관리자는 모든 권한을 가지며, 다른 관리자를 추가/삭제할 수 있습니다.</p>
            <p className="mt-1 flex items-center gap-1">
              <Crown className="w-4 h-4 text-yellow-500" />
              <span>표시가 있는 최초 관리자는 삭제할 수 없습니다.</span>
            </p>
          </div>

          {/* 관리자 추가 폼 */}
          <div className="space-y-3">
            <h3 className="font-medium">관리자 추가</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="email"
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-[2] px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <button
                onClick={handleAdd}
                disabled={isAdding}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {/* 관리자 목록 */}
          <div className="space-y-2">
            <h3 className="font-medium">등록된 최고 관리자 ({sortedAdmins.length}명)</h3>
            <div className="space-y-2">
              {sortedAdmins.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  등록된 최고 관리자가 없습니다.
                </p>
              ) : (
                sortedAdmins.map((admin) => {
                  const isPrimary = admin.isPrimary || admin.email.toLowerCase() === PRIMARY_ADMIN_EMAIL
                  return (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {isPrimary ? (
                          <Crown className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <Shield className="w-5 h-5 text-primary" />
                        )}
                        <div>
                          <p className="font-medium">{admin.name}</p>
                          <p className="text-sm text-muted-foreground">{admin.email}</p>
                        </div>
                      </div>
                      {!isPrimary && (
                        <button
                          onClick={() => setDeleteConfirm(admin.id)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-accent transition-colors font-medium"
          >
            닫기
          </button>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold mb-2">삭제 확인</h3>
            <p className="text-muted-foreground mb-6">
              이 최고 관리자를 삭제하시겠습니까?<br />
              삭제된 관리자는 더 이상 관리 권한을 가지지 않습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-accent transition-colors font-medium"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium"
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
