import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../tooltip'

describe('Tooltip', () => {
  it('should render tooltip with trigger and content', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <button>Trigger</button>
          </TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    expect(screen.getByText('Trigger')).toBeInTheDocument()
  })

  it('should render with side prop', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <button>Trigger</button>
          </TooltipTrigger>
          <TooltipContent side="right">Right side content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    expect(screen.getByText('Trigger')).toBeInTheDocument()
  })

  it('should accept custom className on content', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <button>Trigger</button>
          </TooltipTrigger>
          <TooltipContent className="custom-class">Content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    expect(screen.getByText('Trigger')).toBeInTheDocument()
  })
})
