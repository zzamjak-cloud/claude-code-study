import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Store } from '@tauri-apps/plugin-store'
import { useAppStore } from '../store/useAppStore'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [notionApiKeyInput, setNotionApiKeyInput] = useState('')
  const [notionDatabaseIdInput, setNotionDatabaseIdInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const { apiKey, notionApiKey, notionDatabaseId, setApiKey, setNotionApiKey, setNotionDatabaseId } = useAppStore()

  useEffect(() => {
    if (isOpen) {
      if (apiKey) setApiKeyInput(apiKey)
      if (notionApiKey) setNotionApiKeyInput(notionApiKey)
      if (notionDatabaseId) setNotionDatabaseIdInput(notionDatabaseId)
    }
  }, [isOpen, apiKey, notionApiKey, notionDatabaseId])

  const handleSave = async () => {
    if (!apiKeyInput.trim()) {
      alert('Gemini API Key를 입력해주세요')
      return
    }

    setIsSaving(true)
    try {
      const store = await Store.load('settings.json')
      await store.set('gemini_api_key', apiKeyInput.trim())

      if (notionApiKeyInput.trim()) {
        await store.set('notion_api_key', notionApiKeyInput.trim())
        setNotionApiKey(notionApiKeyInput.trim())
      }

      if (notionDatabaseIdInput.trim()) {
        await store.set('notion_database_id', notionDatabaseIdInput.trim())
        setNotionDatabaseId(notionDatabaseIdInput.trim())
      }

      await store.save()

      setApiKey(apiKeyInput.trim())
      alert('설정이 저장되었습니다')
      onClose()
    } catch (error) {
      console.error('설정 저장 실패:', error)
      alert('설정 저장에 실패했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">설정</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Gemini API Key */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Google Gemini API Key <span className="text-destructive">*</span>
            </label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="AIza..."
              className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google AI Studio
              </a>
              에서 무료 발급
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-border"></div>

          {/* Notion API Key */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Notion API Key (선택)
            </label>
            <input
              type="password"
              value={notionApiKeyInput}
              onChange={(e) => setNotionApiKeyInput(e.target.value)}
              placeholder="ntn_..."
              className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              노션 저장 기능 사용 시 필요
            </p>
          </div>

          {/* Notion Database ID */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Notion Database ID (선택)
            </label>
            <input
              type="text"
              value={notionDatabaseIdInput}
              onChange={(e) => setNotionDatabaseIdInput(e.target.value)}
              placeholder="2d7d040b425c8028a1a9f489c2e0657e"
              className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              기획서를 저장할 Notion 데이터베이스 ID
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md hover:bg-accent transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
