import { Download, RefreshCw, X, AlertCircle, CheckCircle } from 'lucide-react'
import { UpdateStatus } from '../../hooks/useAutoUpdate'
import { Update } from '@tauri-apps/plugin-updater'

interface UpdateModalProps {
  status: UpdateStatus
  update: Update | null
  progress: number
  error: string | null
  onDownload: () => void
  onDismiss: () => void
}

export function UpdateModal({
  status,
  update,
  progress,
  error,
  onDownload,
  onDismiss,
}: UpdateModalProps) {
  // 업데이트 가능 상태일 때만 모달 표시
  if (status === 'idle' || status === 'checking') {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {status === 'available' && (
              <>
                <Download className="w-5 h-5 text-blue-500" />
                새 버전 사용 가능
              </>
            )}
            {status === 'downloading' && (
              <>
                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                업데이트 중...
              </>
            )}
            {status === 'ready' && (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                업데이트 완료
              </>
            )}
            {status === 'error' && (
              <>
                <AlertCircle className="w-5 h-5 text-red-500" />
                업데이트 오류
              </>
            )}
          </h2>
          {(status === 'available' || status === 'error') && (
            <button
              onClick={onDismiss}
              className="p-1 hover:bg-muted rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 본문 */}
        <div className="p-4">
          {status === 'available' && update && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>
                  새 버전 <span className="font-semibold text-foreground">{update.version}</span>이
                  출시되었습니다.
                </p>
                <p className="mt-1">지금 업데이트하시겠습니까?</p>
              </div>

              {/* 릴리스 노트 */}
              {update.body && (
                <div className="bg-muted/50 rounded-md p-3 max-h-40 overflow-y-auto">
                  <h4 className="text-xs font-semibold mb-2 text-muted-foreground">변경 사항</h4>
                  <div className="text-sm whitespace-pre-wrap">{update.body}</div>
                </div>
              )}
            </div>
          )}

          {status === 'downloading' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                업데이트를 다운로드하고 있습니다...
              </p>
              {/* 프로그레스 바 */}
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">{progress}%</p>
            </div>
          )}

          {status === 'ready' && (
            <p className="text-sm text-muted-foreground">
              업데이트가 완료되었습니다. 앱을 재시작합니다...
            </p>
          )}

          {status === 'error' && (
            <div className="space-y-2">
              <p className="text-sm text-red-500">{error || '알 수 없는 오류가 발생했습니다.'}</p>
              <p className="text-xs text-muted-foreground">
                나중에 다시 시도하거나, 수동으로 업데이트해 주세요.
              </p>
            </div>
          )}
        </div>

        {/* 버튼 영역 */}
        {(status === 'available' || status === 'error') && (
          <div className="flex gap-3 justify-end p-4 border-t border-border bg-muted/30">
            <button
              onClick={onDismiss}
              className="px-4 py-2 text-sm rounded-md hover:bg-muted transition-colors"
            >
              나중에
            </button>
            {status === 'available' && (
              <button
                onClick={onDownload}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                지금 업데이트
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
