import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Discovery | Sluice',
}

export default function DiscoveryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
