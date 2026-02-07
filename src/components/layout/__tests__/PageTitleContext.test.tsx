import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useEffect } from 'react'
import { PageTitleProvider, usePageTitle } from '../PageTitleContext'

// Test component that uses the context
function TestConsumer() {
  const { title, backHref, backLabel } = usePageTitle()

  return (
    <div>
      <div data-testid="title">{title || 'no-title'}</div>
      <div data-testid="back-href">{backHref || 'no-href'}</div>
      <div data-testid="back-label">{backLabel || 'no-label'}</div>
    </div>
  )
}

// Test component that sets the page title
function TestSetter({ title, backHref, backLabel }: { title: string; backHref?: string; backLabel?: string }) {
  const { setPageTitle } = usePageTitle()

  // Set title on mount using useEffect
  useEffect(() => {
    setPageTitle({ title, backHref, backLabel })
  }, [title, backHref, backLabel, setPageTitle])

  return <div>Setter</div>
}

describe('PageTitleContext', () => {
  it('provides default empty values', () => {
    render(
      <PageTitleProvider>
        <TestConsumer />
      </PageTitleProvider>
    )

    expect(screen.getByTestId('title').textContent).toBe('no-title')
    expect(screen.getByTestId('back-href').textContent).toBe('no-href')
    expect(screen.getByTestId('back-label').textContent).toBe('no-label')
  })

  it('allows setting title without back link', () => {
    render(
      <PageTitleProvider>
        <TestSetter title="Knowledge Bank" />
        <TestConsumer />
      </PageTitleProvider>
    )

    expect(screen.getByTestId('title').textContent).toBe('Knowledge Bank')
    expect(screen.getByTestId('back-href').textContent).toBe('no-href')
    expect(screen.getByTestId('back-label').textContent).toBe('no-label')
  })

  it('allows setting title with back link', () => {
    render(
      <PageTitleProvider>
        <TestSetter title="Video Detail" backHref="/" backLabel="Knowledge Bank" />
        <TestConsumer />
      </PageTitleProvider>
    )

    expect(screen.getByTestId('title').textContent).toBe('Video Detail')
    expect(screen.getByTestId('back-href').textContent).toBe('/')
    expect(screen.getByTestId('back-label').textContent).toBe('Knowledge Bank')
  })

  it('updates title when setPageTitle is called again', () => {
    function DynamicSetter() {
      const { setPageTitle } = usePageTitle()

      return (
        <button onClick={() => setPageTitle({ title: 'New Title' })}>
          Update Title
        </button>
      )
    }

    render(
      <PageTitleProvider>
        <TestSetter title="Old Title" />
        <DynamicSetter />
        <TestConsumer />
      </PageTitleProvider>
    )

    expect(screen.getByTestId('title').textContent).toBe('Old Title')

    act(() => {
      screen.getByText('Update Title').click()
    })

    expect(screen.getByTestId('title').textContent).toBe('New Title')
  })

  it('throws error when usePageTitle is used outside provider', () => {
    // Suppress console.error for this test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestConsumer />)
    }).toThrow('usePageTitle must be used within a PageTitleProvider')

    consoleErrorSpy.mockRestore()
  })
})
