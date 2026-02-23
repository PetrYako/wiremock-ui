import { useCallback, useEffect, useRef, useState } from 'react'
import type { WireMockMapping, MappingsResponse, InitialMappingData, BodyPattern, BodyPatternOperator } from '../types.ts'
import MappingDrawer from './MappingDrawer.tsx'
import NewMappingModal from './NewMappingModal.tsx'
import '../styles/RequestsList.css'
import '../styles/MappingsList.css'

const METHOD_COLORS: Record<string, string> = {
  GET: 'badge-blue',
  POST: 'badge-green',
  PUT: 'badge-orange',
  PATCH: 'badge-yellow',
  DELETE: 'badge-red',
  HEAD: 'badge-purple',
  OPTIONS: 'badge-gray',
}

function getMappingUrl(req: WireMockMapping['request']): string {
  return req.url ?? req.urlPath ?? req.urlPattern ?? req.urlPathPattern ?? '(any)'
}

function isPattern(req: WireMockMapping['request']): boolean {
  return !!(req.urlPattern ?? req.urlPathPattern)
}

function statusColorClass(status: number): string {
  if (status >= 200 && status < 300) return 'status-2xx'
  if (status >= 300 && status < 400) return 'status-3xx'
  if (status >= 400 && status < 500) return 'status-4xx'
  if (status >= 500) return 'status-5xx'
  return ''
}

function mappingToInitialData(mapping: WireMockMapping): InitialMappingData {
  const req = mapping.request
  const urlMatchType: InitialMappingData['urlMatchType'] =
    req.url != null ? 'url'
    : req.urlPath != null ? 'urlPath'
    : req.urlPattern != null ? 'urlPattern'
    : 'urlPathPattern'
  const responseHeaders = mapping.response.headers
    ? Object.entries(mapping.response.headers).map(([key, value]) => ({ key, value }))
    : []
  const bodyPatterns: BodyPattern[] = (req.bodyPatterns ?? []).map((p) => {
    const operator = Object.keys(p)[0] as BodyPatternOperator
    return { operator, value: String(p[operator]) }
  })
  return {
    method: req.method ?? 'ANY',
    urlMatchType,
    urlValue: (req[urlMatchType] as string) ?? '',
    status: mapping.response.status,
    body: mapping.response.body ?? '',
    responseHeaders,
    bodyPatterns,
    delay: mapping.response.fixedDelayMilliseconds,
    priority: mapping.priority,
    responseTemplating: mapping.response.transformers?.includes('response-template') ?? false,
  }
}

interface Props {
  instanceUrl: string
}

