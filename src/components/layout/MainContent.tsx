export function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main className="ml-60 min-h-screen overflow-y-auto">
      {children}
    </main>
  );
}
