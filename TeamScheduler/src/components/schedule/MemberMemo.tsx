// 구성원별 메모 컴포넌트 (하단 고정 패널용)
// TipTap 에디터 적용 - 링크, 헤더, 리스트, 볼드/이탤릭 지원

import { useState, useEffect, useCallback, useRef } from 'react'
import { StickyNote, Save } from 'lucide-react'
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
  const isEditingLocally = useRef(false)  // 로컬 편집 중 플래그

  // 멤버 변경 시 메모 동기화 (로컬 편집 중이 아닐 때만)
  useEffect(() => {
    const newMemo = member?.memo || ''

    // 로컬 편집 중이거나 저장 중이면 동기화 건너뛰기
    if (isEditingLocally.current || isSaving) {
      return
    }

    // 실제로 서버에서 변경된 경우에만 동기화
    if (newMemo !== lastSavedMemo.current) {
      setMemo(newMemo)
      lastSavedMemo.current = newMemo
    }
  }, [member?.memo, isSaving])

  // memberId 변경 시 초기화
  useEffect(() => {
    const newMemo = member?.memo || ''
    setMemo(newMemo)
    lastSavedMemo.current = newMemo
    isEditingLocally.current = false
  }, [memberId])

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
        // 저장 완료 후 잠시 후에 편집 플래그 해제
        setTimeout(() => {
          isEditingLocally.current = false
        }, 500)
      }
    },
    [workspaceId, memberId]
  )

  // Debounce 처리
  useEffect(() => {
    // 초기 로드 시에는 저장하지 않음
    if (memo === lastSavedMemo.current) {
      isEditingLocally.current = false
      return
    }

    const timer = setTimeout(() => {
      saveMemo(memo)
    }, 1000)

    return () => clearTimeout(timer)
  }, [memo, saveMemo])

  const handleChange = (content: string) => {
    // 편집 시작 플래그 설정
    isEditingLocally.current = true
    setMemo(content)
  }

  // 저장되지 않은 변경사항 여부
  const hasUnsavedChanges = memo !== lastSavedMemo.current

  // 수동 저장 핸들러
  const handleManualSave = useCallback(() => {
    if (!hasUnsavedChanges || isSaving) return
    saveMemo(memo)
  }, [hasUnsavedChanges, isSaving, saveMemo, memo])

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-border flex-shrink-0">
        <StickyNote className="w-4 h-4 text-amber-600" />
        <span className="text-sm font-medium text-foreground flex-1">
          {member?.name || '구성원'}님의 메모
        </span>
        {/* 저장 상태 표시 및 저장 버튼 */}
        <div className="flex items-center gap-2">
          {isSaving ? (
            <span className="text-xs text-muted-foreground">저장 중...</span>
          ) : hasUnsavedChanges ? (
            <button
              onClick={handleManualSave}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
              title="저장 (자동 저장도 1초 후 작동)"
            >
              <Save className="w-3 h-3" />
              저장
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">저장됨</span>
          )}
        </div>
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
