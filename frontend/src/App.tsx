import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './App.css'
import { analysisApi, calculateAllScenarios, propertyApi, scenarioApi } from './api'
import type { Analysis, Scenario, Property } from './types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

function App() {
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [filteredAnalyses, setFilteredAnalyses] = useState<Analysis[]>([])
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null)

  // Load properties and analyses on mount
  useEffect(() => {
    loadData()
  }, [])

  // Filter analyses when property changes
  useEffect(() => {
    if (selectedProperty) {
      const filtered = analyses.filter(a => a.property_id === selectedProperty.id)
      setFilteredAnalyses(filtered)
      if (filtered.length > 0) {
        setSelectedAnalysis(filtered[0])
      } else {
        setSelectedAnalysis(null)
      }
    } else {
      setFilteredAnalyses(analyses)
      if (analyses.length > 0) {
        setSelectedAnalysis(analyses[0])
      }
    }
  }, [selectedProperty, analyses])

  // Calculate scenarios when analysis is selected
  useEffect(() => {
    if (selectedAnalysis) {
      calculateScenarios()
    }
  }, [selectedAnalysis])

  const loadData = async () => {
    try {
      const [propertiesData, analysesData] = await Promise.all([
        propertyApi.list(),
        analysisApi.list()
      ])

      setProperties(propertiesData)
      setAnalyses(analysesData)

      if (propertiesData.length > 0) {
        setSelectedProperty(propertiesData[0])
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  const calculateScenarios = async () => {
    if (!selectedAnalysis) return

    setCalculating(true)
    try {
      const calculated = await calculateAllScenarios(selectedAnalysis)
      setScenarios(calculated)
    } catch (error) {
      console.error('Error calculating scenarios:', error)
    } finally {
      setCalculating(false)
    }
  }

  const updateScenario = async (scenario: Scenario) => {
    try {
      const updated = await scenarioApi.update(scenario.id, {
        analysis_id: scenario.analysis_id,
        name: scenario.name,
        base_rent_pct_adj: scenario.base_rent_pct_adj,
        base_rent_dollar_adj: scenario.base_rent_dollar_adj,
        amenity_rent_pct_adj: scenario.amenity_rent_pct_adj,
        amenity_rent_dollar_adj: scenario.amenity_rent_dollar_adj,
        concession_type: scenario.concession_type,
        concession_value: scenario.concession_value
      })

      // Recalculate
      const calculated = await scenarioApi.calculate(updated.id)

      // Update scenarios list
      setScenarios(prev => prev.map(s => s.id === calculated.id ? calculated : s))
      setEditingScenario(null)
    } catch (error) {
      console.error('Error updating scenario:', error)
    }
  }

  const resetScenario = async (scenario: Scenario) => {
    if (!confirm(`Reset "${scenario.name}" to baseline (clear all adjustments)?`)) {
      return
    }

    try {
      const updated = await scenarioApi.update(scenario.id, {
        analysis_id: scenario.analysis_id,
        name: scenario.name,
        base_rent_pct_adj: 0,
        base_rent_dollar_adj: 0,
        amenity_rent_pct_adj: 0,
        amenity_rent_dollar_adj: 0,
        concession_type: 'none',
        concession_value: 0
      })

      // Recalculate
      const calculated = await scenarioApi.calculate(updated.id)

      // Update scenarios list
      setScenarios(prev => prev.map(s => s.id === calculated.id ? calculated : s))
      setEditingScenario(null)
    } catch (error) {
      console.error('Error resetting scenario:', error)
    }
  }

  const exportToPDF = () => {
    if (!selectedProperty || !selectedAnalysis) return

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    const currentScenario = scenarios[activeTab]
    const pageWidth = doc.internal.pageSize.getWidth()

    // Greystar Brand Colors (RGB for PDF)
    const NAVY_RGB = [10, 34, 69] as [number, number, number]
    const OCEAN_RGB = [0, 119, 212] as [number, number, number]

    // Header with Greystar Branding
    doc.setFillColor(...NAVY_RGB)
    doc.rect(0, 0, pageWidth, 20, 'F')

    // Title
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255) // White text
    doc.text('STU Sensitivity Analysis Report', pageWidth / 2, 12, { align: 'center' })

    // Reset text color for content
    doc.setTextColor(...NAVY_RGB)

    // Property Details
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    let yPos = 28
    doc.text(`Property: ${selectedProperty.name}`, 15, yPos)
    yPos += 6
    doc.text(`Address: ${selectedProperty.address}`, 15, yPos)
    yPos += 6
    doc.text(`Analysis: ${selectedAnalysis.name}`, 15, yPos)
    yPos += 6
    doc.text(`Total Units: ${selectedProperty.total_units}`, 15, yPos)
    doc.text(`Occupancy Rate: ${formatPercent(selectedAnalysis.occupancy_rate)}`, 100, yPos)
    yPos += 10

    // Current Scenario Floorplan Breakdown
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...OCEAN_RGB)
    doc.text(`Floorplan Breakdown - ${currentScenario.name}`, 15, yPos)
    doc.setTextColor(...NAVY_RGB)
    yPos += 5

    const floorplanData = selectedProperty.floorplans.map(fp => {
      const adjustedBase = (fp.base_rent * (1 + currentScenario.base_rent_pct_adj)) + currentScenario.base_rent_dollar_adj
      const adjustedAmenity = (fp.amenity_rent * (1 + currentScenario.amenity_rent_pct_adj)) + currentScenario.amenity_rent_dollar_adj
      const grossRent = adjustedBase + adjustedAmenity

      let concessionAmount = 0
      let netEffective = grossRent

      if (currentScenario.concession_type === 'percentage') {
        concessionAmount = grossRent * (currentScenario.concession_value / 100)
        netEffective = grossRent - concessionAmount
      } else if (currentScenario.concession_type === 'dollar') {
        concessionAmount = currentScenario.concession_value
        netEffective = Math.max(0, grossRent - concessionAmount)
      } else if (currentScenario.concession_type === 'free_months') {
        concessionAmount = grossRent * (currentScenario.concession_value / 12)
        netEffective = grossRent * ((12 - currentScenario.concession_value) / 12)
      }

      return [
        fp.name,
        fp.unit_type,
        fp.unit_count,
        fp.square_footage.toLocaleString(),
        formatCurrency(fp.base_rent),
        formatCurrency(adjustedBase),
        formatCurrency(fp.amenity_rent),
        formatCurrency(adjustedAmenity),
        formatCurrency(grossRent),
        concessionAmount > 0 ? `-${formatCurrency(concessionAmount)}` : '-',
        formatCurrency(netEffective)
      ]
    })

    autoTable(doc, {
      startY: yPos,
      head: [['Floorplan', 'Type', 'Units', 'Sq Ft', 'Base Rent', 'Adj Base', 'Amenity', 'Adj Amenity', 'Gross Rent', 'Concession', 'Net Effective']],
      body: floorplanData,
      theme: 'grid',
      headStyles: {
        fillColor: NAVY_RGB,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: NAVY_RGB
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 15 },
        2: { cellWidth: 12 },
        3: { cellWidth: 15 },
      },
      styles: { overflow: 'linebreak' }
    })

    // Add new page for scenario comparison
    doc.addPage()

    // Header for second page
    doc.setFillColor(...NAVY_RGB)
    doc.rect(0, 0, pageWidth, 20, 'F')
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('STU Sensitivity Analysis Report', pageWidth / 2, 12, { align: 'center' })
    doc.setTextColor(...NAVY_RGB)

    yPos = 28

    // All Scenarios Comparison
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...OCEAN_RGB)
    doc.text('All Scenarios Comparison', 15, yPos)
    doc.setTextColor(...NAVY_RGB)
    yPos += 5

    const scenarioData = scenarios.map(s => [
      s.name,
      s.base_rent_pct_adj !== 0 ? formatPercent(s.base_rent_pct_adj) :
        s.base_rent_dollar_adj !== 0 ? formatCurrency(s.base_rent_dollar_adj) : '-',
      s.amenity_rent_pct_adj !== 0 ? formatPercent(s.amenity_rent_pct_adj) :
        s.amenity_rent_dollar_adj !== 0 ? formatCurrency(s.amenity_rent_dollar_adj) : '-',
      s.concession_type === 'none' ? '-' :
        s.concession_type === 'free_months' ? `${s.concession_value}mo free` : `${s.concession_value}`,
      s.results ? formatCurrency(s.results.total_annual_revenue) : '-',
      s.results ? formatCurrency(s.results.avg_rent_per_unit) : '-',
      s.results ? formatCurrency(s.results.revenue_per_sqft) : '-',
      s.results ? formatCurrency(s.results.weighted_avg_rent) : '-'
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['Scenario', 'Base Rent Adj', 'Amenity Adj', 'Concessions', 'Annual Revenue', 'Avg Rent/Unit', 'Revenue/SqFt', 'Weighted Avg']],
      body: scenarioData,
      theme: 'grid',
      headStyles: {
        fillColor: NAVY_RGB,
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: NAVY_RGB
      },
      styles: { overflow: 'linebreak' }
    })

    // Save PDF
    const filename = `STU_Analysis_${selectedProperty.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(filename)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  // Revenue comparison chart data - Greystar Brand Colors
  const chartData = {
    labels: scenarios.map(s => s.name),
    datasets: [
      {
        label: 'Total Annual Revenue',
        data: scenarios.map(s => s.results?.total_annual_revenue || 0),
        backgroundColor: '#0077D4', // Greystar Ocean
        borderColor: '#0A2245', // Greystar Navy
        borderWidth: 2,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Revenue Comparison by Scenario',
        font: {
          size: 18,
          family: 'Inter, "Helvetica Neue", Arial, sans-serif',
          weight: '600' as const
        },
        color: '#0A2245' // Greystar Navy
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatCurrency(value),
          font: {
            family: 'Inter, "Helvetica Neue", Arial, sans-serif'
          },
          color: '#0A2245' // Greystar Navy
        },
        grid: {
          color: '#B2B3B5' // Greystar Concrete
        }
      },
      x: {
        ticks: {
          font: {
            family: 'Inter, "Helvetica Neue", Arial, sans-serif'
          },
          color: '#0A2245' // Greystar Navy
        },
        grid: {
          color: '#B2B3B5' // Greystar Concrete
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="App">
        <div className="loading">Loading STU Sensitivity Analysis...</div>
      </div>
    )
  }

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-branding">
          <div className="greystar-logo">GREYSTAR</div>
          <h1>STU Sensitivity Analysis</h1>
        </div>

        {/* Property Filter */}
        <div className="filters">
          <div className="filter-group">
            <label>Property:</label>
            <select
              value={selectedProperty?.id || ''}
              onChange={(e) => {
                const property = properties.find(p => p.id === e.target.value)
                setSelectedProperty(property || null)
              }}
            >
              {properties.map(property => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>

          {/* Analysis Selector */}
          {filteredAnalyses.length > 0 && (
            <div className="filter-group">
              <label>Analysis:</label>
              <select
                value={selectedAnalysis?.id || ''}
                onChange={(e) => {
                  const analysis = filteredAnalyses.find(a => a.id === e.target.value)
                  setSelectedAnalysis(analysis || null)
                }}
              >
                {filteredAnalyses.map(analysis => (
                  <option key={analysis.id} value={analysis.id}>
                    {analysis.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      {selectedProperty && selectedAnalysis && (
        <div className="dashboard">
          {/* Property Details at Top */}
          <div className="property-header">
            <div className="property-details">
              <h2>{selectedProperty.name}</h2>
              <p className="property-address">{selectedProperty.address}</p>
              <div className="property-stats">
                <div className="stat">
                  <span className="stat-label">Total Units</span>
                  <span className="stat-value">{selectedProperty.total_units}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Occupancy Rate</span>
                  <span className="stat-value">{formatPercent(selectedAnalysis.occupancy_rate)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Analysis</span>
                  <span className="stat-value">{selectedAnalysis.name}</span>
                </div>
              </div>
            </div>
            <button
              className="btn-export-pdf"
              onClick={exportToPDF}
              disabled={scenarios.length === 0}
            >
              Export PDF
            </button>
          </div>

          {/* Scenario Tabs with Floorplan Assumptions */}
          <div className="scenarios-section">
            <h3>Scenario Analysis & Assumptions</h3>
            <p className="section-subtitle">View and edit assumptions for each scenario</p>

            {/* Scenario Tabs */}
            <div className="scenario-tabs">
              {scenarios.map((scenario, index) => (
                <button
                  key={scenario.id}
                  className={`tab-button ${activeTab === index ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(index)
                    setEditingScenario(null)
                  }}
                >
                  {scenario.name}
                </button>
              ))}
            </div>

            {/* Active Scenario Content */}
            {scenarios[activeTab] && (
              <div className="tab-content">
                {/* Scenario Header with Edit/Save/Reset */}
                <div className="scenario-header">
                  <div className="scenario-title">
                    {editingScenario?.id === scenarios[activeTab].id ? (
                      <input
                        type="text"
                        value={editingScenario.name}
                        onChange={(e) => setEditingScenario({
                          ...editingScenario,
                          name: e.target.value
                        })}
                        className="scenario-name-input"
                        placeholder="Scenario name"
                      />
                    ) : (
                      <h4>{scenarios[activeTab].name}</h4>
                    )}
                  </div>
                  <div className="scenario-actions">
                    <button
                      className="btn-reset"
                      onClick={() => resetScenario(scenarios[activeTab])}
                      title="Reset to baseline (clear all adjustments)"
                    >
                      Reset
                    </button>
                    <button
                      className={editingScenario?.id === scenarios[activeTab].id ? 'btn-save' : 'btn-edit'}
                      onClick={() => {
                        if (editingScenario?.id === scenarios[activeTab].id) {
                          updateScenario(editingScenario)
                        } else {
                          setEditingScenario({...scenarios[activeTab]})
                        }
                      }}
                    >
                      {editingScenario?.id === scenarios[activeTab].id ? 'Save Scenario' : 'Edit Assumptions'}
                    </button>
                  </div>
                </div>

                {/* Assumptions Input Section */}
                {editingScenario?.id === scenarios[activeTab].id && (
                  <div className="assumptions-form">
                    <div className="form-section">
                      <h5>Rent Adjustments (Applied to All Floorplans)</h5>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Base Rent % Change</label>
                          <input
                            type="number"
                            step="0.1"
                            value={editingScenario.base_rent_pct_adj * 100}
                            onChange={(e) => setEditingScenario({
                              ...editingScenario,
                              base_rent_pct_adj: parseFloat(e.target.value) / 100 || 0
                            })}
                            placeholder="e.g., 5 for +5%"
                          />
                        </div>
                        <div className="form-group">
                          <label>Base Rent $ Amount</label>
                          <input
                            type="number"
                            step="1"
                            value={editingScenario.base_rent_dollar_adj}
                            onChange={(e) => setEditingScenario({
                              ...editingScenario,
                              base_rent_dollar_adj: parseFloat(e.target.value) || 0
                            })}
                            placeholder="e.g., 50"
                          />
                        </div>
                        <div className="form-group">
                          <label>Amenity % Change</label>
                          <input
                            type="number"
                            step="0.1"
                            value={editingScenario.amenity_rent_pct_adj * 100}
                            onChange={(e) => setEditingScenario({
                              ...editingScenario,
                              amenity_rent_pct_adj: parseFloat(e.target.value) / 100 || 0
                            })}
                            placeholder="e.g., 5 for +5%"
                          />
                        </div>
                        <div className="form-group">
                          <label>Amenity $ Amount</label>
                          <input
                            type="number"
                            step="1"
                            value={editingScenario.amenity_rent_dollar_adj}
                            onChange={(e) => setEditingScenario({
                              ...editingScenario,
                              amenity_rent_dollar_adj: parseFloat(e.target.value) || 0
                            })}
                            placeholder="e.g., 10"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-section">
                      <h5>Concessions</h5>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Concession Type</label>
                          <select
                            value={editingScenario.concession_type}
                            onChange={(e) => setEditingScenario({
                              ...editingScenario,
                              concession_type: e.target.value as any,
                              concession_value: 0
                            })}
                          >
                            <option value="none">None</option>
                            <option value="percentage">Percentage Off</option>
                            <option value="dollar">Dollar Amount Off</option>
                            <option value="free_months">Free Months</option>
                          </select>
                        </div>
                        {editingScenario.concession_type !== 'none' && (
                          <div className="form-group">
                            <label>
                              {editingScenario.concession_type === 'percentage' ? 'Percentage Value' :
                               editingScenario.concession_type === 'dollar' ? 'Dollar Amount' :
                               'Number of Months'}
                            </label>
                            <input
                              type="number"
                              step={editingScenario.concession_type === 'percentage' ? '0.1' : '1'}
                              value={editingScenario.concession_value}
                              onChange={(e) => setEditingScenario({
                                ...editingScenario,
                                concession_value: parseFloat(e.target.value) || 0
                              })}
                              placeholder={
                                editingScenario.concession_type === 'percentage' ? 'e.g., 10 for 10% off' :
                                editingScenario.concession_type === 'dollar' ? 'e.g., 100' :
                                'e.g., 1'
                              }
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Floorplan Table with Adjusted Values */}
                <div className="floorplan-results">
                  <h5>Floorplan Breakdown with Adjustments</h5>
                  <table className="floorplan-table">
                    <thead>
                      <tr>
                        <th>Floorplan</th>
                        <th>Type</th>
                        <th>Units</th>
                        <th>Sq Ft</th>
                        <th>Base Rent</th>
                        <th>Adjusted Base</th>
                        <th>Amenity</th>
                        <th>Adjusted Amenity</th>
                        <th>Gross Rent</th>
                        <th>Concession</th>
                        <th>Net Effective</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProperty.floorplans.map(fp => {
                        const currentScenario = editingScenario?.id === scenarios[activeTab].id
                          ? editingScenario
                          : scenarios[activeTab]

                        const adjustedBase = (fp.base_rent * (1 + currentScenario.base_rent_pct_adj)) + currentScenario.base_rent_dollar_adj
                        const adjustedAmenity = (fp.amenity_rent * (1 + currentScenario.amenity_rent_pct_adj)) + currentScenario.amenity_rent_dollar_adj
                        const grossRent = adjustedBase + adjustedAmenity

                        let concessionAmount = 0
                        let netEffective = grossRent

                        if (currentScenario.concession_type === 'percentage') {
                          concessionAmount = grossRent * (currentScenario.concession_value / 100)
                          netEffective = grossRent - concessionAmount
                        } else if (currentScenario.concession_type === 'dollar') {
                          concessionAmount = currentScenario.concession_value
                          netEffective = Math.max(0, grossRent - concessionAmount)
                        } else if (currentScenario.concession_type === 'free_months') {
                          concessionAmount = grossRent * (currentScenario.concession_value / 12)
                          netEffective = grossRent * ((12 - currentScenario.concession_value) / 12)
                        }

                        return (
                          <tr key={fp.id}>
                            <td><strong>{fp.name}</strong></td>
                            <td>{fp.unit_type}</td>
                            <td>{fp.unit_count}</td>
                            <td>{fp.square_footage.toLocaleString()}</td>
                            <td>{formatCurrency(fp.base_rent)}</td>
                            <td className={adjustedBase !== fp.base_rent ? 'adjusted' : ''}>
                              {formatCurrency(adjustedBase)}
                            </td>
                            <td>{formatCurrency(fp.amenity_rent)}</td>
                            <td className={adjustedAmenity !== fp.amenity_rent ? 'adjusted' : ''}>
                              {formatCurrency(adjustedAmenity)}
                            </td>
                            <td className="gross-rent">{formatCurrency(grossRent)}</td>
                            <td className={concessionAmount > 0 ? 'concession' : ''}>
                              {concessionAmount > 0 ? `-${formatCurrency(concessionAmount)}` : '-'}
                            </td>
                            <td className="net-effective">{formatCurrency(netEffective)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="totals-row">
                        <td colSpan={2}><strong>Total Units</strong></td>
                        <td><strong>{selectedProperty.floorplans.reduce((sum, fp) => sum + fp.unit_count, 0)}</strong></td>
                        <td colSpan={8}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {calculating ? (
            <div className="calculating">Calculating scenarios...</div>
          ) : (
            <>
              {/* Metrics Summary */}
              <div className="metrics-grid">
                {scenarios.map(scenario => (
                  <div key={scenario.id} className="scenario-card">
                    <h3>{scenario.name}</h3>
                    <div className="scenario-adjustments">
                      {scenario.base_rent_pct_adj !== 0 && (
                        <span className="adjustment">
                          Base Rent: {formatPercent(scenario.base_rent_pct_adj)}
                        </span>
                      )}
                      {scenario.amenity_rent_pct_adj !== 0 && (
                        <span className="adjustment">
                          Amenity: {formatPercent(scenario.amenity_rent_pct_adj)}
                        </span>
                      )}
                      {scenario.concession_type !== 'none' && (
                        <span className="adjustment concession">
                          {scenario.concession_type === 'free_months'
                            ? `${scenario.concession_value} month${scenario.concession_value > 1 ? 's' : ''} free`
                            : `${scenario.concession_type}: ${scenario.concession_value}`}
                        </span>
                      )}
                    </div>
                    {scenario.results && (
                      <div className="scenario-metrics">
                        <div className="metric">
                          <span className="metric-label">Annual Revenue</span>
                          <span className="metric-value">
                            {formatCurrency(scenario.results.total_annual_revenue)}
                          </span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Avg Rent/Unit</span>
                          <span className="metric-value">
                            {formatCurrency(scenario.results.avg_rent_per_unit)}
                          </span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Revenue/SqFt</span>
                          <span className="metric-value">
                            {formatCurrency(scenario.results.revenue_per_sqft)}
                          </span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Weighted Avg Rent</span>
                          <span className="metric-value">
                            {formatCurrency(scenario.results.weighted_avg_rent)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Revenue Comparison Chart */}
              {scenarios.length > 0 && scenarios[0].results && (
                <div className="chart-section">
                  <div className="chart-container">
                    <Bar data={chartData} options={chartOptions} />
                  </div>
                </div>
              )}

              {/* Sensitivity Table */}
              <div className="sensitivity-table-section">
                <h2>Sensitivity Analysis Table</h2>
                <table className="sensitivity-table">
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>Base Rent Adj</th>
                      <th>Amenity Adj</th>
                      <th>Concessions</th>
                      <th>Annual Revenue</th>
                      <th>Avg Rent/Unit</th>
                      <th>Revenue/SqFt</th>
                      <th>Weighted Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map(scenario => (
                      <tr key={scenario.id}>
                        <td><strong>{scenario.name}</strong></td>
                        <td>
                          {scenario.base_rent_pct_adj !== 0
                            ? formatPercent(scenario.base_rent_pct_adj)
                            : scenario.base_rent_dollar_adj !== 0
                            ? formatCurrency(scenario.base_rent_dollar_adj)
                            : '-'}
                        </td>
                        <td>
                          {scenario.amenity_rent_pct_adj !== 0
                            ? formatPercent(scenario.amenity_rent_pct_adj)
                            : scenario.amenity_rent_dollar_adj !== 0
                            ? formatCurrency(scenario.amenity_rent_dollar_adj)
                            : '-'}
                        </td>
                        <td>
                          {scenario.concession_type === 'none' ? '-' :
                            scenario.concession_type === 'free_months'
                            ? `${scenario.concession_value}mo free`
                            : `${scenario.concession_value}`}
                        </td>
                        <td>{scenario.results ? formatCurrency(scenario.results.total_annual_revenue) : '-'}</td>
                        <td>{scenario.results ? formatCurrency(scenario.results.avg_rent_per_unit) : '-'}</td>
                        <td>{scenario.results ? formatCurrency(scenario.results.revenue_per_sqft) : '-'}</td>
                        <td>{scenario.results ? formatCurrency(scenario.results.weighted_avg_rent) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default App 