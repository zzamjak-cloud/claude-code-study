// 구성원별 메모 컴포넌트 (하단 고정 패널용)
// TipTap 에디터 적용 - 링크, 헤더, 리스트, 볼드/이탤릭 지원

import { useState, useEffect, useCallback, useRef } from 'react'
import { StickyNote } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { updateTeamMember } from '../../lib/firebase/firestore'
import { RichTextEditor } from '../common/RichTextEditor'

interface MemberMemoProps {
  memberId: string
}

export function MemberMemo({ memberId }: MemberMemoProps) {
  const { members, workspaceId } = useAppStore()
  const member = members.find((m) => m.id === memberId)

  const [memo, setMemo] = useState(member?.memo || '')
  const [isSaving, setIsSaving] = useState(false)
  const lastSavedMemo = useRef(member?.memo || '')

  // 멤버 변경 시 메모 동기화
  useEffect(() => {
    const newMemo = member?.memo || ''
    setMemo(newMemo)
    lastSavedMemo.current = newMemo
  }, [member?.memo])

  // Debounce 저장 (1초 후 자동 저장)
  const saveMemo = useCallback(
    async (value: string) => {
      if (!workspaceId || !memberId) return

      setIsSaving(true)
      try {
        await updateTeamMember(workspaceId, memberId, { memo: value })
        lastSavedMemo.current = value
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
    if (memo === lastSavedMemo.current) return

    const timer = setTimeout(() => {
      saveMemo(memo)
    }, 1000)

    return () => clearTimeout(timer)
  }, [memo, saveMemo])

  const handleChange = (content: string) => {
    setMemo(content)
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
        <RichTextEditor
          content={memo}
          onChange={handleChange}
          placeholder="향후 일정 후보나 메모를 입력하세요... (Ctrl+K: 링크, #: 제목)"
          minHeight="calc(100% - 8px)"
          maxHeight="100%"
          className="h-full"
          showToolbar={false}
        />
      </div>
    </div>
  )
}
