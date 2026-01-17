// 일정 카드 편집 팝업

import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'

interface ScheduleEditPopupProps {
  title: string
  comment?: string
  link?: string
  position: { x: number; y: number }
  onSave: (title: string, comment: string, link: string) => void
  onCancel: () => void
}

export function ScheduleEditPopup({
  title,
  comment = '',
  link = '',
  position,
  onSave,
  onCancel,
}: ScheduleEditPopupProps) {
  const [titleValue, setTitleValue] = useState(title)
  const [commentValue, setCommentValue] = useState(comment)
  const [linkValue, setLinkValue] = useState(link)

  const titleRef = useRef<HTMLInputElement>(null)
  const commentRef = useRef<HTMLInputElement>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // 포커스 및 선택
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.focus()
      titleRef.current.select()
    }
  }, [])

  // 외부 클릭 시 저장
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        handleSave()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [titleValue, commentValue, linkValue])

  // Enter 키로 저장, Escape 키로 취소
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Tab') {
      // 탭 키로 다음 필드로 이동
      e.preventDefault()
      if (e.currentTarget === titleRef.current) {
        commentRef.current?.focus()
      } else if (e.currentTarget === commentRef.current) {
        linkRef.current?.focus()
      } else if (e.currentTarget === linkRef.current) {
        titleRef.current?.focus()
      }
    }
  }

  const handleSave = () => {
    onSave(titleValue, commentValue, linkValue)
  }

  return (
    <div
      ref={popupRef}
      className="fixed bg-card border-2 border-primary rounded-lg shadow-xl p-4 z-[200] min-w-[300px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">일정 편집</h3>
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 일정 제목 */}
      <div className="mb-2">
        <label className="block text-xs text-muted-foreground mb-1">일정</label>
        <input
          ref={titleRef}
          type="text"
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="일정 제목"
          className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* 코멘트 */}
      <div className="mb-2">
        <label className="block text-xs text-muted-foreground mb-1">코멘트</label>
        <input
          ref={commentRef}
          type="text"
          value={commentValue}
          onChange={(e) => setCommentValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="추가 설명"
          className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* 링크 */}
      <div className="mb-3">
        <label className="block text-xs text-muted-foreground mb-1">링크</label>
        <input
          ref={linkRef}
          type="text"
          value={linkValue}
          onChange={(e) => setLinkValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://..."
          className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* 버튼 */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded bg-muted hover:bg-accent text-foreground transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-sm rounded bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
        >
          저장
        </button>
      </div>
    </div>
  )
}
