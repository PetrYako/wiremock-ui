import { useEffect, useState } from 'react'
import type { WireMockMapping, InitialMappingData, BodyPattern, BodyPatternOperator } from '../types.ts'
import '../styles/NewMappingModal.css'

type Method = 'ANY' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
type UrlMatchType = 'url' | 'urlPath' | 'urlPattern' | 'urlPathPattern'

const BODY_PATTERN_OPERATORS: BodyPatternOperator[] = [
  'equalToJson', 'matchesJsonPath', 'equalTo', 'contains', 'matches',
]

interface Props {
  open: boolean
  instanceUrl: string
  onClose: () => void
  onCreated: (mapping: WireMockMapping) => void
  initialData?: InitialMappingData
  editMapping?: WireMockMapping
}

export default function NewMappingModal({ open, instanceUrl, onClose, onCreated, initialData, editMapping }: Props) {
  const [method, setMethod] = useState<Method>('GET')
  const [urlMatchType, setUrlMatchType] = useState<UrlMatchType>('url')
  const [urlValue, setUrlValue] = useState('')
  const [status, setStatus] = useState('200')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [responseHeaders, setResponseHeaders] = useState<{ key: string; value: string }[]>([])
  const [bodyPatterns, setBodyPatterns] = useState<BodyPattern[]>([])
  const [delay, setDelay] = useState('')
  const [priority, setPriority] = useState('')
  const [responseTemplating, setResponseTemplating] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editMapping) {
      const matchType: UrlMatchType =
        editMapping.request.url != null ? 'url'
        : editMapping.request.urlPath != null ? 'urlPath'
        : editMapping.request.urlPattern != null ? 'urlPattern'
        : 'urlPathPattern'
      setMethod((editMapping.request.method as Method) ?? 'ANY')
      setUrlMatchType(matchType)
      setUrlValue((editMapping.request[matchType] as string) ?? '')
      setStatus(String(editMapping.response.status))
      setBody(editMapping.response.body ?? '')
      setResponseHeaders(
        editMapping.response.headers
          ? Object.entries(editMapping.response.headers).map(([key, value]) => ({ key, value }))
          : []
      )
      setDelay(editMapping.response.fixedDelayMilliseconds
        ? String(editMapping.response.fixedDelayMilliseconds) : '')
      setPriority(editMapping.priority ? String(editMapping.priority) : '')
      setResponseTemplating(editMapping.response.transformers?.includes('response-template') ?? false)
      setBodyPatterns(
        (editMapping.request.bodyPatterns ?? []).map((p) => {
          const operator = Object.keys(p)[0] as BodyPatternOperator
          return { operator, value: String(p[operator]) }
        })
      )
      setSubmitting(false)
      setSubmitError(null)
    } else {
      setMethod((initialData?.method as Method) ?? 'GET')
      setUrlMatchType(initialData?.urlMatchType ?? 'url')
      setUrlValue(initialData?.urlValue ?? '')
      setStatus(initialData?.status != null ? String(initialData.status) : '200')
      setBody(initialData?.body ?? '')
      setSubmitting(false)
      setSubmitError(null)
      setResponseHeaders(initialData?.responseHeaders ?? [])
      setBodyPatterns(initialData?.bodyPatterns ?? [])
      setDelay('')
      setPriority('')
      setResponseTemplating(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  const statusNum = Number(status)
  const statusValid = Number.isInteger(statusNum) && statusNum >= 100 && statusNum <= 599
  const urlValid = urlValue.trim().length > 0
  const canSubmit = urlValid && statusValid && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)

    const headers: Record<string, string> = {}
    for (const h of responseHeaders) {
      const k = h.key.trim()
      const v = h.value.trim()
      if (k && v) headers[k] = v
    }

    const delayNum = Number(delay)
    const priorityNum = Number(priority)
    const isEdit = !!editMapping

    const builtBodyPatterns = bodyPatterns
      .filter((p) => p.value.trim().length > 0)
      .map((p) => ({ [p.operator]: p.value.trim() }))

    // Build request payload, preserving extra matcher fields (headers, bodyPatterns) when editing
    let requestPayload: Record<string, unknown>
    if (isEdit) {
      const { url: _u, urlPath: _up, urlPattern: _upt, urlPathPattern: _uptp, method: _m,
              bodyPatterns: _bp, ...restRequest } = editMapping!.request
      requestPayload = {
        ...restRequest,
        [urlMatchType]: urlValue.trim(),
        ...(method !== 'ANY' && { method }),
        ...(builtBodyPatterns.length > 0 && { bodyPatterns: builtBodyPatterns }),
      }
    } else {
      requestPayload = {
        [urlMatchType]: urlValue.trim(),
        ...(method !== 'ANY' && { method }),
        ...(builtBodyPatterns.length > 0 && { bodyPatterns: builtBodyPatterns }),
      }
    }

    // Preserve non-response-template transformers from original when editing
    const otherTransformers = (editMapping?.response.transformers ?? []).filter(t => t !== 'response-template')
    const allTransformers = responseTemplating ? [...otherTransformers, 'response-template'] : otherTransformers

    const responsePayload = {
      status: statusNum,
      ...(body.trim() && { body: body.trim() }),
      ...(Object.keys(headers).length > 0 && { headers }),
      ...(Number.isInteger(delayNum) && delayNum > 0 && { fixedDelayMilliseconds: delayNum }),
      ...(allTransformers.length > 0 && { transformers: allTransformers }),
    }

    const endpoint = isEdit
      ? `${instanceUrl}/__admin/mappings/${editMapping!.id}`
      : `${instanceUrl}/__admin/mappings`

    const payload = isEdit
      ? {
          ...editMapping,
          request: requestPayload,
          response: responsePayload,
          ...(priorityNum > 0 ? { priority: priorityNum } : { priority: undefined }),
        }
      : {
          request: requestPayload,
          response: responsePayload,
          ...(Number.isInteger(priorityNum) && priorityNum > 0 && { priority: priorityNum }),
        }

    try {
      const res = await fetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSubmitError((data as { error?: string }).error ?? `HTTP ${res.status}`)
        setSubmitting(false)
        return
      }
      const result: WireMockMapping = await res.json()
      onCreated(result)
    } catch {
      setSubmitError('Network error — could not reach the server.')
      setSubmitting(false)
    }
  }

  const addHeader = () => setResponseHeaders((prev) => [...prev, { key: '', value: '' }])

  const removeHeader = (idx: number) =>
    setResponseHeaders((prev) => prev.filter((_, i) => i !== idx))

  const updateHeader = (idx: number, field: 'key' | 'value', val: string) =>
    setResponseHeaders((prev) => prev.map((h, i) => (i === idx ? { ...h, [field]: val } : h)))

  const addBodyPattern = () =>
    setBodyPatterns((prev) => [...prev, { operator: 'equalToJson', value: '' }])
  const removeBodyPattern = (idx: number) =>
    setBodyPatterns((prev) => prev.filter((_, i) => i !== idx))
  const updateBodyPattern = (idx: number, field: 'operator' | 'value', val: string) =>
    setBodyPatterns((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p))
    )

  if (!open) return null

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <span id="modal-title" className="modal-title">{editMapping ? 'Edit Mapping' : initialData ? 'Create Stub from Request' : 'New Mapping'}</span>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            <div className="modal-field">
              <label className="modal-label" htmlFor="nm-method">Method</label>
              <select
                id="nm-method"
                className="modal-select"
                value={method}
                onChange={(e) => setMethod(e.target.value as Method)}
              >
                {(['ANY', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as Method[]).map(
                  (m) => <option key={m} value={m}>{m}</option>
                )}
              </select>
            </div>

            <div className="modal-field">
              <label className="modal-label" htmlFor="nm-urltype">URL match</label>
              <select
                id="nm-urltype"
                className="modal-select"
                value={urlMatchType}
                onChange={(e) => setUrlMatchType(e.target.value as UrlMatchType)}
              >
                <option value="url">url (exact)</option>
                <option value="urlPath">urlPath (path only)</option>
                <option value="urlPattern">urlPattern (regex)</option>
                <option value="urlPathPattern">urlPathPattern (path regex)</option>
              </select>
            </div>

            <div className="modal-field">
              <label className="modal-label" htmlFor="nm-url">URL</label>
              <input
                id="nm-url"
                type="text"
                className="modal-input"
                placeholder="/api/example"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                autoFocus
                spellCheck={false}
              />
            </div>

            {/* Body Patterns */}
            <div className="modal-field modal-field-column">
              <label className="modal-label">
                Body Patterns <span className="modal-optional">(optional)</span>
              </label>
              <span className="field-hint">Match the request body against <a href="https://wiremock.org/docs/request-matching/#json-equality" target="_blank" rel="noopener noreferrer" className="field-hint-link">one or more patterns</a></span>
              {bodyPatterns.map((p, idx) => (
                <div className="body-pattern-row" key={idx}>
                  <select
                    className="modal-select body-pattern-select"
                    value={p.operator}
                    onChange={(e) => updateBodyPattern(idx, 'operator', e.target.value)}
                  >
                    {BODY_PATTERN_OPERATORS.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  <textarea
                    className="modal-input body-pattern-textarea"
                    rows={1}
                    placeholder={
                      p.operator === 'equalToJson' ? '{"key": "value"}' :
                      p.operator === 'matchesJsonPath' ? '$.name' : 'value'
                    }
                    value={p.value}
                    onChange={(e) => updateBodyPattern(idx, 'value', e.target.value)}
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="btn-remove-header"
                    onClick={() => removeBodyPattern(idx)}
                    title="Remove pattern"
                  >×</button>
                </div>
              ))}
              <button type="button" className="btn-add-header" onClick={addBodyPattern}>
                + Add pattern
              </button>
            </div>

            <div className="modal-field modal-field-column">
              <label className="modal-label" htmlFor="nm-status">Status</label>
              <div className="status-presets-row">
                <input
                  id="nm-status"
                  type="text"
                  inputMode="numeric"
                  className={`modal-input modal-input-short${!statusValid ? ' input-invalid' : ''}`}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                />
                {[200, 201, 204, 301, 400, 401, 403, 404, 500, 503].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`btn-status-preset${status === String(s) ? ' active' : ''}`}
                    onClick={() => setStatus(String(s))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-field modal-field-column">
              <label className="modal-checkbox-label">
                <input
                  type="checkbox"
                  checked={responseTemplating}
                  onChange={(e) => setResponseTemplating(e.target.checked)}
                />
                <span>Enable response templating</span>
              </label>
              <span className="field-hint">Use <a href="https://wiremock.org/docs/response-templating/" target="_blank" rel="noopener noreferrer" className="field-hint-link">Handlebars</a> syntax in body, e.g. {'{{request.path}}'}</span>
            </div>

            <div className="modal-field modal-field-column">
              <label className="modal-label" htmlFor="nm-body">
                Body <span className="modal-optional">(optional)</span>
              </label>
              <textarea
                id="nm-body"
                className="drawer-body-textarea modal-textarea"
                rows={5}
                placeholder='{"message": "hello"}'
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
              />
            </div>

            {/* Response Headers */}
            <div className="modal-field modal-field-column">
              <label className="modal-label">
                Response Headers <span className="modal-optional">(optional)</span>
              </label>
              <span className="field-hint">Headers returned in the stub response</span>
              {responseHeaders.map((h, idx) => (
                <div className="header-row" key={idx}>
                  <input
                    type="text"
                    className="modal-input header-key-input"
                    placeholder="Content-Type"
                    value={h.key}
                    onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                    spellCheck={false}
                  />
                  <input
                    type="text"
                    className="modal-input header-value-input"
                    placeholder="application/json"
                    value={h.value}
                    onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="btn-remove-header"
                    onClick={() => removeHeader(idx)}
                    title="Remove header"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="btn-add-header" onClick={addHeader}>
                + Add header
              </button>
            </div>

            {/* Delay & Priority */}
            <div className="modal-field-inline">
              <div className="modal-field">
                <label className="modal-label" htmlFor="nm-delay">Delay (ms)</label>
                <input
                  id="nm-delay"
                  type="number"
                  className="modal-input modal-input-short"
                  placeholder="500"
                  value={delay}
                  min={0}
                  onChange={(e) => setDelay(e.target.value)}
                />
              </div>
              <div className="modal-field">
                <label className="modal-label" htmlFor="nm-priority">Priority</label>
                <input
                  id="nm-priority"
                  type="number"
                  className="modal-input modal-input-short"
                  placeholder="1"
                  value={priority}
                  min={1}
                  onChange={(e) => setPriority(e.target.value)}
                />
              </div>
            </div>
          </div>

          {submitError && (
            <div className="drawer-edit-error modal-error">{submitError}</div>
          )}

          <div className="modal-actions">
            <button type="submit" className="btn-save" disabled={!canSubmit}>
              {submitting ? (editMapping ? 'Updating…' : 'Creating…') : (editMapping ? 'Update' : 'Create')}
            </button>
            <button
              type="button"
              className="btn-cancel-edit"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
