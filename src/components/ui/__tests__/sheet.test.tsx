import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '../sheet'

describe('Sheet', () => {
  it('renders sheet content when open', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Sheet Title</SheetTitle>
        </SheetContent>
      </Sheet>
    )

    expect(screen.getByText('Sheet Title')).toBeInTheDocument()
  })

  it('renders SheetContent with correct data-slot attribute', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Content</SheetTitle>
        </SheetContent>
      </Sheet>
    )

    const content = document.querySelector('[data-slot="sheet-content"]')
    expect(content).toBeInTheDocument()
  })

  it('renders SheetTitle with correct data-slot attribute', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>My Title</SheetTitle>
        </SheetContent>
      </Sheet>
    )

    const title = document.querySelector('[data-slot="sheet-title"]')
    expect(title).toBeInTheDocument()
    expect(title).toHaveTextContent('My Title')
  })

  it('renders SheetDescription with correct data-slot attribute', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <SheetDescription>Sheet description text</SheetDescription>
        </SheetContent>
      </Sheet>
    )

    const description = document.querySelector('[data-slot="sheet-description"]')
    expect(description).toBeInTheDocument()
    expect(description).toHaveTextContent('Sheet description text')
  })

  it('renders close button inside SheetContent', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
        </SheetContent>
      </Sheet>
    )

    const closeButton = screen.getByRole('button', { name: /close/i })
    expect(closeButton).toBeInTheDocument()
  })

  it('renders SheetHeader with correct data-slot attribute', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Header Title</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    )

    const header = document.querySelector('[data-slot="sheet-header"]')
    expect(header).toBeInTheDocument()
  })

  it('renders SheetFooter with correct data-slot attribute', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <SheetFooter>
            <button>Confirm</button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )

    const footer = document.querySelector('[data-slot="sheet-footer"]')
    expect(footer).toBeInTheDocument()
  })

  it('applies right side variant classes by default', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
        </SheetContent>
      </Sheet>
    )

    const content = document.querySelector('[data-slot="sheet-content"]')
    expect(content?.className).toContain('right-0')
    expect(content?.className).toContain('inset-y-0')
  })

  it('applies left side variant classes when side="left"', () => {
    render(
      <Sheet open>
        <SheetContent side="left">
          <SheetTitle>Title</SheetTitle>
        </SheetContent>
      </Sheet>
    )

    const content = document.querySelector('[data-slot="sheet-content"]')
    expect(content?.className).toContain('left-0')
    expect(content?.className).toContain('border-r')
  })

  it('renders SheetTrigger and SheetClose as part of the sheet', () => {
    render(
      <Sheet>
        <SheetTrigger asChild>
          <button>Open Sheet</button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <SheetClose asChild>
            <button>Close Sheet</button>
          </SheetClose>
        </SheetContent>
      </Sheet>
    )

    expect(screen.getByRole('button', { name: 'Open Sheet' })).toBeInTheDocument()
  })
})
