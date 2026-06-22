import type { ComponentType } from 'react'

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
}

export default function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-default-400">
      <div className="w-16 h-16 rounded-2xl bg-default-100 flex items-center justify-center mb-5">
        <Icon className="text-3xl opacity-50" />
      </div>
      <p className="text-base font-medium text-default-600 mb-1.5">{title}</p>
      <p className="text-sm">{description}</p>
    </div>
  )
}
