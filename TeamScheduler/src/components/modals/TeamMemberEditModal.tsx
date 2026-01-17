// 팀원 정보 편집 모달

import { useState } from 'react'
import { X, Save, User } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { updateTeamMember } from '../../lib/firebase/firestore'
import { TeamMember } from '../../types/team'
import { COLOR_PRESETS } from '../../lib/constants/colors'

interface TeamMemberEditModalProps {
  member: TeamMember
  onClose: () => void
}

export function TeamMemberEditModal({ member, onClose }: TeamMemberEditModalProps) {
  const { workspaceId } = useAppStore()
  const [name, setName] = useState(member.name)
  const [role, setRole] = useState(member.role || '')
  const [selectedColor, setSelectedColor] = useState(member.color)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!workspaceId || !name.trim()) {
      return
    }

    setIsSubmitting(true)

    try {
      await updateTeamMember(workspaceId, member.id, {
        name: name.trim(),
        role: role.trim() || '팀원',
        color: selectedColor,
      })

      onClose()
    } catch (error) {
      console.error('팀원 정보 수정 실패:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 변경사항 있는지 확인
  const hasChanges =
    name.trim() !== member.name ||
    (role.trim() || '팀원') !== (member.role || '팀원') ||
    selectedColor !== member.color

  return (
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
            <User className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">팀원 정보 편집</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 편집 폼 */}
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
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-md bg-muted hover:bg-accent text-foreground transition-colors font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || !hasChanges}
              className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? '저장 중...' : (
                <>
                  <Save className="w-4 h-4" />
                  저장
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
