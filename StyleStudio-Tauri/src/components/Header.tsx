import { Settings } from 'lucide-react';

interface HeaderProps {
  onSettingsClick: () => void;
}

export function Header({ onSettingsClick }: HeaderProps) {
  return (
    <header className="h-14 bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-between px-6 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
          <span className="text-xl">🎨</span>
        </div>
        <h1 className="text-white text-xl font-bold">Style Studio</h1>
      </div>

      <button
        onClick={onSettingsClick}
        className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
        title="설정"
      >
        <Settings size={20} />
      </button>
    </header>
  );
}
