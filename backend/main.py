import os
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from uuid import uuid4
from typing import List

from backend.models import (
    Property, PropertyCreate, Floorplan, FloorplanCreate,
    Analysis, AnalysisCreate, Scenario, ScenarioCreate, ScenarioResults
)
from backend.mock_data import mock_db
from backend.calculator import calculate_scenario_metrics, calculate_waterfall_data

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="STU Sensitivity Analysis API")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Routes ---
@app.get("/api/health")
async def health_check():
    logger.info("Health check at /api/health")
    return {"status": "healthy"}


# --- Property Endpoints ---
@app.get("/api/properties", response_model=List[Property])
async def list_properties():
    """Get all properties"""
    logger.info("Listing all properties")
    properties = []
    for prop_id, prop_data in mock_db["properties"].items():
        # Get floorplans for this property
        floorplans = [fp for fp in mock_db["floorplans"].values() if fp["property_id"] == prop_id]
        prop_with_floorplans = {**prop_data, "floorplans": floorplans}
        properties.append(prop_with_floorplans)
    return properties


@app.get("/api/properties/{property_id}", response_model=Property)
async def get_property(property_id: str):
    """Get a specific property with its floorplans"""
    logger.info(f"Getting property {property_id}")
    if property_id not in mock_db["properties"]:
        raise HTTPException(status_code=404, detail="Property not found")

    prop_data = mock_db["properties"][property_id]
    floorplans = [fp for fp in mock_db["floorplans"].values() if fp["property_id"] == property_id]
    return {**prop_data, "floorplans": floorplans}


@app.post("/api/properties", response_model=Property)
async def create_property(property: PropertyCreate):
    """Create a new property"""
    logger.info(f"Creating property: {property.name}")
    property_id = str(uuid4())
    now = datetime.now()

    prop_data = {
        "id": property_id,
        "name": property.name,
        "address": property.address,
        "total_units": property.total_units,
        "created_at": now,
        "updated_at": now
    }

    mock_db["properties"][property_id] = prop_data
    return {**prop_data, "floorplans": []}


# --- Floorplan Endpoints ---
@app.post("/api/floorplans", response_model=Floorplan)
async def create_floorplan(floorplan: FloorplanCreate):
    """Add a floorplan to a property"""
    logger.info(f"Creating floorplan for property {floorplan.property_id}")

    if floorplan.property_id not in mock_db["properties"]:
        raise HTTPException(status_code=404, detail="Property not found")

    floorplan_id = str(uuid4())
    fp_data = {
        "id": floorplan_id,
        **floorplan.dict()
    }

    mock_db["floorplans"][floorplan_id] = fp_data
    return fp_data


@app.put("/api/floorplans/{floorplan_id}", response_model=Floorplan)
async def update_floorplan(floorplan_id: str, floorplan: FloorplanCreate):
    """Update a floorplan"""
    logger.info(f"Updating floorplan {floorplan_id}")

    if floorplan_id not in mock_db["floorplans"]:
        raise HTTPException(status_code=404, detail="Floorplan not found")

    fp_data = {
        "id": floorplan_id,
        **floorplan.dict()
    }

    mock_db["floorplans"][floorplan_id] = fp_data
    return fp_data


@app.delete("/api/floorplans/{floorplan_id}")
async def delete_floorplan(floorplan_id: str):
    """Delete a floorplan"""
    logger.info(f"Deleting floorplan {floorplan_id}")

    if floorplan_id not in mock_db["floorplans"]:
        raise HTTPException(status_code=404, detail="Floorplan not found")

    del mock_db["floorplans"][floorplan_id]
    return {"message": "Floorplan deleted"}


# --- Analysis Endpoints ---
@app.get("/api/analyses", response_model=List[Analysis])
async def list_analyses():
    """Get all analyses"""
    logger.info("Listing all analyses")
    analyses = []
    for analysis_id, analysis_data in mock_db["analyses"].items():
        scenarios = [s for s in mock_db["scenarios"].values() if s["analysis_id"] == analysis_id]
        analyses.append({**analysis_data, "scenarios": scenarios})
    return analyses


@app.get("/api/analyses/{analysis_id}", response_model=Analysis)
async def get_analysis(analysis_id: str):
    """Get a specific analysis with its scenarios"""
    logger.info(f"Getting analysis {analysis_id}")

    if analysis_id not in mock_db["analyses"]:
        raise HTTPException(status_code=404, detail="Analysis not found")

    analysis_data = mock_db["analyses"][analysis_id]
    scenarios = [s for s in mock_db["scenarios"].values() if s["analysis_id"] == analysis_id]
    return {**analysis_data, "scenarios": scenarios}


@app.post("/api/analyses", response_model=Analysis)
async def create_analysis(analysis: AnalysisCreate):
    """Create a new analysis"""
    logger.info(f"Creating analysis: {analysis.name}")

    if analysis.property_id not in mock_db["properties"]:
        raise HTTPException(status_code=404, detail="Property not found")

    analysis_id = str(uuid4())
    now = datetime.now()

    analysis_data = {
        "id": analysis_id,
        "property_id": analysis.property_id,
        "name": analysis.name,
        "description": analysis.description,
        "occupancy_rate": analysis.occupancy_rate,
        "created_at": now,
        "updated_at": now,
        "parent_analysis_id": None
    }

    mock_db["analyses"][analysis_id] = analysis_data
    return {**analysis_data, "scenarios": []}


