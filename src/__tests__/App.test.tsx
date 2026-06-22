import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    // The app should render the Layout component which contains navigation
    expect(screen.getByText('Chatnip')).toBeDefined()
  })
})
