// 확인 다이얼로그 컴포넌트 (CLAUDE.md 패턴 준수 - window.confirm 대신 커스텀 다이얼로그)

import { X } from 'lucide-react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  inputPlaceholder?: string
  inputValue?: string
  onInputChange?: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  inputPlaceholder,
  inputValue,
  onInputChange,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 메시지 */}
        <p className="text-muted-foreground mb-6 whitespace-pre-line">
          {message}
        </p>

        {/* 입력 필드 (옵션) */}
        {inputPlaceholder && onInputChange && (
          <input
            type="text"
            placeholder={inputPlaceholder}
            value={inputValue || ''}
            onChange={(e) => onInputChange(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground mb-6 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}

        {/* 버튼 */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md bg-muted hover:bg-accent text-foreground transition-colors font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