@app.post("/api/analyses/{analysis_id}/duplicate", response_model=Analysis)
async def duplicate_analysis(analysis_id: str, new_name: str):
    """Duplicate an existing analysis with all its scenarios"""
    logger.info(f"Duplicating analysis {analysis_id}")

    if analysis_id not in mock_db["analyses"]:
        raise HTTPException(status_code=404, detail="Analysis not found")

    original_analysis = mock_db["analyses"][analysis_id]
    new_analysis_id = str(uuid4())
    now = datetime.now()

    # Create new analysis
    new_analysis_data = {
        "id": new_analysis_id,
        "property_id": original_analysis["property_id"],
        "name": new_name,
        "description": f"Duplicated from: {original_analysis['name']}",
        "occupancy_rate": original_analysis["occupancy_rate"],
        "created_at": now,
        "updated_at": now,
        "parent_analysis_id": analysis_id
    }

    mock_db["analyses"][new_analysis_id] = new_analysis_data

    # Duplicate scenarios
    original_scenarios = [s for s in mock_db["scenarios"].values() if s["analysis_id"] == analysis_id]
    new_scenarios = []

    for scenario in original_scenarios:
        new_scenario_id = str(uuid4())
        new_scenario = {
            **scenario,
            "id": new_scenario_id,
            "analysis_id": new_analysis_id,
            "created_at": now
        }
        mock_db["scenarios"][new_scenario_id] = new_scenario
        new_scenarios.append(new_scenario)

    return {**new_analysis_data, "scenarios": new_scenarios}


# --- Scenario Endpoints ---
@app.post("/api/scenarios", response_model=Scenario)
async def create_scenario(scenario: ScenarioCreate):
    """Create a new scenario"""
    logger.info(f"Creating scenario for analysis {scenario.analysis_id}")

    if scenario.analysis_id not in mock_db["analyses"]:
        raise HTTPException(status_code=404, detail="Analysis not found")

    scenario_id = str(uuid4())
    now = datetime.now()

    scenario_data = {
        "id": scenario_id,
        **scenario.dict(),
        "results": None,
        "created_at": now
    }

    mock_db["scenarios"][scenario_id] = scenario_data
    return scenario_data


@app.put("/api/scenarios/{scenario_id}", response_model=Scenario)
async def update_scenario(scenario_id: str, scenario: ScenarioCreate):
    """Update a scenario"""
    logger.info(f"Updating scenario {scenario_id}")

    if scenario_id not in mock_db["scenarios"]:
        raise HTTPException(status_code=404, detail="Scenario not found")

    scenario_data = {
        "id": scenario_id,
        **scenario.dict(),
        "results": None,
        "created_at": mock_db["scenarios"][scenario_id]["created_at"]
    }

    mock_db["scenarios"][scenario_id] = scenario_data
    return scenario_data


@app.get("/api/scenarios/{scenario_id}/calculate", response_model=Scenario)
async def calculate_scenario(scenario_id: str):
    """Calculate metrics for a scenario"""
    logger.info(f"Calculating scenario {scenario_id}")

    if scenario_id not in mock_db["scenarios"]:
        raise HTTPException(status_code=404, detail="Scenario not found")

    scenario = mock_db["scenarios"][scenario_id]
    analysis = mock_db["analyses"][scenario["analysis_id"]]

    # Get floorplans for the property
    floorplans = [fp for fp in mock_db["floorplans"].values()
                  if fp["property_id"] == analysis["property_id"]]

    if not floorplans:
        raise HTTPException(status_code=400, detail="No floorplans found for property")

    # Calculate metrics
    results = calculate_scenario_metrics(
        floorplans,
        scenario,
        analysis["occupancy_rate"]
    )

    # Update scenario with results
    scenario["results"] = results.dict()
    mock_db["scenarios"][scenario_id] = scenario

    return scenario


@app.get("/api/scenarios/{scenario_id}/waterfall")
async def get_waterfall_data(scenario_id: str, baseline_scenario_id: str):
    """Get waterfall chart data comparing scenario to baseline"""
    logger.info(f"Calculating waterfall for scenario {scenario_id} vs {baseline_scenario_id}")

    if scenario_id not in mock_db["scenarios"]:
        raise HTTPException(status_code=404, detail="Scenario not found")

    if baseline_scenario_id not in mock_db["scenarios"]:
        raise HTTPException(status_code=404, detail="Baseline scenario not found")

    scenario = mock_db["scenarios"][scenario_id]
    baseline = mock_db["scenarios"][baseline_scenario_id]
    analysis = mock_db["analyses"][scenario["analysis_id"]]

    # Get floorplans
    floorplans = [fp for fp in mock_db["floorplans"].values()
                  if fp["property_id"] == analysis["property_id"]]

    waterfall = calculate_waterfall_data(
        floorplans,
        baseline,
        scenario,
        analysis["occupancy_rate"]
    )

    return {"waterfall": waterfall}

# --- Static Files Setup ---
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(static_dir, exist_ok=True)

app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

# --- Catch-all for React Routes ---
@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    index_html = os.path.join(static_dir, "index.html")
    if os.path.exists(index_html):
        logger.info(f"Serving React frontend for path: /{full_path}")
        return FileResponse(index_html)
    logger.error("Frontend not built. index.html missing.")
    raise HTTPException(
        status_code=404,
        detail="Frontend not built. Please run 'npm run build' first."
    )