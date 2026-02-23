import { useCallback, useEffect, useRef, useState } from 'react'
import type { WireMockRequest, WireMockMapping, RequestsResponse, MappingsResponse, InitialMappingData } from '../types.ts'
import RequestDrawer from './RequestDrawer.tsx'
import MappingDrawer from './MappingDrawer.tsx'
import NewMappingModal from './NewMappingModal.tsx'
import '../styles/RequestsList.css'

const POLL_INTERVAL = 3000
const LIMIT_OPTIONS = [20, 50, 100, 200] as const

const METHOD_COLORS: Record<string, string> = {
  GET: 'badge-blue',
  POST: 'badge-green',
  PUT: 'badge-orange',
  PATCH: 'badge-yellow',
  DELETE: 'badge-red',
  HEAD: 'badge-purple',
  OPTIONS: 'badge-gray',
}

interface Props {
  instanceUrl: string
}

export default function RequestsList({ instanceUrl }: Props) {
  const [requests, setRequests] = useState<WireMockRequest[]>([])
  const [totalRequests, setTotalRequests] = useState(0)
  const [selectedRequest, setSelectedRequest] = useState<WireMockRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [limit, setLimit] = useState(100)
  const [searchAll, setSearchAll] = useState(false)
  const [viewMapping, setViewMapping] = useState<WireMockMapping | null>(null)
  const [isCreateStubOpen, setIsCreateStubOpen] = useState(false)
  const [createStubData, setCreateStubData] = useState<InitialMappingData | undefined>(undefined)
  const prevRequestRef = useRef<WireMockRequest | null>(null)
  const limitRef = useRef(limit)
  const searchAllRef = useRef(searchAll)

  const fetchRequests = useCallback(async () => {
    try {
      const url = searchAllRef.current
        ? `${instanceUrl}/__admin/requests`
        : `${instanceUrl}/__admin/requests?limit=${limitRef.current}`
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? `HTTP ${res.status}`)
        return
      }
      const data: RequestsResponse = await res.json()
      setRequests(data.requests ?? [])
      setTotalRequests(data.meta?.total ?? 0)
      setLastUpdated(new Date())
      setError(null)
    } catch {
      setError('Network error — could not reach the server.')
    }
  }, [instanceUrl])

  const handleCloseDrawer = useCallback(() => setSelectedRequest(null), [])
  const handleCloseMappingDrawer = useCallback(() => setViewMapping(null), [])

  const handleStubClick = useCallback(async (stubId: string) => {
    try {
      const res = await fetch(`${instanceUrl}/__admin/mappings`)
      if (!res.ok) return
      const data: MappingsResponse = await res.json()
      const mapping = (data.mappings ?? []).find((m) => m.id === stubId)
      if (mapping) {
        prevRequestRef.current = selectedRequest
        setSelectedRequest(null)
        setViewMapping(mapping)
      }
    } catch { /* ignore */ }
  }, [instanceUrl, selectedRequest])

  const handleMappingBack = useCallback(() => {
    setViewMapping(null)
    setSelectedRequest(prevRequestRef.current)
    prevRequestRef.current = null
  }, [])

  const handleCreateStub = useCallback((req: WireMockRequest) => {
    const url = new URL(req.request.absoluteUrl)

    let bodyPatterns: InitialMappingData['bodyPatterns']
    if (req.request.body && req.request.body.trim().length > 0) {
      const isJson = (() => {
        try { JSON.parse(req.request.body); return true } catch { return false }
      })()
      bodyPatterns = [{ operator: isJson ? 'equalToJson' : 'equalTo', value: req.request.body }]
    }

    setCreateStubData({
      method: req.request.method,
      urlMatchType: 'url',
      urlValue: url.pathname + url.search,
      status: req.responseDefinition.status,
      body: req.responseDefinition.body,
      responseHeaders: [{ key: 'Content-Type', value: 'application/json' }],
      bodyPatterns,
    })
    setIsCreateStubOpen(true)
  }, [])

  const handleStubCreated = useCallback(() => {
    setIsCreateStubOpen(false)
    setCreateStubData(undefined)
    setSelectedRequest(null)
  }, [])

  // Immediate fetch + state reset on instance switch
  useEffect(() => {
    setRequests([])
    setTotalRequests(0)
    setError(null)
    setLastUpdated(null)
    setSearchQuery('')
    setSearchAll(false)
    searchAllRef.current = false
    setSelectedRequest(null)
    setIsCreateStubOpen(false)
    setCreateStubData(undefined)
    fetchRequests()
  }, [instanceUrl, fetchRequests])

  // Re-fetch when limit changes (no state reset)
  useEffect(() => {
    limitRef.current = limit
    fetchRequests()
  }, [limit, fetchRequests])

  // Re-fetch when searchAll changes
  useEffect(() => {
    searchAllRef.current = searchAll
    fetchRequests()
  }, [searchAll, fetchRequests])

  // Always poll
  useEffect(() => {
    const id = setInterval(fetchRequests, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchRequests])

  const filteredRequests = requests.filter((req) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      req.request.url.toLowerCase().includes(q) ||
      req.request.method.toLowerCase().includes(q)
    )
  })

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const formatLoggedDate = (ms: number) =>
    new Date(ms).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

  return (
    <div className="requests-list">
      <div className="search-toolbar">
        <div className="search-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search method or URL…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (!e.target.value) setSearchAll(false)
            }}
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => { setSearchQuery(''); setSearchAll(false) }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        {searchQuery && !searchAll && totalRequests > requests.length && (
          <div className="search-all-hint">
            Searching {requests.length} of {totalRequests} requests ·{' '}
            <button className="search-all-btn" onClick={() => setSearchAll(true)}>
              Search all {totalRequests}
            </button>
          </div>
        )}
        {searchQuery && searchAll && (
          <div className="search-all-hint active">
            Searching all {totalRequests} requests
          </div>
        )}
      </div>

      <div className="requests-toolbar">
        <span className="requests-count">
          {searchQuery ? (
            <>
              <span className="count-num">{filteredRequests.length}</span>
              {` of ${requests.length} request${requests.length !== 1 ? 's' : ''}`}
            </>
          ) : (
            <>
              <span className="count-num">{requests.length}</span>
              {` request${requests.length !== 1 ? 's' : ''}`}
            </>
          )}
        </span>
        <label className="limit-label">
          Limit
          <select
            className="limit-select"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        {lastUpdated && (
          <span className="last-updated">Updated {formatTime(lastUpdated)}</span>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {requests.length === 0 && !error ? (
        <p className="empty-state">No requests recorded yet.</p>
      ) : filteredRequests.length === 0 ? (
        <p className="empty-state">No requests match your search.</p>
      ) : (
        <div className="table-wrapper">
          <table className="requests-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>URL</th>
                <th>Status</th>
                <th>Matched</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req) => (
                <tr
                  key={req.id}
                  className={`${req.wasMatched ? '' : 'row-unmatched'} ${req.id === selectedRequest?.id ? 'row-selected' : ''}`.trim()}
                  onClick={() => setSelectedRequest(req)}
                >
                  <td>
                    <span className={`badge method-badge ${METHOD_COLORS[req.request.method] ?? 'badge-gray'}`}>
                      {req.request.method}
                    </span>
                  </td>
                  <td className="url-cell" title={req.request.url}>
                    {req.request.url}
                  </td>
                  <td className="status-cell">{req.responseDefinition.status}</td>
                  <td>
                    <span className={`badge ${req.wasMatched ? 'badge-matched' : 'badge-unmatched'}`}>
                      {req.wasMatched ? 'Matched' : 'Unmatched'}
                    </span>
                  </td>
                  <td className="date-cell">
                    {req.request.loggedDate != null ? formatLoggedDate(req.request.loggedDate) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <RequestDrawer request={selectedRequest} onClose={handleCloseDrawer} onStubClick={handleStubClick} onCreateStub={handleCreateStub} />
      <MappingDrawer
        mapping={viewMapping}
        instanceUrl={instanceUrl}
        onClose={handleCloseMappingDrawer}
        onMappingUpdated={(updated) => setViewMapping(updated)}
        onMappingDeleted={() => setViewMapping(null)}
        onBack={handleMappingBack}
      />
      <NewMappingModal
        open={isCreateStubOpen}
        instanceUrl={instanceUrl}
        onClose={() => { setIsCreateStubOpen(false); setCreateStubData(undefined) }}
        onCreated={handleStubCreated}
        initialData={createStubData}
      />
    </div>
  )
}
