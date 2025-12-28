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
  const [isSaving, setIsSaving] = useState(false)
  const { apiKey, setApiKey } = useAppStore()

  useEffect(() => {
    if (isOpen && apiKey) {
      setApiKeyInput(apiKey)
    }
  }, [isOpen, apiKey])

  const handleSave = async () => {
    if (!apiKeyInput.trim()) {
      alert('API Key를 입력해주세요')
      return
    }

    setIsSaving(true)
    try {
      const store = await Store.load('settings.json')
      await store.set('gemini_api_key', apiKeyInput.trim())
      await store.save()

      setApiKey(apiKeyInput.trim())
      alert('API Key가 저장되었습니다')
      onClose()
    } catch (error) {
      console.error('API Key 저장 실패:', error)
      alert('API Key 저장에 실패했습니다')
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
          <div>
            <label className="block text-sm font-medium mb-2">
              Google Gemini API Key
            </label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="AIza..."
              className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              API Key는 로컬에 안전하게 저장됩니다
            </p>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Google AI Studio에서 무료 API Key를 발급받을 수 있습니다:</p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              https://aistudio.google.com/app/apikey
            </a>
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
