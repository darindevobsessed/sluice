import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, renderHook, act, waitFor } from '@testing-library/react'
import { SidebarProvider, useSidebar } from '../SidebarProvider'

describe('SidebarProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('default state', () => {
    it('should start with collapsed=false when no localStorage value', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      expect(result.current.collapsed).toBe(false)
    })

    it('should provide toggleSidebar function', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      expect(typeof result.current.toggleSidebar).toBe('function')
    })
  })

  describe('toggleSidebar', () => {
    it('should toggle collapsed from false to true', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      act(() => {
        result.current.toggleSidebar()
      })

      expect(result.current.collapsed).toBe(true)
    })

    it('should toggle collapsed from true to false', async () => {
      localStorage.setItem('sluice-sidebar-collapsed', 'true')

      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      // Wait for localStorage to be read
      await vi.waitFor(() => {
        expect(result.current.collapsed).toBe(true)
      })

      act(() => {
        result.current.toggleSidebar()
      })

      expect(result.current.collapsed).toBe(false)
    })

    it('should persist collapsed=true to localStorage', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      act(() => {
        result.current.toggleSidebar()
      })

      expect(localStorage.getItem('sluice-sidebar-collapsed')).toBe('true')
    })

    it('should persist collapsed=false to localStorage', () => {
      localStorage.setItem('sluice-sidebar-collapsed', 'true')

      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      act(() => {
        result.current.toggleSidebar()
      })

      expect(localStorage.getItem('sluice-sidebar-collapsed')).toBe('false')
    })
  })

  describe('localStorage persistence', () => {
    it('should load collapsed=true from localStorage after mount', async () => {
      localStorage.setItem('sluice-sidebar-collapsed', 'true')

      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      // Wait for useEffect to run and load from localStorage
      await waitFor(() => {
        expect(result.current.collapsed).toBe(true)
      })
    })

    it('should load collapsed=false from localStorage after mount', async () => {
      localStorage.setItem('sluice-sidebar-collapsed', 'false')

      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      // Should remain false
      expect(result.current.collapsed).toBe(false)
    })

    it('should handle missing localStorage gracefully', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage not available')
      })

      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      expect(result.current.collapsed).toBe(false)

      getItemSpy.mockRestore()
    })

    it('should handle invalid localStorage value gracefully', () => {
      localStorage.setItem('sluice-sidebar-collapsed', 'invalid')

      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      // Should default to false for non-'true' values
      expect(result.current.collapsed).toBe(false)
    })
  })

  describe('useSidebar hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useSidebar())
      }).toThrow('useSidebar must be used within a SidebarProvider')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('children rendering', () => {
    it('should render children correctly', () => {
      render(
        <SidebarProvider>
          <div data-testid="test-child">Test Child</div>
        </SidebarProvider>
      )

      expect(screen.getByTestId('test-child')).toBeInTheDocument()
    })
  })

  describe('mobile sidebar state', () => {
    it('should start with mobileOpen=false by default', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      expect(result.current.mobileOpen).toBe(false)
    })

    it('should provide toggleMobile function', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      expect(typeof result.current.toggleMobile).toBe('function')
    })

    it('should provide closeMobile function', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      expect(typeof result.current.closeMobile).toBe('function')
    })
  })

  describe('toggleMobile', () => {
    it('should toggle mobileOpen from false to true', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      act(() => {
        result.current.toggleMobile()
      })

      expect(result.current.mobileOpen).toBe(true)
    })

    it('should toggle mobileOpen from true to false', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      act(() => {
        result.current.toggleMobile()
      })
      expect(result.current.mobileOpen).toBe(true)

      act(() => {
        result.current.toggleMobile()
      })
      expect(result.current.mobileOpen).toBe(false)
    })

    it('should not persist mobileOpen to localStorage', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      act(() => {
        result.current.toggleMobile()
      })

      expect(localStorage.getItem('sluice-sidebar-mobile-open')).toBeNull()
    })

    it('should be independent from collapsed state', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      act(() => {
        result.current.toggleSidebar()
      })
      expect(result.current.collapsed).toBe(true)
      expect(result.current.mobileOpen).toBe(false)

      act(() => {
        result.current.toggleMobile()
      })
      expect(result.current.collapsed).toBe(true)
      expect(result.current.mobileOpen).toBe(true)
    })
  })

  describe('closeMobile', () => {
    it('should close mobile sidebar when open', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      act(() => {
        result.current.toggleMobile()
      })
      expect(result.current.mobileOpen).toBe(true)

      act(() => {
        result.current.closeMobile()
      })
      expect(result.current.mobileOpen).toBe(false)
    })

    it('should do nothing when mobile sidebar already closed', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      })

      expect(result.current.mobileOpen).toBe(false)

      act(() => {
        result.current.closeMobile()
      })
      expect(result.current.mobileOpen).toBe(false)
    })
  })
})
