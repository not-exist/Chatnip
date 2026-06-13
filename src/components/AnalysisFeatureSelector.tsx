import { CheckboxGroup, Checkbox } from '@heroui/checkbox'
import { FEATURE_OPTIONS } from '@/prompts/analysis'

interface AnalysisFeatureSelectorProps {
  selected: string[]
  onChange: (features: string[]) => void
}

export default function AnalysisFeatureSelector({
  selected,
  onChange,
}: AnalysisFeatureSelectorProps) {
  return (
    <CheckboxGroup
      label="选择分析维度（基础总结必含）"
      value={selected}
      onValueChange={(values) => {
        const vals = values as string[]
        if (!vals.includes('summary')) {
          vals.unshift('summary')
        }
        onChange(vals)
      }}
      className="gap-2"
    >
      {FEATURE_OPTIONS.map((feature, idx) => {
        const colors = ['bg-primary', 'bg-secondary', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500']
        const dotColor = colors[idx % colors.length]
        return (
          <Checkbox
            key={feature.key}
            value={feature.key}
            isDisabled={feature.key === 'summary'}
            classNames={{
              base: 'items-start',
              label: 'flex flex-col gap-0',
            }}
          >
            <span className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
              <span className="font-medium">{feature.label}</span>
            </span>
            <span className="text-xs text-default-500 ml-[20px]">{feature.description}</span>
          </Checkbox>
        )
      })}
    </CheckboxGroup>
  )
}
