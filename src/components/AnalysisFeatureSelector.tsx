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
      {FEATURE_OPTIONS.map((feature) => (
        <Checkbox
          key={feature.key}
          value={feature.key}
          isDisabled={feature.key === 'summary'}
          classNames={{
            base: 'items-start',
            label: 'flex flex-col gap-0',
          }}
        >
          <span className="font-medium">{feature.label}</span>
          <span className="text-xs text-default-500">{feature.description}</span>
        </Checkbox>
      ))}
    </CheckboxGroup>
  )
}
