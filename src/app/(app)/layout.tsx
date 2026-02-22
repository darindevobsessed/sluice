import { Sidebar } from "@/components/layout/Sidebar"
import { MainContent } from "@/components/layout/MainContent"
import { AgentProvider } from "@/lib/agent/AgentProvider"
import { ExtractionProvider } from "@/components/providers/ExtractionProvider"
import { FocusAreaProvider } from "@/components/providers/FocusAreaProvider"
import { SidebarProvider } from "@/components/providers/SidebarProvider"
import { SidebarDataProvider } from "@/components/providers/SidebarDataProvider"
import { TooltipProvider } from "@/components/ui/tooltip"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AgentProvider>
      <ExtractionProvider>
        <SidebarProvider>
          <SidebarDataProvider>
            <FocusAreaProvider>
              <TooltipProvider>
                <Sidebar />
                <MainContent>{children}</MainContent>
              </TooltipProvider>
            </FocusAreaProvider>
          </SidebarDataProvider>
        </SidebarProvider>
      </ExtractionProvider>
    </AgentProvider>
  )
}
