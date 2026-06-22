import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

vi.mock('@/api/napcat', () => ({
  getGroupList: vi.fn().mockResolvedValue([]),
  getFriendList: vi.fn().mockResolvedValue([]),
  getGroupMemberList: vi.fn().mockResolvedValue([]),
  getGroupMsgHistory: vi.fn().mockResolvedValue({ messages: [] }),
  getFriendMsgHistory: vi.fn().mockResolvedValue({ messages: [] }),
  testConnection: vi.fn().mockResolvedValue(true),
}))

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByText('Chatnip')).toBeDefined()
  })
})
