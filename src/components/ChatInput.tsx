import { useState, useRef, useEffect } from 'react'
import { Input, Button } from '@heroui/react'
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
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
        className="flex-1 h-12 rounded-2xl"
      />
      <Button
        variant="primary"
        isDisabled={disabled || !text.trim()}
        onPress={handleSend}
        className="rounded-xl h-12 w-12 bg-gradient-to-r from-rose-400 to-rose-500 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-px"
      >
        <FiSend />
      </Button>
    </div>
  )
}
