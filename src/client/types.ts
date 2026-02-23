export interface WireMockInstance {
  id: string
  label: string
  url: string
}

export interface WireMockRequest {
  id: string
  request: {
    method: string
    url: string
    headers: Record<string, string>
    body?: string
    absoluteUrl: string
    loggedDate?: number
  }
  responseDefinition: {
    status: number
    body?: string
  }
  wasMatched: boolean
  stubMapping?: { id: string; name?: string }
}

export interface RequestsResponse {
  requests: WireMockRequest[]
  meta: {
    total: number
  }
}

export type BodyPatternOperator =
  | 'equalToJson'
  | 'matchesJsonPath'
  | 'equalTo'
  | 'contains'
  | 'matches'

export interface BodyPattern {
  operator: BodyPatternOperator
  value: string
}

export interface WireMockMapping {
  id: string
  request: {
    method?: string
    url?: string
    urlPattern?: string
    urlPath?: string
    urlPathPattern?: string
    headers?: Record<string, unknown>
    bodyPatterns?: Array<Record<string, string>>
  }
  response: {
    status: number
    body?: string
    headers?: Record<string, string>
    fixedDelayMilliseconds?: number
    transformers?: string[]
  }
  uuid?: string
  priority?: number
}

export interface MappingsResponse {
  mappings: WireMockMapping[]
  meta: { total: number }
}

export interface InitialMappingData {
  method?: string
  urlMatchType?: 'url' | 'urlPath' | 'urlPattern' | 'urlPathPattern'
  urlValue?: string
  status?: number
  body?: string
  responseHeaders?: { key: string; value: string }[]
  bodyPatterns?: BodyPattern[]
}
