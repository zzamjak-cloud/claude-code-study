import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { useAppStore } from '../store/useAppStore'

export function MarkdownPreview() {
  const { markdownContent } = useAppStore()

  return (
    <div className="h-full overflow-y-auto p-6 bg-muted/30">
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
            <p className="text-lg font-medium mb-2">기획서가 여기에 표시됩니다</p>
            <p className="text-sm">
              AI가 기획서를 작성하면 실시간으로 렌더링됩니다
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
