from datetime import datetime
from uuid import uuid4

# In-memory data store
mock_db = {
    "properties": {},
    "floorplans": {},
    "analyses": {},
    "scenarios": {}
}

# Initialize with sample data
def initialize_mock_data():
    """Create sample student housing properties"""

    # Property 1: Campus View Apartments
    prop1_id = str(uuid4())
    mock_db["properties"][prop1_id] = {
        "id": prop1_id,
        "name": "Campus View Apartments",
        "address": "123 University Ave, Austin, TX 78705",
        "total_units": 240,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }

    # Floorplans for Campus View
    floorplans_prop1 = [
        {
            "id": str(uuid4()),
            "property_id": prop1_id,
            "name": "A1 - Studio",
            "unit_type": "Studio",
            "unit_count": 40,
            "square_footage": 450,
            "floor_level": "1-4",
            "view_type": "Courtyard",
            "base_rent": 1200.00,
            "amenity_rent": 50.00
        },
        {
            "id": str(uuid4()),
            "property_id": prop1_id,
            "name": "B1 - One Bedroom",
            "unit_type": "1BR",
            "unit_count": 80,
            "square_footage": 650,
            "floor_level": "1-6",
            "view_type": "Mixed",
            "base_rent": 1450.00,
            "amenity_rent": 75.00
        },
        {
            "id": str(uuid4()),
            "property_id": prop1_id,
            "name": "C1 - Two Bedroom",
            "unit_type": "2BR",
            "unit_count": 90,
            "square_footage": 950,
            "floor_level": "1-6",
            "view_type": "Mixed",
            "base_rent": 1900.00,
            "amenity_rent": 100.00
        },
        {
            "id": str(uuid4()),
            "property_id": prop1_id,
            "name": "D1 - Three Bedroom",
            "unit_type": "3BR",
            "unit_count": 30,
            "square_footage": 1250,
            "floor_level": "2-6",
            "view_type": "City",
            "base_rent": 2400.00,
            "amenity_rent": 125.00
        }
    ]

    for fp in floorplans_prop1:
        mock_db["floorplans"][fp["id"]] = fp

    # Property 2: University Heights
    prop2_id = str(uuid4())
    mock_db["properties"][prop2_id] = {
        "id": prop2_id,
        "name": "University Heights",
        "address": "456 College Blvd, Austin, TX 78712",
        "total_units": 180,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }

    # Floorplans for University Heights
    floorplans_prop2 = [
        {
            "id": str(uuid4()),
            "property_id": prop2_id,
            "name": "Studio Deluxe",
            "unit_type": "Studio",
            "unit_count": 30,
            "square_footage": 500,
            "floor_level": "1-5",
            "view_type": "Park",
            "base_rent": 1350.00,
            "amenity_rent": 60.00
        },
        {
            "id": str(uuid4()),
            "property_id": prop2_id,
            "name": "One Bed Premium",
            "unit_type": "1BR",
            "unit_count": 60,
            "square_footage": 700,
            "floor_level": "1-5",
            "view_type": "Park",
            "base_rent": 1600.00,
            "amenity_rent": 85.00
        },
        {
            "id": str(uuid4()),
            "property_id": prop2_id,
            "name": "Two Bed Luxury",
            "unit_type": "2BR",
            "unit_count": 70,
            "square_footage": 1050,
            "floor_level": "1-5",
            "view_type": "Mixed",
            "base_rent": 2200.00,
            "amenity_rent": 110.00
        },
        {
            "id": str(uuid4()),
            "property_id": prop2_id,
            "name": "Four Bed Townhouse",
            "unit_type": "4BR",
            "unit_count": 20,
            "square_footage": 1600,
            "floor_level": "Ground",
            "view_type": "Street",
            "base_rent": 3200.00,
            "amenity_rent": 150.00
        }
    ]

    for fp in floorplans_prop2:
        mock_db["floorplans"][fp["id"]] = fp

    # Create a sample analysis
    analysis1_id = str(uuid4())
    mock_db["analyses"][analysis1_id] = {
        "id": analysis1_id,
        "property_id": prop1_id,
        "name": "Fall 2024 Leasing Analysis",
        "description": "Baseline analysis for fall semester leasing period",
        "occupancy_rate": 0.95,
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "parent_analysis_id": None
    }

    # Create baseline scenario
    scenario1_id = str(uuid4())
    mock_db["scenarios"][scenario1_id] = {
        "id": scenario1_id,
        "analysis_id": analysis1_id,
        "name": "Baseline",
        "base_rent_pct_adj": 0.0,
        "base_rent_dollar_adj": 0.0,
        "amenity_rent_pct_adj": 0.0,
        "amenity_rent_dollar_adj": 0.0,
        "concession_type": "none",
        "concession_value": 0.0,
        "results": None,
        "created_at": datetime.now()
    }

    # Create optimistic scenario
    scenario2_id = str(uuid4())
    mock_db["scenarios"][scenario2_id] = {
        "id": scenario2_id,
        "analysis_id": analysis1_id,
        "name": "Optimistic (+5%)",
        "base_rent_pct_adj": 0.05,
        "base_rent_dollar_adj": 0.0,
        "amenity_rent_pct_adj": 0.05,
        "amenity_rent_dollar_adj": 0.0,
        "concession_type": "none",
        "concession_value": 0.0,
        "results": None,
        "created_at": datetime.now()
    }

    # Create pessimistic scenario
    scenario3_id = str(uuid4())
    mock_db["scenarios"][scenario3_id] = {
        "id": scenario3_id,
        "analysis_id": analysis1_id,
        "name": "Pessimistic (1 month free)",
        "base_rent_pct_adj": 0.0,
        "base_rent_dollar_adj": 0.0,
        "amenity_rent_pct_adj": 0.0,
        "amenity_rent_dollar_adj": 0.0,
        "concession_type": "free_months",
        "concession_value": 1.0,
        "results": None,
        "created_at": datetime.now()
    }


# Initialize on module load
initialize_mock_data()
