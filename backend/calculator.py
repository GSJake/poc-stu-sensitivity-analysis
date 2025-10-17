from typing import Dict, List
from backend.models import ScenarioResults


def calculate_scenario_metrics(
    floorplans: List[Dict],
    scenario: Dict,
    occupancy_rate: float
) -> ScenarioResults:
    """
    Calculate summary metrics for a given scenario.

    Args:
        floorplans: List of floorplan dictionaries
        scenario: Scenario configuration with adjustments
        occupancy_rate: Property occupancy rate (0.0 to 1.0)

    Returns:
        ScenarioResults with calculated metrics
    """

    total_annual_revenue = 0.0
    total_units = 0
    total_sqft = 0
    weighted_rent_sum = 0.0

    for floorplan in floorplans:
        # Apply adjustments to base rent
        adjusted_base_rent = apply_adjustment(
            floorplan["base_rent"],
            scenario["base_rent_pct_adj"],
            scenario["base_rent_dollar_adj"]
        )

        # Apply adjustments to amenity rent
        adjusted_amenity_rent = apply_adjustment(
            floorplan["amenity_rent"],
            scenario["amenity_rent_pct_adj"],
            scenario["amenity_rent_dollar_adj"]
        )

        # Calculate gross rent
        gross_rent = adjusted_base_rent + adjusted_amenity_rent

        # Apply concessions
        net_effective_rent = apply_concession(
            gross_rent,
            scenario["concession_type"],
            scenario["concession_value"]
        )

        # Calculate metrics for this floorplan
        unit_count = floorplan["unit_count"]
        sqft = floorplan["square_footage"] * unit_count

        # Annual revenue for this floorplan
        annual_revenue = net_effective_rent * unit_count * occupancy_rate * 12

        # Accumulate totals
        total_annual_revenue += annual_revenue
        total_units += unit_count
        total_sqft += sqft
        weighted_rent_sum += net_effective_rent * unit_count

    # Calculate summary statistics
    avg_rent_per_unit = total_annual_revenue / total_units / 12 if total_units > 0 else 0
    revenue_per_sqft = total_annual_revenue / total_sqft if total_sqft > 0 else 0
    weighted_avg_rent = weighted_rent_sum / total_units if total_units > 0 else 0

    return ScenarioResults(
        total_annual_revenue=round(total_annual_revenue, 2),
        avg_rent_per_unit=round(avg_rent_per_unit, 2),
        revenue_per_sqft=round(revenue_per_sqft, 2),
        weighted_avg_rent=round(weighted_avg_rent, 2)
    )


def apply_adjustment(base_value: float, pct_adj: float, dollar_adj: float) -> float:
    """
    Apply both percentage and dollar adjustments to a base value.

    Args:
        base_value: Original value
        pct_adj: Percentage adjustment (e.g., 0.05 for 5%)
        dollar_adj: Dollar adjustment

    Returns:
        Adjusted value
    """
    return (base_value * (1 + pct_adj)) + dollar_adj


def apply_concession(gross_rent: float, concession_type: str, concession_value: float) -> float:
    """
    Apply concession to gross rent.

    Args:
        gross_rent: Gross monthly rent
        concession_type: Type of concession (none, percentage, dollar, free_months)
        concession_value: Value of concession

    Returns:
        Net effective monthly rent
    """
    if concession_type == "percentage":
        # Percentage off (e.g., 0.10 = 10% off)
        return gross_rent * (1 - concession_value)

    elif concession_type == "dollar":
        # Fixed dollar amount off per month
        return max(0, gross_rent - concession_value)

    elif concession_type == "free_months":
        # Free months spread over 12 months (e.g., 1 month free = 11/12 of rent)
        months_paid = 12 - concession_value
        return gross_rent * (months_paid / 12)

    else:  # "none" or unknown
        return gross_rent


def calculate_waterfall_data(
    floorplans: List[Dict],
    baseline_scenario: Dict,
    comparison_scenario: Dict,
    occupancy_rate: float
) -> List[Dict]:
    """
    Calculate waterfall chart data showing the impact of each adjustment.

    Returns list of waterfall steps with labels and values.
    """
    baseline_results = calculate_scenario_metrics(floorplans, baseline_scenario, occupancy_rate)
    comparison_results = calculate_scenario_metrics(floorplans, comparison_scenario, occupancy_rate)

    # Calculate intermediate steps
    base_revenue = baseline_results.total_annual_revenue

    # Calculate impact of base rent adjustment
    temp_scenario = baseline_scenario.copy()
    temp_scenario.update({
        "base_rent_pct_adj": comparison_scenario["base_rent_pct_adj"],
        "base_rent_dollar_adj": comparison_scenario["base_rent_dollar_adj"]
    })
    after_base = calculate_scenario_metrics(floorplans, temp_scenario, occupancy_rate)
    base_rent_impact = after_base.total_annual_revenue - base_revenue

    # Calculate impact of amenity rent adjustment
    temp_scenario.update({
        "amenity_rent_pct_adj": comparison_scenario["amenity_rent_pct_adj"],
        "amenity_rent_dollar_adj": comparison_scenario["amenity_rent_dollar_adj"]
    })
    after_amenity = calculate_scenario_metrics(floorplans, temp_scenario, occupancy_rate)
    amenity_rent_impact = after_amenity.total_annual_revenue - after_base.total_annual_revenue

    # Calculate impact of concessions
    concession_impact = comparison_results.total_annual_revenue - after_amenity.total_annual_revenue

    waterfall = [
        {"label": "Baseline", "value": base_revenue, "type": "base"},
        {"label": "Base Rent Adj", "value": base_rent_impact, "type": "delta"},
        {"label": "Amenity Rent Adj", "value": amenity_rent_impact, "type": "delta"},
        {"label": "Concessions", "value": concession_impact, "type": "delta"},
        {"label": "Final", "value": comparison_results.total_annual_revenue, "type": "final"}
    ]

    return waterfall
