// 관리자 패널 (간단한 버전 - Phase 1 MVP)

import { useState } from 'react'
import { X, Plus, UserPlus } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { addTeamMember } from '../../lib/firebase/firestore'
import { COLOR_PRESETS } from '../../lib/constants/colors'

interface AdminPanelProps {
  onClose: () => void
}

export function AdminPanel({ onClose }: AdminPanelProps) {
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
      // 순서는 현재 팀원 수 + 1
      const order = members.length

      await addTeamMember(workspaceId, {
        name: name.trim(),
        role: role.trim() || '팀원',
        color: selectedColor,
        isHidden: false,
        order,
      })

      // 초기화
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
            <UserPlus className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">팀원 관리</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
              disabled={isSubmitting || !name.trim()}
              className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? '추가 중...' : (
                <>
                  <Plus className="w-4 h-4" />
                  팀원 추가
                </>
              )}
            </button>
          </div>
        </form>

        {/* 현재 팀원 목록 */}
        {members.length > 0 && (
          <div className="mt-6 pt-6 border-t border-border">
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
    </div>
  )
}
