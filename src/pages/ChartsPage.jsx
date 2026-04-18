import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { STANDARD_DATA, SACK_WEIGHT_GRAM, truncateNumber } from '../lib/standardData'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement, BarElement,
    Title, Tooltip, Legend, Filler
)

const CHART_COLORS = [
    { border: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    { border: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    { border: '#ec4899', bg: 'rgba(236,72,153,0.15)' },
    { border: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
    { border: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
]

const STD_COLOR = { border: '#10b981', bg: 'rgba(16,185,129,0.1)' }

const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'top',
            labels: {
                color: '#94a3b8',
                usePointStyle: true,
                pointStyle: 'circle',
                padding: 16,
                font: { size: 11, family: 'Inter' },
            },
        },
        tooltip: {
            backgroundColor: '#1e2230',
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            borderColor: '#2d3348',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            titleFont: { family: 'Inter', weight: '600' },
            bodyFont: { family: 'Inter' },
        },
    },
    scales: {
        x: {
            grid: { color: 'rgba(45,51,72,0.5)', drawBorder: false },
            ticks: { color: '#64748b', font: { size: 10, family: 'Inter' } },
        },
        y: {
            grid: { color: 'rgba(45,51,72,0.5)', drawBorder: false },
            ticks: { color: '#64748b', font: { size: 10, family: 'Inter' } },
        },
    },
    interaction: {
        mode: 'index',
        intersect: false,
    },
}

export default function ChartsPage() {
    const {
        farms, selectedFarm, setSelectedFarm,
        periods, selectedPeriod, setSelectedPeriod,
        records, unit, fetchRecordsForPeriod,
    } = useApp()

    const [showStandard, setShowStandard] = useState(true)
    const [comparePeriods, setComparePeriods] = useState([])
    const [compareData, setCompareData] = useState({}) // { periodId: records[] }

    // Load comparison data
    useEffect(() => {
        const loadCompare = async () => {
            const data = {}
            for (const periodId of comparePeriods) {
                if (!compareData[periodId]) {
                    const recs = await fetchRecordsForPeriod(periodId)
                    data[periodId] = recs
                }
            }
            if (Object.keys(data).length > 0) {
                setCompareData(prev => ({ ...prev, ...data }))
            }
        }
        loadCompare()
    }, [comparePeriods, fetchRecordsForPeriod])

    const toggleComparePeriod = (periodId) => {
        setComparePeriods(prev =>
            prev.includes(periodId)
                ? prev.filter(id => id !== periodId)
                : [...prev, periodId]
        )
    }

    // Calculate computed records
    // Total Pakan = total sak yang sudah diberikan (absolut), Sisa Pakan = sisa hari itu
    // Cum consumed = (Total Pakan - Sisa Pakan) * 50kg
    const processRecords = (rawRecords, period) => {
        if (!rawRecords || !period) return []
        let prevBw = period.doc_weight || 40
        let prevCumConsumed = 0

        return rawRecords.map((row, idx) => {
            const population = row.current_population || computePop(rawRecords, idx, period.initial_population)
            const totalSacks = row.feed_sacks_added || 0
            const remainingSacks = row.feed_sacks_remaining || 0
            const cumConsumed = Math.max(0, (totalSacks - remainingSacks)) * SACK_WEIGHT_GRAM

            const cumFeedIntake = row.manual_cum_feed_intake ?? (population > 0 && cumConsumed > 0 ? cumConsumed / population : 0)
            const dailyDiff = cumConsumed - prevCumConsumed
            const dailyFeedIntake = row.manual_daily_feed_intake ?? (population > 0 && dailyDiff > 0 ? dailyDiff / population : 0)
            if (cumConsumed > 0) prevCumConsumed = cumConsumed

            const bw = row.bw !== null ? parseFloat(row.bw) : null
            const dailyGain = row.manual_daily_gain ?? (bw !== null && prevBw !== null ? bw - prevBw : null)
            const fcr = row.manual_fcr ?? (bw && bw > 0 && cumFeedIntake > 0 ? cumFeedIntake / bw : null)
            if (bw !== null) prevBw = bw

            return { ...row, population, cumFeedIntake, dailyFeedIntake, dailyGain, fcr, bw }
        })
    }

    const currentData = useMemo(() => processRecords(records, selectedPeriod), [records, selectedPeriod])

    // Kumpulkan hari-hari yang punya data ayam (current + compare)
    const activeDays = useMemo(() => {
        const days = new Set()
        currentData.forEach(r => days.add(r.day))
        comparePeriods.forEach(pid => {
            const recs = compareData[pid]
            if (recs) {
                const period = periods.find(p => p.id === pid)
                const processed = processRecords(recs, period)
                processed.forEach(r => days.add(r.day))
            }
        })
        return days
    }, [currentData, comparePeriods, compareData, periods])

    const maxDay = useMemo(() => {
        let max = 0
        if (currentData.length > 0) max = Math.max(max, currentData[currentData.length - 1].day)
        comparePeriods.forEach(pid => {
            const recs = compareData[pid]
            if (recs && recs.length > 0) max = Math.max(max, recs[recs.length - 1].day)
        })
        return max
    }, [currentData, comparePeriods, compareData])

    const labels = useMemo(() => Array.from({ length: maxDay + 1 }, (_, i) => `Hari ${i}`), [maxDay])

    const convert = (val) => {
        if (val === null || val === undefined) return null
        return unit === 'kg' ? val / 1000 : val
    }

    // Build chart datasets
    const buildChart = (title, getter, stdGetter, yLabel) => {
        const datasets = []

        // Current period
        if (selectedPeriod && currentData.length > 0) {
            const data = Array(maxDay + 1).fill(null)
            currentData.forEach(r => {
                const val = getter(r)
                if (val !== null && val !== undefined && !isNaN(val) && val !== 0) {
                    data[r.day] = val
                }
            })
            datasets.push({
                label: selectedPeriod.name,
                data,
                borderColor: CHART_COLORS[0].border,
                backgroundColor: CHART_COLORS[0].bg,
                tension: 0.3,
                fill: true,
                pointRadius: 3,
                pointHoverRadius: 5,
                borderWidth: 2,
            })
        }

        // Standard – hanya tampilkan pada hari yang ada data ayam aktual
        if (showStandard && stdGetter) {
            const data = Array(maxDay + 1).fill(null)
            STANDARD_DATA.forEach(s => {
                if (!activeDays.has(s.day)) return // skip hari tanpa data ayam
                const val = stdGetter(s)
                if (val !== null && val !== undefined && val !== 0) {
                    data[s.day] = val
                }
            })
            datasets.push({
                label: 'Standar',
                data,
                borderColor: STD_COLOR.border,
                backgroundColor: STD_COLOR.bg,
                tension: 0.3,
                fill: false,
                borderDash: [6, 3],
                pointRadius: 2,
                pointHoverRadius: 4,
                borderWidth: 2,
            })
        }

        // Compare periods
        comparePeriods.forEach((pid, ci) => {
            const period = periods.find(p => p.id === pid)
            const recs = compareData[pid]
            if (!period || !recs) return
            const processed = processRecords(recs, period)
            const data = Array(maxDay + 1).fill(null)
            processed.forEach(r => {
                const val = getter(r)
                if (val !== null && val !== undefined && !isNaN(val) && val !== 0) {
                    data[r.day] = val
                }
            })
            const color = CHART_COLORS[(ci + 1) % CHART_COLORS.length]
            datasets.push({
                label: period.name,
                data,
                borderColor: color.border,
                backgroundColor: color.bg,
                tension: 0.3,
                fill: false,
                pointRadius: 2,
                pointHoverRadius: 4,
                borderWidth: 2,
            })
        })

        return {
            labels,
            datasets,
        }
    }

    const bwChart = buildChart(
        'Body Weight',
        r => convert(r.bw),
        s => convert(s.bw),
        unit === 'kg' ? 'kg' : 'gram'
    )

    const fcrChart = buildChart(
        'FCR',
        r => r.fcr,
        s => s.fcr,
        'FCR'
    )

    const cumFeedChart = buildChart(
        'Cumulative Feed Intake',
        r => convert(r.cumFeedIntake),
        s => convert(s.cumFeedIntake),
        unit === 'kg' ? 'kg/ekor' : 'gram/ekor'
    )

    const dailyGainChart = buildChart(
        'Daily Gain',
        r => convert(r.dailyGain),
        s => convert(s.dailyGain),
        unit === 'kg' ? 'kg' : 'gram'
    )

    const dailyFeedChart = buildChart(
        'Daily Feed Intake',
        r => convert(r.dailyFeedIntake),
        s => convert(s.feedIntake),
        unit === 'kg' ? 'kg/ekor' : 'gram/ekor'
    )

    const depletionChart = buildChart(
        'Deplesi',
        r => r.depletion || 0,
        null,
        'ekor'
    )

    const populationChart = buildChart(
        'Populasi',
        r => r.population,
        null,
        'ekor'
    )

    if (!selectedFarm) {
        return (
            <>
                <div className="page-header">
                    <h2>📊 Grafik & Analisis</h2>
                    <p>Pilih peternakan terlebih dahulu</p>
                </div>
                <div className="page-body">
                    <div className="empty-state">
                        <div className="empty-state-icon">📈</div>
                        <h3>Pilih Peternakan</h3>
                        <p>Pilih peternakan dari sidebar untuk melihat grafik</p>
                    </div>
                </div>
            </>
        )
    }

    return (
        <>
            <div className="page-header">
                <h2>📊 Grafik & Analisis</h2>
                <p>{selectedFarm.name} {selectedPeriod ? `› ${selectedPeriod.name}` : ''}</p>
            </div>

            <div className="page-body">
                {/* Selectors */}
                <div className="selector-row">
                    <div className="selector-item">
                        <label>Peternakan</label>
                        <select
                            className="form-select"
                            value={selectedFarm?.id || ''}
                            onChange={e => {
                                const farm = farms.find(f => f.id === e.target.value)
                                setSelectedFarm(farm || null)
                            }}
                        >
                            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                    <div className="selector-item">
                        <label>Periode Utama</label>
                        <select
                            className="form-select"
                            value={selectedPeriod?.id || ''}
                            onChange={e => {
                                const period = periods.find(p => p.id === e.target.value)
                                setSelectedPeriod(period || null)
                            }}
                        >
                            <option value="">-- Pilih Periode --</option>
                            {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Comparison options */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">
                        <h3>⚙️ Opsi Perbandingan</h3>
                    </div>
                    <div className="card-body compare-options">
                        <label className="compare-checkbox">
                            <input
                                type="checkbox"
                                checked={showStandard}
                                onChange={e => setShowStandard(e.target.checked)}
                            />
                            Tampilkan Standar
                        </label>
                        {periods.filter(p => p.id !== selectedPeriod?.id).map(period => (
                            <label key={period.id} className="compare-checkbox">
                                <input
                                    type="checkbox"
                                    checked={comparePeriods.includes(period.id)}
                                    onChange={() => toggleComparePeriod(period.id)}
                                />
                                {period.name}
                            </label>
                        ))}
                    </div>
                </div>

                {!selectedPeriod ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📈</div>
                        <h3>Pilih Periode</h3>
                        <p>Pilih periode untuk melihat grafik performa</p>
                    </div>
                ) : (
                    <>
                        {/* Charts Grid */}
                        <div className="charts-grid">
                            <div className="card">
                                <div className="card-header">
                                    <h3>📈 Body Weight ({unit === 'kg' ? 'kg' : 'gram'})</h3>
                                </div>
                                <div className="chart-container">
                                    <Line data={bwChart} options={{
                                        ...commonOptions,
                                        plugins: {
                                            ...commonOptions.plugins,
                                            title: { display: false },
                                        },
                                    }} />
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h3>📉 FCR</h3>
                                </div>
                                <div className="chart-container">
                                    <Line data={fcrChart} options={{
                                        ...commonOptions,
                                        plugins: {
                                            ...commonOptions.plugins,
                                            title: { display: false },
                                        },
                                    }} />
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h3>🌾 Cumulative Feed Intake ({unit === 'kg' ? 'kg/ekor' : 'gram/ekor'})</h3>
                                </div>
                                <div className="chart-container">
                                    <Line data={cumFeedChart} options={{
                                        ...commonOptions,
                                        plugins: {
                                            ...commonOptions.plugins,
                                            title: { display: false },
                                        },
                                    }} />
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h3>⬆️ Daily Gain ({unit === 'kg' ? 'kg' : 'gram'})</h3>
                                </div>
                                <div className="chart-container">
                                    <Line data={dailyGainChart} options={{
                                        ...commonOptions,
                                        plugins: {
                                            ...commonOptions.plugins,
                                            title: { display: false },
                                        },
                                    }} />
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h3>🍽️ Daily Feed Intake ({unit === 'kg' ? 'kg/ekor' : 'gram/ekor'})</h3>
                                </div>
                                <div className="chart-container">
                                    <Line data={dailyFeedChart} options={{
                                        ...commonOptions,
                                        plugins: {
                                            ...commonOptions.plugins,
                                            title: { display: false },
                                        },
                                    }} />
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h3>💀 Deplesi (ekor)</h3>
                                </div>
                                <div className="chart-container">
                                    <Bar data={depletionChart} options={{
                                        ...commonOptions,
                                        plugins: {
                                            ...commonOptions.plugins,
                                            title: { display: false },
                                        },
                                    }} />
                                </div>
                            </div>

                            <div className="card" style={{ gridColumn: '1 / -1' }}>
                                <div className="card-header">
                                    <h3>👥 Populasi (ekor)</h3>
                                </div>
                                <div className="chart-container">
                                    <Line data={populationChart} options={{
                                        ...commonOptions,
                                        plugins: {
                                            ...commonOptions.plugins,
                                            title: { display: false },
                                        },
                                    }} />
                                </div>
                            </div>
                        </div>

                        {/* Standard Data Table */}
                        {showStandard && (
                            <div className="card">
                                <div className="card-header">
                                    <h3>📋 Tabel Standar Broiler</h3>
                                </div>
                                <div className="card-body" style={{ padding: 0 }}>
                                    <div className="table-container" style={{ maxHeight: 400 }}>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Hari</th>
                                                    <th>BW ({unit === 'kg' ? 'kg' : 'g'})</th>
                                                    <th>Daily Gain ({unit === 'kg' ? 'kg' : 'g'})</th>
                                                    <th>Avg Daily Gain ({unit === 'kg' ? 'kg' : 'g'})</th>
                                                    <th>Feed Intake ({unit === 'kg' ? 'kg' : 'g'})</th>
                                                    <th>Cum Feed ({unit === 'kg' ? 'kg' : 'g'})</th>
                                                    <th>FCR</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {STANDARD_DATA.map(s => (
                                                    <tr key={s.day} style={s.day % 7 === 0 ? { background: 'rgba(245,158,11,0.05)' } : {}}>
                                                        <td style={{ fontWeight: s.day % 7 === 0 ? 700 : 400, color: s.day % 7 === 0 ? 'var(--accent-orange)' : '' }}>
                                                            {s.day}
                                                        </td>
                                                        <td>{convert(s.bw) ? truncateNumber(convert(s.bw), unit === 'kg' ? 3 : 0) : '-'}</td>
                                                        <td>{convert(s.dailyGain) ? truncateNumber(convert(s.dailyGain), unit === 'kg' ? 3 : 0) : '-'}</td>
                                                        <td>{s.avgDailyGain ? truncateNumber(convert(s.avgDailyGain), unit === 'kg' ? 3 : 2) : '-'}</td>
                                                        <td>{convert(s.feedIntake) ? truncateNumber(convert(s.feedIntake), unit === 'kg' ? 3 : 0) : '-'}</td>
                                                        <td>{convert(s.cumFeedIntake) ? truncateNumber(convert(s.cumFeedIntake), unit === 'kg' ? 3 : 0) : '-'}</td>
                                                        <td>{s.fcr ? truncateNumber(s.fcr, 3) : '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    )
}

function computePop(rows, idx, initialPop) {
    let pop = initialPop
    for (let i = 0; i <= idx; i++) {
        if (rows[i].current_population) {
            pop = rows[i].current_population
        } else {
            pop -= (rows[i].depletion || 0)
        }
    }
    return Math.max(0, pop)
}
