import { useState } from 'react';
import { X, Palette, User, Mountain, Box } from 'lucide-react';
import { SessionType } from '../../types/session';

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, type: SessionType) => void;
}

export function NewSessionModal({ isOpen, onClose, onCreate }: NewSessionModalProps) {
  const [sessionName, setSessionName] = useState('');
  const [sessionType, setSessionType] = useState<SessionType>('STYLE');

  const handleCreate = () => {
    if (sessionName.trim()) {
      onCreate(sessionName.trim(), sessionType);
      setSessionName('');
      setSessionType('STYLE');
      onClose();
    } else {
      alert('세션 이름을 입력해주세요');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">새 세션 시작</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 space-y-6">
          {/* 세션 이름 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              세션 이름
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="예: 애니메이션 스타일, 주인공 캐릭터, 판타지 배경, 마법 아이템"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* 세션 타입 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              세션 타입
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* STYLE */}
              <button
                onClick={() => setSessionType('STYLE')}
                className={`flex flex-col items-start gap-2 p-4 rounded-lg font-semibold transition-all border-2 ${
                  sessionType === 'STYLE'
                    ? 'bg-purple-50 border-purple-600 shadow-lg'
                    : 'bg-white border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Palette size={20} className={sessionType === 'STYLE' ? 'text-purple-600' : 'text-gray-600'} />
                  <span className={sessionType === 'STYLE' ? 'text-purple-900' : 'text-gray-700'}>스타일</span>
                </div>
                <p className="text-xs text-left text-gray-600">
                  특정 화풍이나 아트 스타일을 학습하여 재현합니다
                </p>
              </button>

              {/* CHARACTER */}
              <button
                onClick={() => setSessionType('CHARACTER')}
                className={`flex flex-col items-start gap-2 p-4 rounded-lg font-semibold transition-all border-2 ${
                  sessionType === 'CHARACTER'
                    ? 'bg-blue-50 border-blue-600 shadow-lg'
                    : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <User size={20} className={sessionType === 'CHARACTER' ? 'text-blue-600' : 'text-gray-600'} />
                  <span className={sessionType === 'CHARACTER' ? 'text-blue-900' : 'text-gray-700'}>캐릭터</span>
                </div>
                <p className="text-xs text-left text-gray-600">
                  캐릭터의 외형을 학습하여 일관성을 유지합니다
                </p>
              </button>

              {/* BACKGROUND */}
              <button
                onClick={() => setSessionType('BACKGROUND')}
                className={`flex flex-col items-start gap-2 p-4 rounded-lg font-semibold transition-all border-2 ${
                  sessionType === 'BACKGROUND'
                    ? 'bg-green-50 border-green-600 shadow-lg'
                    : 'bg-white border-gray-200 hover:border-green-300 hover:bg-green-50/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Mountain size={20} className={sessionType === 'BACKGROUND' ? 'text-green-600' : 'text-gray-600'} />
                  <span className={sessionType === 'BACKGROUND' ? 'text-green-900' : 'text-gray-700'}>배경</span>
                </div>
                <p className="text-xs text-left text-gray-600">
                  배경 이미지 스타일을 학습하여 다양한 환경을 생성합니다
                </p>
              </button>

              {/* ICON */}
              <button
                onClick={() => setSessionType('ICON')}
                className={`flex flex-col items-start gap-2 p-4 rounded-lg font-semibold transition-all border-2 ${
                  sessionType === 'ICON'
                    ? 'bg-amber-50 border-amber-600 shadow-lg'
                    : 'bg-white border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Box size={20} className={sessionType === 'ICON' ? 'text-amber-600' : 'text-gray-600'} />
                  <span className={sessionType === 'ICON' ? 'text-amber-900' : 'text-gray-700'}>아이콘</span>
                </div>
                <p className="text-xs text-left text-gray-600">
                  아이템/아이콘 스타일을 학습하여 다양한 오브젝트를 생성합니다
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleCreate}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
