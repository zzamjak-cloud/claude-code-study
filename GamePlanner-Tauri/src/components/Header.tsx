import { Settings, Download } from 'lucide-react'

interface HeaderProps {
  onSettingsClick: () => void
  onDownloadClick: () => void
}

export function Header({ onSettingsClick, onDownloadClick }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-background px-4 flex items-center justify-between">
      <h1 className="text-xl font-bold">GamePlanner AI</h1>
      <div className="flex gap-2">
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-md hover:bg-accent transition-colors"
          title="설정"
        >
          <Settings className="w-5 h-5" />
        </button>
        <button
          onClick={onDownloadClick}
          className="p-2 rounded-md hover:bg-accent transition-colors"
          title="저장"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
