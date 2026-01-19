// TipTap 기반 리치 텍스트 에디터
// - 마크다운 스타일 단축키 (#, ##, ### → 헤더)
// - Ctrl+K → 링크 추가
// - 리스트 기능 (-, 1.)
// - Bold (Ctrl+B), Italic (Ctrl+I)

import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useState, useCallback } from 'react'
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Heading1, Heading2, Heading3 } from 'lucide-react'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  maxHeight?: string
  showToolbar?: boolean
}

// 링크 입력 모달
function LinkModal({
  isOpen,
  onClose,
  onSubmit,
  initialUrl = '',
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (url: string) => void
  initialUrl?: string
}) {
  const [url, setUrl] = useState(initialUrl)

  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl)
    }
  }, [isOpen, initialUrl])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (url.trim()) {
      // URL에 프로토콜이 없으면 https:// 추가
      const finalUrl = url.match(/^https?:\/\//) ? url : `https://${url}`
      onSubmit(finalUrl)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300]" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-xl p-4 w-80" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-3">링크 추가</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-3"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 툴바 버튼 컴포넌트
function ToolbarButton({
  isActive,
  onClick,
  title,
  children,
}: {
  isActive?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive
          ? 'bg-primary/20 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  )
}

// 에디터 툴바
function EditorToolbar({ editor }: { editor: Editor }) {
  const [showLinkModal, setShowLinkModal] = useState(false)

  const handleAddLink = useCallback(() => {
    setShowLinkModal(true)
  }, [])

  const handleLinkSubmit = useCallback((url: string) => {
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    }
  }, [editor])

  return (
    <>
      <div className="flex items-center gap-0.5 p-1 border-b border-border bg-muted/30">
        <ToolbarButton
          isActive={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="제목 1 (# )"
        >
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          isActive={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="제목 2 (## )"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          isActive={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="제목 3 (### )"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolbarButton
          isActive={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="굵게 (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          isActive={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="기울임 (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolbarButton
          isActive={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="글머리 기호 (- )"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          isActive={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="번호 목록 (1. )"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolbarButton
          isActive={editor.isActive('link')}
          onClick={handleAddLink}
          title="링크 (Ctrl+K)"
        >
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <LinkModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onSubmit={handleLinkSubmit}
        initialUrl={editor.getAttributes('link').href || ''}
      />
    </>
  )
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = '내용을 입력하세요...',
  className = '',
  minHeight = '100px',
  maxHeight = '300px',
  showToolbar = true,
}: RichTextEditorProps) {
  const [showLinkModal, setShowLinkModal] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        HTMLAttributes: {
          class: 'text-primary underline hover:text-primary/80 cursor-pointer',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2 overflow-y-auto`,
        style: `min-height: ${minHeight}; max-height: ${maxHeight}`,
      },
      handleKeyDown: (_view, event) => {
        // Ctrl+K → 링크 추가
        if (event.key === 'k' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          setShowLinkModal(true)
          return true
        }
        return false
      },
    },
  })

  // 외부에서 content가 변경될 때 에디터 업데이트
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  const handleLinkSubmit = useCallback((url: string) => {
    if (editor) {
      if (url) {
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
      } else {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()
      }
    }
  }, [editor])

  if (!editor) {
    return null
  }

  return (
    <div className={`border border-border rounded-md bg-background overflow-hidden ${className}`}>
      {showToolbar && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />

      <LinkModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onSubmit={handleLinkSubmit}
        initialUrl={editor.getAttributes('link').href || ''}
      />
    </div>
  )
}

// 읽기 전용 렌더러 (HTML을 표시만 함)
export function RichTextViewer({
  content,
  className = '',
}: {
  content: string
  className?: string
}) {
  // 빈 콘텐츠 체크
  if (!content || content === '<p></p>') {
    return null
  }

  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
