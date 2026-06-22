import { useState, useRef, useEffect } from 'react'
import { Input } from '@heroui/input'
import { Button } from '@heroui/button'
import { FiSend } from 'react-icons/fi'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function ChatInput({ onSend, disabled, placeholder = '输入追问...' }: ChatInputProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  return (
    <div className="flex gap-2.5 items-end">
      <Input
        ref={inputRef}
        value={text}
        onValueChange={setText}
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
        classNames={{
          inputWrapper: 'rounded-2xl h-12 shadow-xs border-default-200',
        }}
        className="flex-1"
      />
      <Button
        color="primary"
        isIconOnly
        isDisabled={disabled || !text.trim()}
        onPress={handleSend}
        className="rounded-xl h-12 w-12 bg-gradient-to-r from-primary-400 to-primary-500 shadow-xs hover:shadow-sm transition-all duration-200 hover:-translate-y-px"
      >
        <FiSend />
      </Button>
    </div>
  )
}