export default function MappingsList({ instanceUrl }: Props) {
  const [mappings, setMappings] = useState<WireMockMapping[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMapping, setSelectedMapping] = useState<WireMockMapping | null>(null)
  const [isNewMappingOpen, setIsNewMappingOpen] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [cloneMappingData, setCloneMappingData] = useState<InitialMappingData | null>(null)

  const selectAllRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const fetchMappings = useCallback(async () => {
    try {
      const res = await fetch(`${instanceUrl}/__admin/mappings`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? `HTTP ${res.status}`)
        return
      }
      const data: MappingsResponse = await res.json()
      setMappings(data.mappings ?? [])
      setLastUpdated(new Date())
      setError(null)
    } catch {
      setError('Network error — could not reach the server.')
    }
  }, [instanceUrl])

  const handleCloseDrawer = useCallback(() => setSelectedMapping(null), [])

  useEffect(() => {
    setMappings([])
    setError(null)
    setLastUpdated(null)
    setSearchQuery('')
    setSelectedMapping(null)
    setConfirmingDeleteId(null)
    setDeletingId(null)
    setSelectedIds(new Set())
    setConfirmBulkDelete(false)
    setBulkDeleting(false)
    setImportError(null)
    setImportResult(null)
    fetchMappings()
  }, [instanceUrl, fetchMappings])

  const filteredMappings = mappings.filter((m) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const url = getMappingUrl(m.request).toLowerCase()
    const method = (m.request.method ?? 'ANY').toLowerCase()
    return url.includes(q) || method.includes(q)
  })

  const allFilteredSelected =
    filteredMappings.length > 0 && filteredMappings.every((m) => selectedIds.has(m.id))
  const someFilteredSelected = filteredMappings.some((m) => selectedIds.has(m.id))

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected && !allFilteredSelected
    }
  }, [someFilteredSelected, allFilteredSelected])

  useEffect(() => {
    if (selectedIds.size === 0) setConfirmBulkDelete(false)
  }, [selectedIds.size])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredMappings.map((m) => m.id)))
    }
  }

  async function handleDeleteMapping(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`${instanceUrl}/__admin/mappings/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? `HTTP ${res.status}`)
        setConfirmingDeleteId(null)
        return
      }
      setMappings((prev) => prev.filter((m) => m.id !== id))
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next })
      if (selectedMapping?.id === id) setSelectedMapping(null)
      setConfirmingDeleteId(null)
    } catch {
      setError('Network error — could not reach the server.')
      setConfirmingDeleteId(null)
    } finally {
      setDeletingId(null)
    }
  }

  function handleExportSelected() {
    const toExport = mappings.filter((m) => selectedIds.has(m.id))
    const blob = new Blob(
      [JSON.stringify({ mappings: toExport }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mappings-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportError(null)
    setImportResult(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed?.mappings)) {
        setImportError('Invalid file: expected { "mappings": [...] }')
        return
      }
      const existingIds = new Set(mappings.map((m) => m.id))
      const updatedCount = parsed.mappings.filter((m: { id?: string }) => m.id && existingIds.has(m.id)).length
      const newCount = parsed.mappings.length - updatedCount
      const res = await fetch(`${instanceUrl}/__admin/mappings/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setImportError((body as { error?: string }).error ?? `HTTP ${res.status}`)
        return
      }
      await fetchMappings()
      const total = parsed.mappings.length
      const parts: string[] = []
      if (newCount > 0) parts.push(`${newCount} created`)
      if (updatedCount > 0) parts.push(`${updatedCount} updated`)
      setImportResult(`Imported ${total} mapping${total !== 1 ? 's' : ''}${parts.length ? `: ${parts.join(', ')}` : ''}`)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    const ids = [...selectedIds]
    const results = await Promise.allSettled(
      ids.map((id) => fetch(`${instanceUrl}/__admin/mappings/${id}`, { method: 'DELETE' }))
    )
    const deleted: string[] = []
    const failed: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.ok) deleted.push(ids[i])
      else failed.push(ids[i])
    })
    if (deleted.length > 0) {
      setMappings((prev) => prev.filter((m) => !deleted.includes(m.id)))
      if (selectedMapping && deleted.includes(selectedMapping.id)) setSelectedMapping(null)
    }
    setSelectedIds(new Set(failed))
    if (failed.length > 0) {
      setError(`Failed to delete ${failed.length} mapping${failed.length !== 1 ? 's' : ''}.`)
    }
    setConfirmBulkDelete(false)
    setBulkDeleting(false)
  }

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="mappings-list">
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
      <div className="search-toolbar">
        <div className="search-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search method or URL…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="mappings-toolbar">
        <span className="mappings-count">
          {searchQuery ? (
            <>
              <span className="count-num">{filteredMappings.length}</span>
              {` of ${mappings.length} mapping${mappings.length !== 1 ? 's' : ''}`}
            </>
          ) : (
            <>
              <span className="count-num">{mappings.length}</span>
              {` mapping${mappings.length !== 1 ? 's' : ''}`}
            </>
          )}
        </span>
        <button className="btn-new-mapping" onClick={() => setIsNewMappingOpen(true)}>
          + New Mapping
        </button>
        <button
          className="btn-import-mappings"
          onClick={() => importInputRef.current?.click()}
          disabled={importing}
        >
          {importing ? 'Importing…' : 'Import'}
        </button>
        {selectedIds.size > 0 && (
          <button className="btn-export-selected" onClick={handleExportSelected}>
            Export selected ({selectedIds.size})
          </button>
        )}
        <button className="btn-refresh" onClick={fetchMappings}>
          Refresh
        </button>
        {!confirmBulkDelete ? (
          <button
            className="btn-delete-selected"
            disabled={selectedIds.size === 0}
            onClick={() => setConfirmBulkDelete(true)}
          >
            Delete selected{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
        ) : (
          <div className="bulk-confirm-inline">
            <span className="bulk-delete-label">
              Delete {selectedIds.size} mapping{selectedIds.size !== 1 ? 's' : ''}?
            </span>
            <button
              className="btn-bulk-delete-confirm"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              className="btn-bulk-delete-cancel"
              onClick={() => setConfirmBulkDelete(false)}
              disabled={bulkDeleting}
            >
              Cancel
            </button>
          </div>
        )}
        {lastUpdated && (
          <span className="last-updated">Updated {formatTime(lastUpdated)}</span>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}
      {importError && <div className="error-banner">{importError}</div>}
      {importResult && <div className="success-banner">{importResult}</div>}

      {mappings.length === 0 && !error ? (
        <p className="empty-state">No mappings configured.</p>
      ) : filteredMappings.length === 0 ? (
        <p className="empty-state">No mappings match your search.</p>
      ) : (
        <div className="table-wrapper">
          <table className="mappings-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th>Method</th>
                <th>URL / Pattern</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredMappings.map((m) => {
                const url = getMappingUrl(m.request)
                const pattern = isPattern(m.request)
                const confirming = confirmingDeleteId === m.id
                const deleting = deletingId === m.id
                const checked = selectedIds.has(m.id)
                return (
                  <tr
                    key={m.id}
                    className={[
                      m.id === selectedMapping?.id ? 'row-selected-mapping' : '',
                      checked ? 'row-checked' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => { setConfirmingDeleteId(null); setSelectedMapping(m) }}
                  >
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(m.id)}
                        aria-label="Select mapping"
                      />
                    </td>
                    <td>
                      <span className={`badge method-badge ${METHOD_COLORS[m.request.method ?? ''] ?? 'badge-gray'}`}>
                        {m.request.method ?? 'ANY'}
                      </span>
                    </td>
                    <td className={`url-cell${pattern ? ' url-pattern' : ''}`} title={url}>
                      {pattern && <span className="url-pattern-prefix">~</span>}
                      {url}
                    </td>
                    <td>
                      <span className={`mapping-status ${statusColorClass(m.response.status)}`}>
                        {m.response.status}
                      </span>
                    </td>
                    <td className="row-actions-cell" onClick={(e) => e.stopPropagation()}>
                      {confirming ? (
                        <div className="row-delete-confirm">
                          <span className="row-delete-label">Delete?</span>
                          <button
                            className="btn-row-delete-confirm"
                            onClick={() => handleDeleteMapping(m.id)}
                            disabled={deleting}
                          >
                            {deleting ? '…' : 'Yes'}
                          </button>
                          <button
                            className="btn-row-delete-cancel"
                            onClick={() => setConfirmingDeleteId(null)}
                            disabled={deleting}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="row-actions-group">
                          <button
                            className="btn-row-clone"
                            aria-label="Clone mapping"
                            title="Clone"
                            onClick={(e) => { e.stopPropagation(); setCloneMappingData(mappingToInitialData(m)) }}
                          >
                            ⧉
                          </button>
                          <button
                            className="btn-row-delete"
                            aria-label="Delete mapping"
                            onClick={() => { setConfirmingDeleteId(m.id); setSelectedMapping(null) }}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <MappingDrawer
        mapping={selectedMapping}
        instanceUrl={instanceUrl}
        onClose={handleCloseDrawer}
        onMappingUpdated={(updated) => {
          setMappings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
          setSelectedMapping(updated)
        }}
        onMappingDeleted={(id) => {
          setMappings((prev) => prev.filter((m) => m.id !== id))
          setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next })
          setSelectedMapping(null)
        }}
      />
      <NewMappingModal
        open={isNewMappingOpen}
        instanceUrl={instanceUrl}
        onClose={() => setIsNewMappingOpen(false)}
        onCreated={(created) => {
          setMappings((prev) => [created, ...prev])
          setIsNewMappingOpen(false)
        }}
        initialData={{ responseHeaders: [{ key: 'Content-Type', value: 'application/json' }] }}
      />
      <NewMappingModal
        open={cloneMappingData !== null}
        instanceUrl={instanceUrl}
        onClose={() => setCloneMappingData(null)}
        onCreated={(created) => {
          setMappings((prev) => [created, ...prev])
          setCloneMappingData(null)
        }}
        initialData={cloneMappingData ?? undefined}
        title="Clone Mapping"
      />
    </div>
  )
}
