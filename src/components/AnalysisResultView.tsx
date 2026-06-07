import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AnalysisResultViewProps {
  content: string
}

export default function AnalysisResultView({ content }: AnalysisResultViewProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none
      prose-headings:text-foreground
      prose-p:text-foreground/90
      prose-strong:text-foreground
      prose-table:border-collapse
      prose-table:w-full
      prose-th:border prose-th:border-default-300 prose-th:bg-default-100 prose-th:px-3 prose-th:py-2
      prose-td:border prose-td:border-default-300 prose-td:px-3 prose-td:py-2
      prose-blockquote:border-l-primary prose-blockquote:bg-default-50 prose-blockquote:py-1 prose-blockquote:px-4
      prose-code:bg-default-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
      prose-code:before:content-none prose-code:after:content-none
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
