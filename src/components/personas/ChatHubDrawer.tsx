'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ChatFab } from './ChatFab'
import { ChatHub } from './ChatHub'
import { PersonaChatDrawer } from './PersonaChatDrawer'
import type { Persona } from './ChatHub'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface StatusChannel {
  channelName: string
  transcriptCount: number
  personaId: number | null
  personaCreatedAt: string | null
  personaName: string | null
  expertiseTopics: string[] | null
}

interface StatusResponse {
  channels: StatusChannel[]
  threshold: number
}

type Screen = 'hub' | 'chat'

// ── ChatHubDrawer ──────────────────────────────────────────────────────────────

export function ChatHubDrawer() {
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<Screen>('hub')
  const [activePersona, setActivePersona] = useState<Persona | null>(null)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch persona status on mount (deferred 1500ms)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/personas/status')
        if (!response.ok) {
          setIsLoading(false)
          return
        }
        const data: StatusResponse = await response.json()
        const activePersonas: Persona[] = data.channels
          .filter((c) => c.personaId !== null)
          .map((c) => ({
            id: c.personaId!,
            name: c.personaName ?? c.channelName,
            channelName: c.channelName,
            expertiseTopics: c.expertiseTopics ?? [],
          }))
        setPersonas(activePersonas)
      } catch {
        // Silently fail — chat hub is non-critical
      } finally {
        setIsLoading(false)
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  // Listen for persona-chat:open CustomEvent from PersonaStatus
  useEffect(() => {
    function handlePersonaChatOpen(event: Event) {
      const customEvent = event as CustomEvent<{
        personaId: number
        personaName: string
        expertiseTopics: string[]
      }>
      const { personaId, personaName, expertiseTopics } = customEvent.detail

      // Try to find the persona in our loaded list, fall back to detail data
      const found = personas.find((p) => p.id === personaId)
      const persona: Persona = found ?? {
        id: personaId,
        name: personaName,
        channelName: personaName,
        expertiseTopics: expertiseTopics ?? [],
      }

      setActivePersona(persona)
      setScreen('chat')
      setOpen(true)
    }

    window.addEventListener('persona-chat:open', handlePersonaChatOpen)
    return () => window.removeEventListener('persona-chat:open', handlePersonaChatOpen)
  }, [personas])

  function handleSelectPersona(persona: Persona) {
    setActivePersona(persona)
    setScreen('chat')
  }

  function handleBackToHub() {
    setScreen('hub')
    setActivePersona(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      // Reset to hub screen when drawer closes
      setScreen('hub')
      setActivePersona(null)
    }
  }

  const hasPersonas = personas.length > 0

  return (
    <>
      {/* FAB — visible when drawer is closed and personas exist */}
      <ChatFab
        visible={!open}
        hasPersonas={hasPersonas && !isLoading}
        onClick={() => {
          setScreen('hub')
          setOpen(true)
        }}
      />

      {/* Sheet */}
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          aria-describedby={undefined}
          className={cn(
            'flex flex-col p-0 gap-0',
            'md:w-[400px] md:max-w-[400px]',
            'max-md:w-screen max-md:max-w-none max-md:border-l-0'
          )}
        >
          {screen === 'hub' && (
            <>
              {/* Visually hidden title for accessibility — ChatHub renders its own visible header */}
              <SheetTitle className="sr-only">Chat hub</SheetTitle>
              <ChatHub
                personas={personas}
                isLoading={isLoading}
                onSelectPersona={handleSelectPersona}
                onClose={() => handleOpenChange(false)}
              />
            </>
          )}

          {screen === 'chat' && activePersona && (
            <PersonaChatDrawer
              open
              onOpenChange={(nextOpen) => {
                if (!nextOpen) handleOpenChange(false)
              }}
              personaId={activePersona.id}
              personaName={activePersona.name}
              expertiseTopics={activePersona.expertiseTopics}
              embedded
              onBack={handleBackToHub}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
