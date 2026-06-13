import { useState } from 'react'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Button } from '@heroui/button'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FEATURE_OPTIONS } from '@/prompts/analysis'
import type { DimensionBlock } from '@/prompts/analysis'

const DOT_COLORS = [
  'bg-primary',
  'bg-secondary',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
]

interface DimensionCardProps {
  dimension: DimensionBlock
  defaultExpanded?: boolean
}

function getDotColor(dimensionKey: string): string {
  const idx = FEATURE_OPTIONS.findIndex((f) => f.key === dimensionKey)
  if (idx === -1) return 'bg-default-400'
  return DOT_COLORS[idx % DOT_COLORS.length]
}

export default function DimensionCard({
  dimension,
  defaultExpanded = true,
}: DimensionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const dotColor = getDotColor(dimension.key)

  return (
    <Card className="card-enhanced">
      <CardHeader className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`}
          />
          <span className="font-semibold text-sm truncate">
            {dimension.label}
          </span>
        </div>
        <Button
          variant="light"
          size="sm"
          isIconOnly
          onPress={() => setExpanded((prev) => !prev)}
          className="flex-shrink-0 rounded-lg"
          aria-label={expanded ? '收起' : '展开'}
        >
          {expanded ? (
            <FiChevronUp className="text-base" />
          ) : (
            <FiChevronDown className="text-base" />
          )}
        </Button>
      </CardHeader>
      {expanded && (
        <CardBody className="pt-0 pb-4 px-5">
          <div
            className="prose prose-sm dark:prose-invert max-w-none
              prose-p:my-1.5 prose-p:leading-7
              prose-headings:mt-4 prose-headings:mb-2
              prose-code:bg-default-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
              prose-code:before:content-none prose-code:after:content-none
              prose-table:border-collapse prose-table:w-full prose-table:text-xs
              prose-th:border prose-th:border-default-300 prose-th:bg-default-100 prose-th:px-2 prose-th:py-1.5
              prose-td:border prose-td:border-default-300 prose-td:px-2 prose-td:py-1.5
              prose-blockquote:border-l-primary prose-blockquote:bg-default-50/60 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:not-italic
              prose-li:my-0.5
              prose-strong:text-foreground
            "
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {dimension.content}
            </ReactMarkdown>
          </div>
        </CardBody>
      )}
    </Card>
  )
}
