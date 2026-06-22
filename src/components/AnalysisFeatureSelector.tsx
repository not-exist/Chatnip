import { CheckboxGroup, Checkbox } from '@heroui/react'
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
      value={selected}
      onChange={(values) => {
        const vals = values as string[]
        if (!vals.includes('summary')) {
          vals.unshift('summary')
        }
        onChange(vals)
      }}
    >
      <span className="text-sm font-medium">选择分析维度（基础总结必含）</span>
      {FEATURE_OPTIONS.map((feature, idx) => {
        const colors = ['bg-rose-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-pink-500']
        const dotColor = colors[idx % colors.length]
        return (
          <Checkbox
            key={feature.key}
            value={feature.key}
            isDisabled={feature.key === 'summary'}
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <div className="flex flex-col gap-0 ml-2">
                <span className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                  <span className="font-medium">{feature.label}</span>
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-[20px]">{feature.description}</span>
              </div>
            </Checkbox.Content>
          </Checkbox>
        )
      })}
    </CheckboxGroup>
  )
}
