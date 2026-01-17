// 숨긴 구성원 보관함 모달

import { X, Eye, Archive } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { updateTeamMember } from '../../lib/firebase/firestore'
import { TeamMember } from '../../types/team'

interface HiddenMembersModalProps {
  onClose: () => void
}

export function HiddenMembersModal({ onClose }: HiddenMembersModalProps) {
  const { members, workspaceId } = useAppStore()

  // 숨긴 구성원 목록
  const hiddenMembers = members.filter((m) => m.isHidden)

  // 복원 핸들러
  const handleRestore = async (member: TeamMember) => {
    if (!workspaceId) return

    try {
      await updateTeamMember(workspaceId, member.id, { isHidden: false })
    } catch (error) {
      console.error('구성원 복원 실패:', error)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">숨긴 구성원 보관함</h3>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 숨긴 구성원 목록 */}
          {hiddenMembers.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
              {hiddenMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  {/* 색상 표시 */}
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: member.color }}
                  />

                  {/* 이름 및 역할 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {member.name}
                    </p>
                    {member.role && (
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    )}
                  </div>

                  {/* 복원 버튼 */}
                  <button
                    onClick={() => handleRestore(member)}
                    className="p-2 rounded-md text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                    title="복원"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>숨긴 구성원이 없습니다.</p>
            </div>
          )}

          {/* 닫기 버튼 */}
          <div className="mt-6 pt-4 border-t border-border">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 rounded-md bg-muted hover:bg-accent text-foreground transition-colors font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
