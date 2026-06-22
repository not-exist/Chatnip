import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AnalysisResultViewProps {
  content: string
}

export default function AnalysisResultView({ content }: AnalysisResultViewProps) {
  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-default-400">
        <div className="w-12 h-12 rounded-full bg-default-100 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </div>
        <p className="text-sm">暂无分析结果</p>
      </div>
    )
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none
      prose-headings:text-foreground
      prose-p:text-foreground/90 prose-p:leading-7
      prose-strong:text-foreground
      prose-table:border-collapse
      prose-table:w-full
      prose-th:border prose-th:border-default-300 prose-th:bg-default-100 prose-th:px-3 prose-th:py-2
      prose-td:border prose-td:border-default-300 prose-td:px-3 prose-td:py-2
      prose-blockquote:border-l-primary prose-blockquote:bg-default-50 prose-blockquote:py-1 prose-blockquote:px-4
      prose-code:bg-default-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:text-sm
      prose-code:before:content-none prose-code:after:content-none
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
