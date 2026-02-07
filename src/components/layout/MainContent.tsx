'use client'

import { PageTitleProvider, usePageTitle } from './PageTitleContext'
import { TopBar } from './TopBar'
import { FocusAreaDropdown } from './FocusAreaDropdown'

function MainContentInner({ children }: { children: React.ReactNode }) {
  const { title, backHref, backLabel } = usePageTitle()

  return (
    <div className="ml-60 flex min-h-screen flex-col">
      <TopBar title={title} backHref={backHref} backLabel={backLabel}>
        <FocusAreaDropdown />
      </TopBar>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

export function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <PageTitleProvider>
      <MainContentInner>{children}</MainContentInner>
    </PageTitleProvider>
  )
}
