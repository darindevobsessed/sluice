import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatFab } from '../ChatFab'

describe('ChatFab', () => {
  it('renders when visible and hasPersonas', () => {
    render(<ChatFab visible hasPersonas onClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: /open chat hub/i })).toBeInTheDocument()
  })

  it('returns null when hasPersonas is false', () => {
    const { container } = render(<ChatFab visible hasPersonas={false} onClick={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when visible is false and hasPersonas is false', () => {
    const { container } = render(<ChatFab visible={false} hasPersonas={false} onClick={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('applies hidden class when visible is false', () => {
    render(<ChatFab visible={false} hasPersonas onClick={vi.fn()} />)
    const button = screen.getByRole('button', { name: /open chat hub/i })
    // The button's parent or the button itself should have a class that hides it
    const wrapper = button.closest('[class*="invisible"], [class*="opacity-0"], [class*="hidden"]')
    // Check that either the button or a wrapping element indicates hidden state
    expect(button.getAttribute('aria-hidden') === 'true' || wrapper !== null || button.className.includes('invisible') || button.className.includes('opacity-0')).toBe(true)
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<ChatFab visible hasPersonas onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: /open chat hub/i }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('has correct aria-label', () => {
    render(<ChatFab visible hasPersonas onClick={vi.fn()} />)
    expect(screen.getByLabelText('Open chat hub')).toBeInTheDocument()
  })
})
