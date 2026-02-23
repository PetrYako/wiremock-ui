import { useEffect } from 'react'
import type { WireMockRequest } from '../types.ts'
import '../styles/RequestDrawer.css'

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

const formatLoggedDate = (ms: number) =>
  new Date(ms).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

interface Props {
  request: WireMockRequest | null
  onClose: () => void
  onStubClick?: (stubId: string) => void
  onCreateStub?: (request: WireMockRequest) => void
}

export default function RequestDrawer({ request, onClose, onStubClick, onCreateStub }: Props) {
  useEffect(() => {
    if (!request) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [request, onClose])

  return (
    <>
      <div
        className={`drawer-backdrop${request ? ' visible' : ''}`}
        onClick={onClose}
      />
      <div className={`drawer-panel${request ? ' open' : ''}`}>
        {request && (
          <>
            <div className="drawer-header">
              <span className={`badge method-badge ${METHOD_COLORS[request.request.method] ?? 'badge-gray'}`}>
                {request.request.method}
              </span>
              <span className="drawer-url" title={request.request.absoluteUrl}>
                {request.request.url}
              </span>
              <button className="drawer-close" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>

            <div className="drawer-content">
              {/* Request */}
              <div className="drawer-section">
                <div className="drawer-section-title">Request</div>
                {request.request.loggedDate != null && (
                  <div className="drawer-field">
                    <span className="drawer-field-key">Logged</span>
                    <span className="drawer-field-val">{formatLoggedDate(request.request.loggedDate)}</span>
                  </div>
                )}
                {Object.keys(request.request.headers ?? {}).length > 0 && (
                  <>
                    <div className="drawer-sub-title">Headers</div>
                    <dl className="drawer-headers-table">
                      {Object.entries(request.request.headers).map(([k, v]) => (
                        <div key={k} className="drawer-header-row">
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
                {request.request.body && (
                  <>
                    <div className="drawer-sub-title">Body</div>
                    <pre className="drawer-body-pre">{prettyBody(request.request.body)}</pre>
                  </>
                )}
              </div>

              {/* Response */}
              <div className="drawer-section">
                <div className="drawer-section-title">Response</div>
                <div className="drawer-field">
                  <span className="drawer-field-key">Status</span>
                  <span className={`drawer-status-code ${statusColorClass(request.responseDefinition.status)}`}>
                    {request.responseDefinition.status}
                  </span>
                </div>
                {request.responseDefinition.body && (
                  <>
                    <div className="drawer-sub-title">Body</div>
                    <pre className="drawer-body-pre">{prettyBody(request.responseDefinition.body)}</pre>
                  </>
                )}
              </div>

              {/* Match */}
              <div className="drawer-section">
                <div className="drawer-section-title">Match</div>
                <div className="drawer-field">
                  <span className="drawer-field-key">Status</span>
                  <span className={`badge ${request.wasMatched ? 'badge-matched' : 'badge-unmatched'}`}>
                    {request.wasMatched ? 'Matched' : 'Unmatched'}
                  </span>
                </div>
                {request.wasMatched && request.stubMapping?.id && (
                  <div className="drawer-field">
                    <span className="drawer-field-key">Stub ID</span>
                    <button
                      className="stub-id-link"
                      onClick={() => onStubClick?.(request.stubMapping!.id)}
                    >
                      {request.stubMapping.id}
                    </button>
                  </div>
                )}
                {!request.wasMatched && onCreateStub && (
                  <div className="drawer-create-stub-row">
                    <button className="btn-create-stub" onClick={() => onCreateStub(request)}>
                      + Create Stub
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
