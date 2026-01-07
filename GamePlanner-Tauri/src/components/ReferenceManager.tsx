// 참조 파일 관리 컴포넌트

import { useState, useEffect } from 'react'
import { FileText, Plus, Trash2, Loader2, HelpCircle, X, FileSearch } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { ReferenceFile } from '../types/referenceFile'
import { open } from '@tauri-apps/plugin-dialog'
import { parseFile } from '../lib/utils/fileParser'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { saveSessionImmediately } from '../lib/utils/sessionSave'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { devLog } from '../lib/utils/logger'

interface ReferenceManagerProps {
  sessionId: string
}

export function ReferenceManager({ sessionId }: ReferenceManagerProps) {
  const { sessions, updateSession } = useAppStore()
  const [isAdding, setIsAdding] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [summaryViewFile, setSummaryViewFile] = useState<ReferenceFile | null>(null)
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([])
  const [isDragging, setIsDragging] = useState(false)

  // 세션에서 참조 파일 목록 가져오기
  useEffect(() => {
    const session = sessions.find(s => s.id === sessionId)
    setReferenceFiles(session?.referenceFiles || [])
  }, [sessions, sessionId])

  // Tauri 드래그 앤 드롭 이벤트 리스너 설정
  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setupDragDropListener = async () => {
      try {
        const appWindow = getCurrentWindow()

        unlisten = await appWindow.onDragDropEvent(async (event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setIsDragging(true)
          } else if (event.payload.type === 'leave') {
            setIsDragging(false)
          } else if (event.payload.type === 'drop') {
            setIsDragging(false)

            // 드롭된 파일 경로 가져오기
            const paths = event.payload.paths || []
            if (paths.length > 0) {
              // 지원하는 파일 확장자 확인
              const supportedExtensions = ['pdf', 'xlsx', 'xls', 'csv', 'md', 'markdown', 'txt']
              const validFiles: string[] = []

              for (const filePath of paths) {
                const extension = filePath.split('.').pop()?.toLowerCase() || ''
                if (supportedExtensions.includes(extension)) {
                  validFiles.push(filePath)
                } else {
                  const fileName = filePath.split(/[/\\]/).pop() || filePath
                  alert(`지원하지 않는 파일 형식입니다: ${fileName}\n지원 형식: ${supportedExtensions.join(', ')}`)
                }
              }

              if (validFiles.length > 0) {
                await processFiles(validFiles)
              }
            }
          }
        })

        devLog.log('✅ [ReferenceManager] 드래그 앤 드롭 리스너 등록')
      } catch (error) {
        console.error('❌ [ReferenceManager] 드래그 앤 드롭 리스너 등록 실패:', error)
      }
    }

    setupDragDropListener()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [referenceFiles, sessionId, sessions])

  // 파일 경로 배열을 처리하여 참조 파일 추가 (공통 로직)
  const processFiles = async (filePaths: string[]) => {
    setIsAdding(true)

    const newFiles: ReferenceFile[] = []

    for (const filePath of filePaths) {
      try {
        const fileName = filePath.split(/[/\\]/).pop() || 'unknown'

        // 이미 등록된 파일인지 확인
        if (referenceFiles.some(f => f.filePath === filePath)) {
          alert(`파일 "${fileName}"은(는) 이미 등록되어 있습니다.`)
          continue
        }

        // 파일 파싱
        const parsed = await parseFile(filePath, fileName)

        // 파일 크기 제한 체크 (10만자로 강화)
        if (parsed.text.length > 100000) {
          alert(`파일 "${fileName}"의 내용이 너무 큽니다. (최대 10만자)\n현재: ${(parsed.text.length / 1000).toFixed(0)}K자`)
          continue
        }

        // 파일 요약 생성 (비용 최적화)
        const { generateFileSummary, generateSimpleSummary } = await import('../lib/utils/fileOptimization')
        const apiKey = useAppStore.getState().apiKey
        let summary: string

        try {
          if (apiKey && parsed.text.length > 1000) {
            // AI를 사용한 요약 생성 (내용이 1000자 이상인 경우)
            summary = await generateFileSummary(parsed.text, fileName, apiKey)
          } else {
            // 간단한 텍스트 기반 요약 (AI 없이)
            summary = generateSimpleSummary(parsed.text)
          }
        } catch (error) {
          console.error('요약 생성 실패, 간단한 요약 사용:', error)
          summary = generateSimpleSummary(parsed.text)
        }

        const newFile: ReferenceFile = {
          id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          fileName: parsed.metadata?.fileName || fileName,
          filePath: filePath,
          fileType: parsed.metadata?.fileType || 'unknown',
          content: parsed.text,
          summary: summary,
          metadata: parsed.metadata,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        newFiles.push(newFile)
      } catch (error) {
        console.error('파일 파싱 실패:', error)
        alert(`파일 파싱 실패: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (newFiles.length > 0) {
      const updatedFiles = [...referenceFiles, ...newFiles]
      setReferenceFiles(updatedFiles)

      // 세션 업데이트
      const session = sessions.find(s => s.id === sessionId)
      if (session) {
        updateSession(sessionId, {
          referenceFiles: updatedFiles,
        })
        // 레퍼런스 파일 등록 후 즉시 세션 저장
        await saveSessionImmediately()
      }
    }

    setIsAdding(false)
  }

  // 파일 추가 버튼 클릭
  const handleAddFile = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: '지원 파일',
            extensions: ['pdf', 'xlsx', 'xls', 'csv', 'md', 'markdown', 'txt'],
          },
        ],
      })

      if (!selected || (Array.isArray(selected) && selected.length === 0)) {
        return
      }

      const files = Array.isArray(selected) ? selected : [selected]
      await processFiles(files)
    } catch (error) {
      console.error('파일 선택 실패:', error)
      setIsAdding(false)
    }
  }

  // 파일 삭제 확인 다이얼로그 표시
  const handleDeleteFile = (fileId: string) => {
    setDeleteConfirm(fileId)
  }

  // 파일 삭제 취소
  const cancelDelete = () => {
    setDeleteConfirm(null)
  }

  // 파일 삭제 확인
  const confirmDelete = async () => {
    if (!deleteConfirm) return

    const updatedFiles = referenceFiles.filter(f => f.id !== deleteConfirm)
    setReferenceFiles(updatedFiles)

    // 세션 업데이트
    const session = sessions.find(s => s.id === sessionId)
    if (session) {
      updateSession(sessionId, {
        referenceFiles: updatedFiles,
      })
      // 레퍼런스 파일 삭제 후 즉시 세션 저장
      await saveSessionImmediately()
    }

    setDeleteConfirm(null)
  }

  // 파일 타입 아이콘
  const getFileTypeIcon = () => {
    return <FileText className="w-4 h-4" />
  }

  // 파일 타입 색상
  const getFileTypeColor = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return 'text-red-500'
      case 'xlsx':
      case 'xls':
        return 'text-green-500'
      case 'csv':
        return 'text-blue-500'
      case 'md':
      case 'markdown':
        return 'text-purple-500'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div
      className={`relative bg-card border rounded-lg p-4 transition-all ${
        isDragging
          ? 'border-primary border-2 bg-primary/5'
          : 'border-border'
      }`}
    >
      {/* 드래그 오버레이 */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg z-10 pointer-events-none">
          <div className="bg-card border-2 border-primary border-dashed rounded-lg px-6 py-4">
            <p className="text-lg font-semibold text-primary">파일을 여기에 드롭하세요</p>
            <p className="text-sm text-muted-foreground mt-1">PDF, Excel, CSV, Markdown, Text 파일 지원</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          <h3 className="text-lg font-semibold">참조 파일</h3>
          <span className="text-sm text-muted-foreground">
            ({referenceFiles.length}개)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelpModal(true)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
            title="도움말"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <button
            onClick={handleAddFile}
            disabled={isAdding}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAdding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                추가 중...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                파일 추가
              </>
            )}
          </button>
        </div>
      </div>

      {referenceFiles.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">등록된 참조 파일이 없습니다.</p>
          <p className="text-xs mt-1">파일을 추가하거나 드래그 앤 드롭으로 등록하세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {referenceFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={getFileTypeColor(file.fileType)}>
                  {getFileTypeIcon()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate" title={file.fileName}>
                      {file.fileName}
                    </p>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 bg-background rounded">
                      {file.fileType.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>
                      {file.content.length.toLocaleString()}자
                    </span>
                    {file.metadata?.pageCount && (
                      <span>{file.metadata.pageCount}페이지</span>
                    )}
                    {file.metadata?.sheetCount && (
                      <span>{file.metadata.sheetCount}시트</span>
                    )}
                    <span>
                      {format(new Date(file.createdAt), 'yyyy-MM-dd', { locale: ko })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSummaryViewFile(file)}
                  className="p-1.5 hover:bg-accent rounded transition-colors"
                  title="요약 보기"
                >
                  <FileSearch className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
                <button
                  onClick={() => handleDeleteFile(file.id)}
                  className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {referenceFiles.length > 0 && (
        <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          <p className="font-medium mb-1">💡 참조 파일 활용 방법</p>
          <p>등록된 참조 파일의 내용은 기획서 작성 시 자동으로 참고됩니다. AI가 파일 내용을 분석하여 기획서에 반영합니다.</p>
        </div>
      )}

      {/* 요약 보기 모달 */}
      {summaryViewFile && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSummaryViewFile(null)}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSummaryViewFile(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <FileSearch className="w-5 h-5" />
              <h3 className="text-lg font-semibold">파일 요약</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{summaryViewFile.fileName}</span>
                  <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                    {summaryViewFile.fileType.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span>원본 크기: {(summaryViewFile.content.length / 1000).toFixed(0)}K자</span>
                  {summaryViewFile.metadata?.pageCount && (
                    <span className="ml-3">{summaryViewFile.metadata.pageCount}페이지</span>
                  )}
                  {summaryViewFile.metadata?.sheetCount && (
                    <span className="ml-3">{summaryViewFile.metadata.sheetCount}시트</span>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="font-semibold mb-3 text-sm">📝 파일 요약</h4>
                {summaryViewFile.summary ? (
                  <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
                    {summaryViewFile.summary}
                  </div>
                ) : (
                  <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground italic">
                    요약 정보가 없습니다. 파일이 등록될 때 자동으로 생성됩니다.
                  </div>
                )}
              </div>

              {summaryViewFile.summary && (
                <div className="border-t border-border pt-4">
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground mb-2">
                      전체 내용 보기 ({(summaryViewFile.content.length / 1000).toFixed(0)}K자)
                    </summary>
                    <div className="mt-3 bg-muted/30 rounded-lg p-4 max-h-96 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap">
                      {summaryViewFile.content}
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={cancelDelete}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">참조 파일 삭제</h3>
            <p className="text-muted-foreground mb-6">
              이 참조 파일을 삭제하시겠습니까?<br />
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-accent transition-colors font-medium"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 도움말 모달 */}
      {showHelpModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-4">참조 파일 도움말</h3>

            <div className="space-y-6 text-sm text-muted-foreground">
              <div>
                <h4 className="font-semibold text-foreground mb-2">📎 참조 파일이란?</h4>
                <p>
                  참조 파일은 기획서 작성 시 AI가 참고할 수 있는 문서나 자료입니다. 등록된 파일의 내용을 분석하여 기획서에 자동으로 반영되므로,
                  기존 기획서, 벤치마킹 자료, 요구사항 문서 등을 등록하면 더욱 정확하고 일관된 기획서를 작성할 수 있습니다.
                </p>
                <p className="mt-2">
                  <strong>파일 추가 방법:</strong> "파일 추가" 버튼을 클릭하거나, 탐색기에서 파일을 드래그 앤 드롭으로 등록할 수 있습니다.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">📄 지원하는 파일 형식</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>PDF (.pdf):</strong> PDF 문서의 텍스트 내용을 추출합니다.</li>
                  <li><strong>Excel (.xlsx, .xls):</strong> 모든 시트의 데이터를 텍스트로 변환합니다.</li>
                  <li><strong>CSV (.csv):</strong> 쉼표로 구분된 데이터를 읽기 쉬운 형식으로 변환합니다.</li>
                  <li><strong>Markdown (.md, .markdown):</strong> 마크다운 문서를 그대로 읽습니다.</li>
                  <li><strong>텍스트 (.txt):</strong> 일반 텍스트 파일을 읽습니다.</li>
                  <li><strong>Google Spreadsheet:</strong> Google 스프레드시트 URL을 입력하면 자동으로 다운로드하여 파싱합니다.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">🎯 참조 파일의 역할</h4>
                <ol className="list-decimal list-inside space-y-1">
                  <li><strong>기획서 작성 시 자동 참고:</strong> 등록된 파일의 내용이 모든 기획서 작성 요청에 자동으로 포함됩니다.</li>
                  <li><strong>일관성 유지:</strong> 기존 기획서나 요구사항 문서를 참조하여 일관된 스타일과 내용을 유지할 수 있습니다.</li>
                  <li><strong>벤치마킹 자료 활용:</strong> 경쟁 게임 분석 자료나 벤치마킹 문서를 등록하면 이를 참고하여 기획서를 작성합니다.</li>
                  <li><strong>요구사항 반영:</strong> 프로젝트 요구사항 문서나 기획 가이드라인을 등록하면 이를 준수한 기획서를 작성합니다.</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">💡 활용 팁</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>기존에 작성한 기획서를 참조 파일로 등록하면, 새로운 기획서 작성 시 스타일과 구조를 일관되게 유지할 수 있습니다.</li>
                  <li>게임 분석 세션에서 생성된 분석 보고서를 참조 파일로 등록하면, 해당 게임의 특징을 반영한 기획서를 작성할 수 있습니다.</li>
                  <li>회사나 팀의 기획 가이드라인 문서를 등록하면, 조직의 표준에 맞는 기획서를 작성할 수 있습니다.</li>
                  <li>참조 파일은 세션별로 관리되므로, 프로젝트마다 다른 참조 자료를 사용할 수 있습니다.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">⚠️ 주의사항</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>파일 크기 제한: 각 파일의 내용은 최대 50만자까지 지원합니다.</li>
                  <li>파일 경로: 파일은 세션과 함께 저장되지만, 원본 파일이 삭제되면 내용만 유지됩니다.</li>
                  <li>중복 등록: 동일한 파일 경로의 파일은 중복 등록할 수 없습니다.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

