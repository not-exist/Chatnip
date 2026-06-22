import type { ComponentType } from 'react'

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
}

export default function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-5">
        <Icon className="text-3xl opacity-50" />
      </div>
      <p className="text-base font-medium text-gray-600 dark:text-gray-400 mb-1.5">{title}</p>
      <p className="text-sm">{description}</p>
    </div>
  )
}
