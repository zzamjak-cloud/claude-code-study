import { useState, useEffect } from 'react';
import { X, Key, FolderOpen, Trash2 } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { loadDefaultSessionSavePath, saveDefaultSessionSavePath } from '../../lib/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string;
  onSave: (apiKey: string) => void;
}

export function SettingsModal({ isOpen, onClose, currentApiKey, onSave }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(currentApiKey);
  const [defaultSavePath, setDefaultSavePath] = useState<string | null>(null);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(currentApiKey);
  }, [currentApiKey]);

  // 설정 모달이 열릴 때 기본 저장 폴더 로드
  useEffect(() => {
    if (isOpen) {
      loadDefaultSessionSavePath().then(setDefaultSavePath);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (apiKey.trim()) {
      onSave(apiKey.trim());
      // 기본 저장 폴더도 저장
      await saveDefaultSessionSavePath(defaultSavePath);
      setSaveNotification('설정이 저장되었습니다');
      setTimeout(() => {
        setSaveNotification(null);
        onClose();
      }, 1500);
    } else {
      alert('API Key를 입력해주세요');
    }
  };

  // 폴더 선택 다이얼로그
  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '세션 저장 폴더 선택',
      });

      if (selected && typeof selected === 'string') {
        setDefaultSavePath(selected);
      }
    } catch (error) {
      console.error('폴더 선택 오류:', error);
    }
  };

  // 폴더 경로 초기화
  const handleClearFolder = () => {
    setDefaultSavePath(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Key size={20} className="text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">설정</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 space-y-6">
          {/* API Key 설정 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Gemini API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-2">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline"
              >
                Google AI Studio
              </a>
              에서 API 키를 발급받을 수 있습니다.
            </p>
          </div>

          {/* 세션 저장 폴더 설정 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              기본 세션 저장 폴더
            </label>
            <div className="flex gap-2">
              <div className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-600 truncate">
                {defaultSavePath || '설정되지 않음'}
              </div>
              <button
                onClick={handleSelectFolder}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="폴더 선택"
              >
                <FolderOpen size={20} className="text-gray-600" />
              </button>
              {defaultSavePath && (
                <button
                  onClick={handleClearFolder}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  title="초기화"
                >
                  <Trash2 size={20} className="text-red-500" />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              세션 export 시 기본으로 사용할 폴더를 설정합니다.
            </p>
          </div>
        </div>

        {/* 저장 알림 */}
        {saveNotification && (
          <div className="mx-6 mb-4 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm text-center">
            {saveNotification}
          </div>
        )}

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
