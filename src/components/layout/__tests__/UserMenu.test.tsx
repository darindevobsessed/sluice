import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock auth-client
const mockUseSession = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/lib/auth-client', () => ({
  useSession: () => mockUseSession(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}))

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('in non-production mode (default test env)', () => {
    it('renders nothing regardless of session state', async () => {
      mockUseSession.mockReturnValue({
        data: { user: { email: 'user@devobsessed.com', name: 'Test User' } },
      })
      const { UserMenu } = await import('../UserMenu')
      const { container } = render(<UserMenu />)
      expect(container.innerHTML).toBe('')
    })
  })

  describe('in production mode', () => {
    let UserMenuProd: typeof import('../UserMenu').UserMenu

    beforeEach(async () => {
      vi.resetModules()
      vi.doMock('@/lib/auth-client', () => ({
        useSession: () => mockUseSession(),
        signOut: (...args: unknown[]) => mockSignOut(...args),
      }))
      vi.stubEnv('NODE_ENV', 'production')
      const mod = await import('../UserMenu')
      UserMenuProd = mod.UserMenu
    })

    it('renders nothing when not authenticated', () => {
      mockUseSession.mockReturnValue({ data: null })
      const { container } = render(<UserMenuProd />)
      expect(container.innerHTML).toBe('')
    })

    it('renders avatar with user initial when authenticated', () => {
      mockUseSession.mockReturnValue({
        data: { user: { email: 'user@devobsessed.com', name: 'Test User' } },
      })
      render(<UserMenuProd />)
      expect(screen.getByLabelText('User menu')).toBeInTheDocument()
      expect(screen.getByText('T')).toBeInTheDocument()
    })

    it('uses email initial when name is missing', () => {
      mockUseSession.mockReturnValue({
        data: { user: { email: 'user@devobsessed.com', name: null } },
      })
      render(<UserMenuProd />)
      expect(screen.getByText('U')).toBeInTheDocument()
    })

    it('opens dropdown with user info and sign out', async () => {
      mockUseSession.mockReturnValue({
        data: { user: { email: 'user@devobsessed.com', name: 'Test User' } },
      })
      const user = userEvent.setup()
      render(<UserMenuProd />)
      await user.click(screen.getByLabelText('User menu'))
      expect(screen.getByText('Test User')).toBeInTheDocument()
      expect(screen.getByText('user@devobsessed.com')).toBeInTheDocument()
      expect(screen.getByText('Sign out')).toBeInTheDocument()
    })

    it('calls signOut when sign out is clicked', async () => {
      mockUseSession.mockReturnValue({
        data: { user: { email: 'user@devobsessed.com', name: 'Test User' } },
      })
      mockSignOut.mockResolvedValue(undefined)
      const user = userEvent.setup()
      render(<UserMenuProd />)
      await user.click(screen.getByLabelText('User menu'))
      await user.click(screen.getByText('Sign out'))
      expect(mockSignOut).toHaveBeenCalled()
    })
  })
})
