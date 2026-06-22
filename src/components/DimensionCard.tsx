import { useState } from 'react'
import { Card, Button } from '@heroui/react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FEATURE_OPTIONS } from '@/prompts/analysis'
import type { DimensionBlock } from '@/prompts/analysis'

const DOT_COLORS = [
  'bg-rose-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-pink-500',
]

interface DimensionCardProps {
  dimension: DimensionBlock
  defaultExpanded?: boolean
}

function getDotColor(dimensionKey: string): string {
  const idx = FEATURE_OPTIONS.findIndex((f) => f.key === dimensionKey)
  if (idx === -1) return 'bg-gray-400'
  return DOT_COLORS[idx % DOT_COLORS.length]
}

export default function DimensionCard({
  dimension,
  defaultExpanded = true,
}: DimensionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const dotColor = getDotColor(dimension.key)

  return (
    <Card>
      <Card.Header className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
          <span className="font-semibold text-sm truncate">
            {dimension.label}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => setExpanded((prev) => !prev)}
          className="shrink-0 rounded-lg min-w-0 px-2"
          aria-label={expanded ? '收起' : '展开'}
        >
          {expanded ? <FiChevronUp className="text-base" /> : <FiChevronDown className="text-base" />}
        </Button>
      </Card.Header>
      {expanded && (
        <Card.Content className="pt-0 pb-4 px-5">
          <div
            className="prose prose-sm dark:prose-invert max-w-none
              prose-p:my-1.5 prose-p:leading-7
              prose-headings:mt-4 prose-headings:mb-2
              prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm
              prose-code:before:content-none prose-code:after:content-none
              prose-table:border-collapse prose-table:w-full
              prose-th:border prose-th:border-gray-200 prose-th:bg-gray-50 prose-th:px-2 prose-th:py-1.5
              prose-td:border prose-td:border-gray-200 prose-td:px-2 prose-td:py-1.5
              prose-blockquote:border-l-rose-500 prose-blockquote:bg-gray-50/60 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:not-italic
              prose-li:my-0.5
              prose-strong:text-gray-900 dark:prose-strong:text-gray-100
            "
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {dimension.content}
            </ReactMarkdown>
          </div>
        </Card.Content>
      )}
    </Card>
  )
}
