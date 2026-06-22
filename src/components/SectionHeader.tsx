import { CardHeader } from '@heroui/card'
import type { ComponentType } from 'react'

type SectionHeaderVariant = 'primary' | 'secondary' | 'default'

const variantStyles: Record<SectionHeaderVariant, { bg: string; icon: string }> = {
  primary: { bg: 'bg-primary/10', icon: 'text-primary' },
  secondary: { bg: 'bg-secondary/10', icon: 'text-secondary' },
  default: { bg: 'bg-default-100', icon: 'text-default-600' },
}

interface SectionHeaderProps {
  icon: ComponentType<{ className?: string }>
  title: string
  variant?: SectionHeaderVariant
}

export default function SectionHeader({ icon: Icon, title, variant = 'primary' }: SectionHeaderProps) {
  const styles = variantStyles[variant]
  return (
    <CardHeader className="flex gap-2.5">
      <div className={`w-8 h-8 rounded-lg ${styles.bg} flex items-center justify-center`}>
        <Icon className={styles.icon} />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
    </CardHeader>
  )
}
