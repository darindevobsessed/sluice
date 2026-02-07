'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface PageTitleState {
  title: string
  backHref?: string
  backLabel?: string
}

interface PageTitleContextValue extends PageTitleState {
  setPageTitle: (state: PageTitleState) => void
}

const PageTitleContext = createContext<PageTitleContextValue | undefined>(undefined)

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PageTitleState>({
    title: '',
    backHref: undefined,
    backLabel: undefined,
  })

  const setPageTitle = useCallback((newState: PageTitleState) => {
    setState(newState)
  }, [])

  return (
    <PageTitleContext.Provider
      value={{
        ...state,
        setPageTitle,
      }}
    >
      {children}
    </PageTitleContext.Provider>
  )
}

export function usePageTitle() {
  const context = useContext(PageTitleContext)
  if (context === undefined) {
    throw new Error('usePageTitle must be used within a PageTitleProvider')
  }
  return context
}
