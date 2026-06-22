import { Card } from '@heroui/react'
import type { ComponentType } from 'react'

type SectionHeaderVariant = 'primary' | 'secondary' | 'default'

const variantStyles: Record<SectionHeaderVariant, { bg: string; icon: string }> = {
  primary: { bg: 'bg-rose-50 dark:bg-rose-900/20', icon: 'text-rose-500' },
  secondary: { bg: 'bg-sky-50 dark:bg-sky-900/20', icon: 'text-sky-500' },
  default: { bg: 'bg-gray-100 dark:bg-white/5', icon: 'text-gray-500' },
}

interface SectionHeaderProps {
  icon: ComponentType<{ className?: string }>
  title: string
  variant?: SectionHeaderVariant
}

export default function SectionHeader({ icon: Icon, title, variant = 'primary' }: SectionHeaderProps) {
  const styles = variantStyles[variant]
  return (
    <Card.Header className="flex gap-2.5">
      <div className={`w-8 h-8 rounded-lg ${styles.bg} flex items-center justify-center`}>
        <Icon className={styles.icon} />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
    </Card.Header>
  )
}
