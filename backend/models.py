from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import uuid4


class FloorplanBase(BaseModel):
    name: str
    unit_type: str  # Studio, 1BR, 2BR, 3BR, 4BR
    unit_count: int
    square_footage: int
    floor_level: Optional[str] = None
    view_type: Optional[str] = None
    base_rent: float
    amenity_rent: float


class FloorplanCreate(FloorplanBase):
    property_id: str


class Floorplan(FloorplanBase):
    id: str
    property_id: str

    class Config:
        from_attributes = True


class PropertyBase(BaseModel):
    name: str
    address: str
    total_units: int


class PropertyCreate(PropertyBase):
    pass


class Property(PropertyBase):
    id: str
    created_at: datetime
    updated_at: datetime
    floorplans: List[Floorplan] = []

    class Config:
        from_attributes = True


class ScenarioBase(BaseModel):
    name: str
    base_rent_pct_adj: float = 0.0  # Percentage adjustment (e.g., 0.05 = 5%)
    base_rent_dollar_adj: float = 0.0  # Dollar adjustment
    amenity_rent_pct_adj: float = 0.0
    amenity_rent_dollar_adj: float = 0.0
    concession_type: str = "none"  # none, percentage, dollar, free_months
    concession_value: float = 0.0


class ScenarioCreate(ScenarioBase):
    analysis_id: str


class ScenarioResults(BaseModel):
    total_annual_revenue: float
    avg_rent_per_unit: float
    revenue_per_sqft: float
    weighted_avg_rent: float


class Scenario(ScenarioBase):
    id: str
    analysis_id: str
    results: Optional[ScenarioResults] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AnalysisBase(BaseModel):
    name: str
    description: Optional[str] = None
    occupancy_rate: float = 0.95  # Default 95% occupancy


class AnalysisCreate(AnalysisBase):
    property_id: str


class Analysis(AnalysisBase):
    id: str
    property_id: str
    created_at: datetime
    updated_at: datetime
    parent_analysis_id: Optional[str] = None
    scenarios: List[Scenario] = []

    class Config:
        from_attributes = True
