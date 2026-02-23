import { useEffect, useState } from 'react'
import type { WireMockInstance } from './types.ts'
import InstanceSwitcher from './components/InstanceSwitcher.tsx'
import RequestsList from './components/RequestsList.tsx'
import MappingsList from './components/MappingsList.tsx'

type Theme = 'dark' | 'light'
type View = 'requests' | 'mappings'

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

const rawUrls = import.meta.env.VITE_WIREMOCK_URLS ?? ''
const instances: WireMockInstance[] = rawUrls
  .split(',')
  .map((u: string) => u.trim())
  .filter(Boolean)
  .map((url: string, index: number) => ({
    id: String(index),
    label: new URL(url).host,
    url,
  }))

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(
    instances.length > 0 ? instances[0].id : null
  )
  const [view, setView] = useState<View>('requests')

  // Initialise theme from localStorage (or system preference), applied
  // synchronously inside the initialiser to avoid a flash of wrong theme.
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme')
    const t: Theme =
      saved === 'light' ? 'light'
      : saved === 'dark' ? 'dark'
      : window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', t)
    return t
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    setView('requests')
  }, [selectedId])

  const selectedInstance = instances.find((i) => i.id === selectedId) ?? null

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <svg className="brand-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 4H3v16h2" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 4h2v16h-2" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
            <circle cx="12" cy="12" r="2.5" fill="#22d3ee" />
          </svg>
          <h1>WireMock UI</h1>
        </div>
        {instances.length > 0 && (
          <>
            <div className="header-divider" />
            <InstanceSwitcher
              instances={instances}
              selectedId={selectedId}
              onChange={setSelectedId}
            />
          </>
        )}
        <button
          className="theme-toggle"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>
      {selectedInstance !== null && (
        <nav className="app-tabs">
          <button
            className={`tab-btn${view === 'requests' ? ' active' : ''}`}
            onClick={() => setView('requests')}
          >
            Requests
          </button>
          <button
            className={`tab-btn${view === 'mappings' ? ' active' : ''}`}
            onClick={() => setView('mappings')}
          >
            Mappings
          </button>
        </nav>
      )}
      <main className="app-main">
        {selectedInstance !== null ? (
          view === 'requests'
            ? <RequestsList instanceUrl={selectedInstance.url} />
            : <MappingsList instanceUrl={selectedInstance.url} />
        ) : (
          <p className="empty-state">No WireMock instances configured. Set <code>VITE_WIREMOCK_URLS</code> in your <code>.env</code> file.</p>
        )}
      </main>
    </div>
  )
}
