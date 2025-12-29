import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Copy, BookOpen, Check, Loader2, Download } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { useAppStore, SessionType } from '../store/useAppStore'
import { createNotionPage } from '../lib/notionBlocks'

export function MarkdownPreview() {
  const {
    markdownContent,
    sessions,
    currentSessionId,
    notionApiKey,
    notionPlanningDatabaseId,
    notionAnalysisDatabaseId,
  } = useAppStore()
  const [isCopied, setIsCopied] = useState(false)
  const [isNotionLoading, setIsNotionLoading] = useState(false)

  // 현재 세션 정보
  const currentSession = sessions.find((s) => s.id === currentSessionId)
  const isAnalysisMode = currentSession?.type === SessionType.ANALYSIS

  // 마크다운에서 게임명 추출 (노션 저장 시 정확한 제목 사용)
  const extractGameName = (): string => {
    if (!markdownContent) {
      return currentSession?.title || '게임 기획서'
    }

    if (isAnalysisMode) {
      // 분석 보고서: "<!-- ANALYSIS_TITLE: 게임명 게임 분석 보고서 -->"
      const match = markdownContent.match(/<!--\s*ANALYSIS_TITLE:\s*(.+?)\s*게임\s*분석\s*보고서\s*-->/m)
      if (match) {
        return match[1].trim()
      }
    } else {
      // 기획서: "🎮 **게임명 게임 기획서**"
      const match = markdownContent.match(/^🎮\s*\*\*(.+?)\s*게임\s*기획서\*\*/m)
      if (match) {
        return match[1].trim()
      }
    }

    // 추출 실패 시 세션 제목 사용
    return currentSession?.title || '게임 기획서'
  }

  const gameName = extractGameName()

  // 파일명 생성 (세션 타입에 따라)
  const getFileName = () => {
    if (isAnalysisMode) {
      return `${gameName}_게임분석.md`
    } else {
      return `${gameName}_게임기획서.md`
    }
  }

  // 현재 세션 타입에 맞는 Notion DB ID 선택
  const notionDatabaseId = isAnalysisMode ? notionAnalysisDatabaseId : notionPlanningDatabaseId

  // 복사 기능
  const handleCopy = async () => {
    if (!markdownContent) return

    try {
      await navigator.clipboard.writeText(markdownContent)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('복사 실패:', error)
      alert('복사에 실패했습니다')
    }
  }

  // 다운로드 기능
  const handleDownload = async () => {
    if (!markdownContent) {
      alert('저장할 내용이 없습니다')
      return
    }

    try {
      const filePath = await save({
        defaultPath: getFileName(),
        filters: [
          {
            name: 'Markdown',
            extensions: ['md'],
          },
        ],
      })

      if (filePath) {
        await writeTextFile(filePath, markdownContent)
        alert('파일이 저장되었습니다!')
      }
    } catch (error) {
      console.error('파일 저장 실패:', error)
      alert('파일 저장에 실패했습니다')
    }
  }

  // 노션 저장 기능
  const handleSaveToNotion = async () => {
    if (!markdownContent) {
      alert('저장할 기획서가 없습니다')
      return
    }

    if (!notionApiKey || !notionDatabaseId) {
      alert('노션 API 설정이 필요합니다.\n\n설정 메뉴에서 Notion API Key와 Database ID를 입력해주세요.')
      return
    }

    console.log('📝 노션 저장 시작:', {
      gameName,
      isAnalysisMode,
      markdownLength: markdownContent.length
    })

    setIsNotionLoading(true)

    try {
      const pageUrl = await createNotionPage(
        gameName,
        markdownContent,
        notionApiKey,
        notionDatabaseId,
        isAnalysisMode
      )

      if (pageUrl) {
        alert('노션에 저장되었습니다!\n\n' + pageUrl)
        // 노션 페이지 열기
        try {
          await openUrl(pageUrl)
        } catch (openError) {
          console.error('페이지 열기 실패:', openError)
          // 페이지 열기 실패는 무시 (수동으로 열 수 있음)
        }
      } else {
        throw new Error('페이지 URL을 받지 못했습니다')
      }
    } catch (error) {
      console.error('❌ 노션 저장 실패:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      alert('노션 저장에 실패했습니다.\n\n' + errorMessage)
    } finally {
      setIsNotionLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* 상단 헤더 */}
      {markdownContent && (
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-b border-border bg-background/50">
          {/* 복사 버튼 */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background hover:bg-accent transition-colors text-sm font-medium"
            title="기획서 복사"
          >
            {isCopied ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span>복사됨</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>복사</span>
              </>
            )}
          </button>

          {/* 노션 저장 버튼 */}
          <button
            onClick={handleSaveToNotion}
            disabled={isNotionLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title="노션에 저장"
          >
            {isNotionLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>저장 중...</span>
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4" />
                <span>노션 저장</span>
              </>
            )}
          </button>

          {/* 다운로드 버튼 */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background hover:bg-accent transition-colors text-sm font-medium"
            title="마크다운 파일로 저장"
          >
            <Download className="w-4 h-4" />
            <span>다운로드</span>
          </button>
        </div>
      )}

      {/* 마크다운 프리뷰 */}
      <div className="flex-1 overflow-y-auto p-6">
        {markdownContent ? (
          <div className="max-w-5xl mx-auto bg-background rounded-lg shadow-sm p-8">
            <div className="prose prose-lg max-w-none
              prose-headings:font-bold prose-headings:tracking-tight
              prose-h1:text-4xl prose-h1:mb-8 prose-h1:pb-4 prose-h1:border-b-2 prose-h1:border-border
              prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:pb-3 prose-h2:border-b prose-h2:border-border
              prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-4
              prose-h4:text-xl prose-h4:mt-6 prose-h4:mb-3
              prose-p:my-4 prose-p:leading-relaxed prose-p:text-foreground/90
              prose-ul:my-6 prose-ul:space-y-2
              prose-ol:my-6 prose-ol:space-y-2
              prose-li:my-2 prose-li:leading-relaxed
              prose-strong:font-bold prose-strong:text-foreground
              prose-code:bg-muted prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:font-mono
              prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:my-6
              prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:my-6
              prose-hr:my-8 prose-hr:border-border
              prose-table:my-6
              prose-thead:border-b-2 prose-thead:border-border
              prose-th:p-3 prose-th:text-left prose-th:font-bold
              prose-td:p-3 prose-td:border-t prose-td:border-border
            ">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
              >
                {markdownContent}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              {isAnalysisMode ? (
                <>
                  <p className="text-lg font-medium mb-2">게임 분석 결과가 여기에 표시됩니다</p>
                  <p className="text-sm">
                    AI가 게임을 분석하면 실시간으로 렌더링됩니다
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium mb-2">기획서가 여기에 표시됩니다</p>
                  <p className="text-sm">
                    AI가 기획서를 작성하면 실시간으로 렌더링됩니다
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
