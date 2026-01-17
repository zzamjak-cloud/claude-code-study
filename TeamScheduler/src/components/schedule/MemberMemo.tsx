// 구성원별 메모 컴포넌트 (하단 고정 패널용)

import { useState, useEffect, useCallback } from 'react'
import { StickyNote } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { updateTeamMember } from '../../lib/firebase/firestore'

interface MemberMemoProps {
  memberId: string
}

export function MemberMemo({ memberId }: MemberMemoProps) {
  const { members, workspaceId } = useAppStore()
  const member = members.find((m) => m.id === memberId)

  const [memo, setMemo] = useState(member?.memo || '')
  const [isSaving, setIsSaving] = useState(false)

  // 멤버 변경 시 메모 동기화
  useEffect(() => {
    setMemo(member?.memo || '')
  }, [member?.memo])

  // Debounce 저장 (1초 후 자동 저장)
  const saveMemo = useCallback(
    async (value: string) => {
      if (!workspaceId || !memberId) return

      setIsSaving(true)
      try {
        await updateTeamMember(workspaceId, memberId, { memo: value })
      } catch (error) {
        console.error('메모 저장 실패:', error)
      } finally {
        setIsSaving(false)
      }
    },
    [workspaceId, memberId]
  )

  // Debounce 처리
  useEffect(() => {
    // 초기 로드 시에는 저장하지 않음
    if (memo === (member?.memo || '')) return

    const timer = setTimeout(() => {
      saveMemo(memo)
    }, 1000)

    return () => clearTimeout(timer)
  }, [memo, saveMemo, member?.memo])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMemo(e.target.value)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-border flex-shrink-0">
        <StickyNote className="w-4 h-4 text-amber-600" />
        <span className="text-sm font-medium text-foreground">
          {member?.name || '구성원'}님의 메모
        </span>
        {isSaving && (
          <span className="text-xs text-muted-foreground">저장 중...</span>
        )}
      </div>

      {/* 내용 */}
      <div className="flex-1 p-3 overflow-hidden">
        <div className="h-full flex flex-col">
          <textarea
            value={memo}
            onChange={handleChange}
            placeholder="향후 일정 후보나 메모를 입력하세요..."
            className="flex-1 w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
            maxLength={1000}
          />
          <div className="flex justify-end mt-1 flex-shrink-0">
            <span className="text-xs text-muted-foreground">
              {memo.length} / 1000
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
