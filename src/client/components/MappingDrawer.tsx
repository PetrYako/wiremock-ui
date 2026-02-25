import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WireMockMapping } from '../types.ts'
import '../styles/RequestDrawer.css'
import NewMappingModal from './NewMappingModal.tsx'

const METHOD_COLORS: Record<string, string> = {
  GET: 'badge-blue',
  POST: 'badge-green',
  PUT: 'badge-orange',
  PATCH: 'badge-yellow',
  DELETE: 'badge-red',
  HEAD: 'badge-purple',
  OPTIONS: 'badge-gray',
}

function prettyBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

function statusColorClass(status: number): string {
  if (status >= 200 && status < 300) return 'status-2xx'
  if (status >= 300 && status < 400) return 'status-3xx'
  if (status >= 400 && status < 500) return 'status-4xx'
  if (status >= 500) return 'status-5xx'
  return ''
}

function getUrlType(req: WireMockMapping['request']): { label: string; value: string } {
  if (req.url != null) return { label: 'URL (exact)', value: req.url }
  if (req.urlPath != null) return { label: 'URL path', value: req.urlPath }
  if (req.urlPattern != null) return { label: 'URL pattern', value: req.urlPattern }
  if (req.urlPathPattern != null) return { label: 'URL path pattern', value: req.urlPathPattern }
  return { label: 'URL', value: '(any)' }
}

interface Props {
  mapping: WireMockMapping | null
  instanceUrl: string
  onClose: () => void
  onMappingUpdated: (updated: WireMockMapping) => void
  onMappingDeleted: (id: string) => void
  onBack?: () => void
}

