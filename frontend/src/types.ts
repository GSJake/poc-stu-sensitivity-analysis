// Type definitions for the STU Sensitivity Analysis app

export interface Floorplan {
  id: string
  property_id: string
  name: string
  unit_type: string  // Studio, 1BR, 2BR, 3BR, 4BR
  unit_count: number
  square_footage: number
  floor_level?: string
  view_type?: string
  base_rent: number
  amenity_rent: number
}

export interface Property {
  id: string
  name: string
  address: string
  total_units: number
  created_at: string
  updated_at: string
  floorplans: Floorplan[]
}

export interface ScenarioResults {
  total_annual_revenue: number
  avg_rent_per_unit: number
  revenue_per_sqft: number
  weighted_avg_rent: number
}

export interface Scenario {
  id: string
  analysis_id: string
  name: string
  base_rent_pct_adj: number       // Percentage adjustment (0.05 = 5%)
  base_rent_dollar_adj: number    // Dollar adjustment
  amenity_rent_pct_adj: number
  amenity_rent_dollar_adj: number
  concession_type: 'none' | 'percentage' | 'dollar' | 'free_months'
  concession_value: number
  results?: ScenarioResults
  created_at: string
}

export interface Analysis {
  id: string
  property_id: string
  name: string
  description?: string
  occupancy_rate: number
  created_at: string
  updated_at: string
  parent_analysis_id?: string
  scenarios: Scenario[]
}

export interface WaterfallStep {
  label: string
  value: number
  type: 'base' | 'delta' | 'final'
}

// API Request types
export interface CreatePropertyRequest {
  name: string
  address: string
  total_units: number
}

export interface CreateFloorplanRequest {
  property_id: string
  name: string
  unit_type: string
  unit_count: number
  square_footage: number
  floor_level?: string
  view_type?: string
  base_rent: number
  amenity_rent: number
}

export interface CreateAnalysisRequest {
  property_id: string
  name: string
  description?: string
  occupancy_rate: number
}

export interface CreateScenarioRequest {
  analysis_id: string
  name: string
  base_rent_pct_adj?: number
  base_rent_dollar_adj?: number
  amenity_rent_pct_adj?: number
  amenity_rent_dollar_adj?: number
  concession_type?: 'none' | 'percentage' | 'dollar' | 'free_months'
  concession_value?: number
}
