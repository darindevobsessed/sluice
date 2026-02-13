import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Button } from '../button'

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('applies variant classes', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button).toHaveAttribute('data-variant', 'destructive')
  })

  it('applies size classes', () => {
    render(<Button size="lg">Large</Button>)
    const button = screen.getByRole('button', { name: 'Large' })
    expect(button).toHaveAttribute('data-size', 'lg')
  })

  it('forwards additional props', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  describe('GPU Performance Optimizations', () => {
    it('uses scoped transition properties instead of transition-all', () => {
      render(<Button>Test</Button>)
      const button = screen.getByRole('button')

      // Check that the button has scoped transitions, not transition-all
      expect(button.className).toContain('transition-[color,background-color,border-color,box-shadow,opacity]')
      expect(button.className).not.toContain('transition-all')
    })

    it('applies scoped transitions to all variants', () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const

      variants.forEach(variant => {
        const { unmount } = render(<Button variant={variant}>Test {variant}</Button>)
        const button = screen.getByRole('button')

        // All variants should have scoped transitions
        expect(button.className).toContain('transition-[color,background-color,border-color,box-shadow,opacity]')
        expect(button.className).not.toContain('transition-all')

        unmount()
      })
    })
  })
})
