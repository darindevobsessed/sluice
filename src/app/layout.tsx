import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainContent } from "@/components/layout/MainContent";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AgentProvider } from "@/lib/agent/AgentProvider";
import { ExtractionProvider } from "@/components/providers/ExtractionProvider";
import { FocusAreaProvider } from "@/components/providers/FocusAreaProvider";
import { SidebarProvider } from "@/components/providers/SidebarProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gold Miner",
  description: "Extract knowledge from YouTube videos and generate Claude Code plugins",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased font-sans`}
      >
        <ThemeProvider>
          <AgentProvider>
            <ExtractionProvider>
              <FocusAreaProvider>
                <SidebarProvider>
                  <TooltipProvider>
                    <Sidebar />
                    <MainContent>{children}</MainContent>
                  </TooltipProvider>
                </SidebarProvider>
              </FocusAreaProvider>
            </ExtractionProvider>
          </AgentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
