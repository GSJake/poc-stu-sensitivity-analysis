// API client for STU Sensitivity Analysis backend

import type {
  Property,
  Analysis,
  Scenario,
  CreatePropertyRequest,
  CreateFloorplanRequest,
  CreateAnalysisRequest,
  CreateScenarioRequest,
  Floorplan,
  WaterfallStep
} from './types'

const API_BASE = '/api'

// Helper function for API calls
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `API Error: ${response.statusText}`)
  }

  return response.json()
}

// Property endpoints
export const propertyApi = {
  list: () => apiCall<Property[]>('/properties'),

  get: (id: string) => apiCall<Property>(`/properties/${id}`),

  create: (data: CreatePropertyRequest) =>
    apiCall<Property>('/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// Floorplan endpoints
export const floorplanApi = {
  create: (data: CreateFloorplanRequest) =>
    apiCall<Floorplan>('/floorplans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: CreateFloorplanRequest) =>
    apiCall<Floorplan>(`/floorplans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiCall<{ message: string }>(`/floorplans/${id}`, {
      method: 'DELETE',
    }),
}

// Analysis endpoints
export const analysisApi = {
  list: () => apiCall<Analysis[]>('/analyses'),

  get: (id: string) => apiCall<Analysis>(`/analyses/${id}`),

  create: (data: CreateAnalysisRequest) =>
    apiCall<Analysis>('/analyses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  duplicate: (id: string, newName: string) =>
    apiCall<Analysis>(`/analyses/${id}/duplicate?new_name=${encodeURIComponent(newName)}`, {
      method: 'POST',
    }),
}

// Scenario endpoints
export const scenarioApi = {
  create: (data: CreateScenarioRequest) =>
    apiCall<Scenario>('/scenarios', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: CreateScenarioRequest) =>
    apiCall<Scenario>(`/scenarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  calculate: (id: string) =>
    apiCall<Scenario>(`/scenarios/${id}/calculate`),

  getWaterfall: (scenarioId: string, baselineId: string) =>
    apiCall<{ waterfall: WaterfallStep[] }>(
      `/scenarios/${scenarioId}/waterfall?baseline_scenario_id=${baselineId}`
    ),
}

// Convenience function to calculate all scenarios in an analysis
export async function calculateAllScenarios(analysis: Analysis): Promise<Scenario[]> {
  const calculated = await Promise.all(
    analysis.scenarios.map(scenario => scenarioApi.calculate(scenario.id))
  )
  return calculated
}
