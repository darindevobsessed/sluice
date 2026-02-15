'use client'

import { PageTitleProvider, usePageTitle } from './PageTitleContext'
import { TopBar } from './TopBar'
import { FocusAreaDropdown } from './FocusAreaDropdown'
import { useSidebar } from '@/components/providers/SidebarProvider'

function MainContentInner({ children }: { children: React.ReactNode }) {
  const { title, backHref, backLabel } = usePageTitle()
  const { collapsed } = useSidebar()

  return (
    <div
      className={`main-content-container flex min-h-screen flex-col ${collapsed ? 'md:ml-16' : 'md:ml-60'}`}
    >
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