export default function MappingDrawer({ mapping, instanceUrl, onClose, onMappingUpdated, onMappingDeleted, onBack }: Props) {
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapping) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [mapping, onClose])

  useEffect(() => {
    setEditModalOpen(false)
    setConfirmDelete(false)
    setDeleting(false)
    setDeleteError(null)
  }, [mapping?.id])

  function handleExportSingle() {
    if (!mapping) return
    const blob = new Blob(
      [JSON.stringify({ mappings: [mapping] }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mapping-${mapping.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDelete() {
    if (!mapping) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`${instanceUrl}/__admin/mappings/${mapping.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setDeleteError((data as { error?: string }).error ?? `HTTP ${res.status}`)
        setDeleting(false)
        return
      }
      onMappingDeleted(mapping.id)
    } catch {
      setDeleteError('Network error — could not reach the server.')
      setDeleting(false)
    }
  }

  const urlInfo = mapping ? getUrlType(mapping.request) : null

  return (
    <>
      <div
        className={`drawer-backdrop${mapping ? ' visible' : ''}`}
        onClick={onClose}
      />
      <div className={`drawer-panel${mapping ? ' open' : ''}`}>
        {mapping && (
          <>
            <div className="drawer-header">
              {onBack && (
                <button className="drawer-back" onClick={onBack} aria-label="Back">
                  &#x2190;
                </button>
              )}
              <span className={`badge method-badge ${METHOD_COLORS[mapping.request.method ?? ''] ?? 'badge-gray'}`}>
                {mapping.request.method ?? 'ANY'}
              </span>
              <span className="drawer-url" title={urlInfo?.value}>
                {urlInfo?.value}
              </span>
              <button className="btn-edit-inline" onClick={() => setEditModalOpen(true)}>
                Edit
              </button>
              <button className="btn-edit-inline" onClick={handleExportSingle}>
                Export
              </button>
              <button className="drawer-close" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>

            <div className="drawer-content">
              {/* Request matcher */}
              <div className="drawer-section">
                <div className="drawer-section-title">Request Matcher</div>
                <div className="drawer-field">
                  <span className="drawer-field-key">Method</span>
                  <span className={`badge method-badge ${METHOD_COLORS[mapping.request.method ?? ''] ?? 'badge-gray'}`}>
                    {mapping.request.method ?? 'ANY'}
                  </span>
                </div>
                <div className="drawer-field">
                  <span className="drawer-field-key">{urlInfo?.label}</span>
                  <span className="drawer-field-val mono">{urlInfo?.value}</span>
                </div>
                {mapping.request.queryParameters && Object.keys(mapping.request.queryParameters).length > 0 && (
                  <>
                    <div className="drawer-sub-title">Query Parameters</div>
                    <dl className="drawer-headers-table">
                      {Object.entries(mapping.request.queryParameters).map(([param, matcher]) => {
                        const op = Object.keys(matcher)[0]
                        return (
                          <div key={param} className="drawer-header-row">
                            <dt>{param}</dt>
                            <dd>{op}: {matcher[op]}</dd>
                          </div>
                        )
                      })}
                    </dl>
                  </>
                )}
                {mapping.request.bodyPatterns && mapping.request.bodyPatterns.length > 0 && (
                  <>
                    <div className="drawer-sub-title">Body Patterns</div>
                    <pre className="drawer-body-pre">
                      {prettyBody(JSON.stringify(mapping.request.bodyPatterns))}
                    </pre>
                  </>
                )}
                {mapping.request.headers && Object.keys(mapping.request.headers).length > 0 && (
                  <>
                    <div className="drawer-sub-title">Header Matchers</div>
                    <pre className="drawer-body-pre">
                      {prettyBody(JSON.stringify(mapping.request.headers))}
                    </pre>
                  </>
                )}
              </div>

              {/* Response */}
              <div className="drawer-section">
                <div className="drawer-section-title">Response</div>
                <div className="drawer-field">
                  <span className="drawer-field-key">Status</span>
                  <span className={`drawer-status-code ${statusColorClass(mapping.response.status)}`}>
                    {mapping.response.status}
                  </span>
                </div>
                {mapping.response.transformers?.includes('response-template') && (
                  <div className="drawer-field">
                    <span className="drawer-field-key">Templating</span>
                    <span className="badge badge-purple">Response template</span>
                  </div>
                )}
                {mapping.response.fixedDelayMilliseconds != null &&
                  mapping.response.fixedDelayMilliseconds > 0 && (
                    <div className="drawer-field">
                      <span className="drawer-field-key">Delay</span>
                      <span className="drawer-field-val mono">
                        {mapping.response.fixedDelayMilliseconds} ms
                      </span>
                    </div>
                  )}
                {mapping.response.headers && Object.keys(mapping.response.headers).length > 0 && (
                  <>
                    <div className="drawer-sub-title">Headers</div>
                    <dl className="drawer-headers-table">
                      {Object.entries(mapping.response.headers).map(([k, v]) => (
                        <div key={k} className="drawer-header-row">
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
                <div className="drawer-sub-title">Body</div>
                {mapping.response.body ? (
                  <pre className="drawer-body-pre">{prettyBody(mapping.response.body)}</pre>
                ) : (
                  <span className="drawer-field-val" style={{ fontSize: '0.72rem', fontStyle: 'italic', color: 'var(--text-dim)' }}>(empty)</span>
                )}
              </div>

              {/* Mapping */}
              <div className="drawer-section">
                <div className="drawer-section-title">Mapping</div>
                <div className="drawer-field">
                  <span className="drawer-field-key">ID</span>
                  <span className="drawer-field-val mono">{mapping.id}</span>
                </div>
                {mapping.uuid && mapping.uuid !== mapping.id && (
                  <div className="drawer-field">
                    <span className="drawer-field-key">UUID</span>
                    <span className="drawer-field-val mono">{mapping.uuid}</span>
                  </div>
                )}
                <div className="drawer-delete-row">
                  {!confirmDelete ? (
                    <button className="btn-delete" onClick={() => setConfirmDelete(true)}>
                      Delete mapping
                    </button>
                  ) : (
                    <div className="drawer-delete-confirm">
                      <span className="drawer-delete-label">Delete this mapping?</span>
                      <button className="btn-delete-confirm" onClick={handleDelete} disabled={deleting}>
                        {deleting ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        className="btn-cancel-edit"
                        onClick={() => { setConfirmDelete(false); setDeleteError(null) }}
                        disabled={deleting}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {deleteError && <div className="drawer-edit-error">{deleteError}</div>}
                </div>
              </div>
            </div>

            {createPortal(
              <NewMappingModal
                open={editModalOpen}
                instanceUrl={instanceUrl}
                onClose={() => setEditModalOpen(false)}
                onCreated={(updated) => { onMappingUpdated(updated); setEditModalOpen(false) }}
                editMapping={mapping ?? undefined}
              />,
              document.body
            )}
          </>
        )}
      </div>
    </>
  )
}
