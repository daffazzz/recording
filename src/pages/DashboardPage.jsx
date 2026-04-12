import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { STANDARD_DATA, SACK_WEIGHT_GRAM, truncateNumber } from '../lib/standardData'
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { Scale, TrendingUp, Wheat, Activity, Users, Skull, Home, Calendar } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export default function DashboardPage({ onNavigate }) {
    const {
        farms, selectedFarm, setSelectedFarm,
        periods, selectedPeriod, setSelectedPeriod,
        records, unit,
    } = useApp()

    // Calculate metrics
    const metrics = useMemo(() => {
        if (!selectedPeriod || records.length === 0) return null

        let prevBw = selectedPeriod.doc_weight || 40
        const processed = records.map((row, idx) => {
            const pop = row.current_population || computePop(records, idx, selectedPeriod.initial_population)
            const totalSacks = row.feed_sacks_added || 0
            const remainingSacks = row.feed_sacks_remaining || 0
            const cumConsumed = Math.max(0, (totalSacks - remainingSacks)) * SACK_WEIGHT_GRAM
            const cumFeedIntake = row.manual_cum_feed_intake ?? (pop > 0 && cumConsumed > 0 ? cumConsumed / pop : 0)
            const bw = row.bw !== null ? parseFloat(row.bw) : null
            const dailyGain = row.manual_daily_gain ?? (bw !== null ? bw - prevBw : null)
            const fcr = row.manual_fcr ?? (bw && bw > 0 && cumFeedIntake > 0 ? cumFeedIntake / bw : null)
            if (bw !== null) prevBw = bw
            return { ...row, pop, cumFeedIntake, dailyGain, fcr, bw }
        })

        const lastRecord = processed.filter(r => r.bw !== null).slice(-1)[0]
        const currentDay = records.length > 0 ? records[records.length - 1].day : 0
        const std = STANDARD_DATA.find(s => s.day === (lastRecord?.day || 0))
        const totalDepletion = records.reduce((sum, r) => sum + (r.depletion || 0), 0)
        const currentPop = lastRecord?.pop || selectedPeriod.initial_population
        const mortalityRate = (totalDepletion / selectedPeriod.initial_population * 100)

        return {
            currentDay,
            lastBw: lastRecord?.bw || 0,
            lastFcr: lastRecord?.fcr || 0,
            lastCumFeed: lastRecord?.cumFeedIntake || 0,
            lastDailyGain: lastRecord?.dailyGain || 0,
            totalDepletion,
            currentPop,
            mortalityRate,
            stdBw: std?.bw || 0,
            stdFcr: std?.fcr || 0,
            processed,
        }
    }, [records, selectedPeriod])

    const convert = (val) => {
        if (!val) return 0
        return unit === 'kg' ? val / 1000 : val
    }

    const formatNum = (val, dec = 2) => {
        return truncateNumber(val, dec)
    }

    // Mini chart data
    const miniChartData = useMemo(() => {
        if (!metrics?.processed) return null
        const bwData = metrics.processed.filter(r => r.bw !== null).map(r => ({ x: r.day, y: convert(r.bw) }))
        const stdBwData = STANDARD_DATA.filter(s => s.day <= (metrics.currentDay || 35)).map(s => ({ x: s.day, y: convert(s.bw) }))
        const labels = Array.from({ length: (metrics.currentDay || 0) + 1 }, (_, i) => i)

        return {
            labels,
            datasets: [
                {
                    label: 'Aktual',
                    data: bwData.map(d => d.y),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 0,
                    borderWidth: 2,
                },
                {
                    label: 'Standar',
                    data: stdBwData.map(d => d.y),
                    borderColor: '#10b981',
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    borderDash: [4, 2],
                    pointRadius: 0,
                    borderWidth: 1.5,
                },
            ]
        }
    }, [metrics, unit])

    const miniOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
        },
        scales: {
            x: { display: false },
            y: { display: false },
        },
    }

    return (
        <>
            <div className="page-header">
                <h2>📊 Dashboard</h2>
                <p>Ringkasan performa ternak Anda</p>
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
                            <option value="">-- Pilih Peternakan --</option>
                            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                    {selectedFarm && (
                        <div className="selector-item">
                            <label>Periode</label>
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
                    )}
                </div>

                {!selectedFarm || !selectedPeriod ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📊</div>
                        <h3>Selamat Datang di FarmRecord</h3>
                        <p>Pilih peternakan dan periode untuk melihat dashboard performa, atau tambahkan data baru</p>
                        <div className="btn-group" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-primary" onClick={() => onNavigate('farms')}>
                                <Home size={16} /> Kelola Peternakan
                            </button>
                            <button className="btn btn-success" onClick={() => onNavigate('recording')}>
                                <Calendar size={16} /> Input Recording
                            </button>
                        </div>
                    </div>
                ) : !metrics ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <h3>Belum Ada Data</h3>
                        <p>Mulai input data recording untuk melihat dashboard</p>
                        <button className="btn btn-primary" onClick={() => onNavigate('recording')}>
                            Input Recording
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Stats Grid */}
                        <div className="stats-grid">
                            <div className="stat-card blue">
                                <div className="stat-card-icon"><Scale size={20} /></div>
                                <div className="stat-card-label">Body Weight</div>
                                <div className="stat-card-value">{formatNum(convert(metrics.lastBw))}</div>
                                <div className="stat-card-sub">{unit === 'kg' ? 'kg' : 'gram'} (Hari {metrics.currentDay})</div>
                                {metrics.stdBw > 0 && (
                                    <div className={`stat-card-compare ${metrics.lastBw >= metrics.stdBw ? 'up' : 'down'}`}>
                                        {metrics.lastBw >= metrics.stdBw ? '▲' : '▼'}
                                        {' '}{truncateNumber(Math.abs((metrics.lastBw - metrics.stdBw) / metrics.stdBw * 100), 1)}% vs Standar
                                    </div>
                                )}
                            </div>

                            <div className="stat-card green">
                                <div className="stat-card-icon"><Activity size={20} /></div>
                                <div className="stat-card-label">FCR</div>
                                <div className="stat-card-value">{metrics.lastFcr ? truncateNumber(metrics.lastFcr, 3) : '-'}</div>
                                <div className="stat-card-sub">Feed Conversion Ratio</div>
                                {metrics.stdFcr > 0 && metrics.lastFcr > 0 && (
                                    <div className={`stat-card-compare ${metrics.lastFcr <= metrics.stdFcr ? 'up' : 'down'}`}>
                                        {metrics.lastFcr <= metrics.stdFcr ? '▲ Baik' : '▼ Tinggi'}
                                        {' '}{truncateNumber(Math.abs((metrics.lastFcr - metrics.stdFcr) / metrics.stdFcr * 100), 1)}%
                                    </div>
                                )}
                            </div>

                            <div className="stat-card orange">
                                <div className="stat-card-icon"><Wheat size={20} /></div>
                                <div className="stat-card-label">Cum Feed Intake</div>
                                <div className="stat-card-value">{formatNum(convert(metrics.lastCumFeed))}</div>
                                <div className="stat-card-sub">{unit === 'kg' ? 'kg' : 'gram'} / ekor</div>
                            </div>

                            <div className="stat-card purple">
                                <div className="stat-card-icon"><TrendingUp size={20} /></div>
                                <div className="stat-card-label">Daily Gain</div>
                                <div className="stat-card-value">
                                    {metrics.lastDailyGain ? formatNum(convert(metrics.lastDailyGain)) : '-'}
                                </div>
                                <div className="stat-card-sub">{unit === 'kg' ? 'kg' : 'gram'} / hari</div>
                            </div>

                            <div className="stat-card cyan">
                                <div className="stat-card-icon"><Users size={20} /></div>
                                <div className="stat-card-label">Populasi</div>
                                <div className="stat-card-value">{metrics.currentPop?.toLocaleString()}</div>
                                <div className="stat-card-sub">dari {selectedPeriod.initial_population?.toLocaleString()} ekor</div>
                            </div>

                            <div className="stat-card red">
                                <div className="stat-card-icon"><Skull size={20} /></div>
                                <div className="stat-card-label">Deplesi Total</div>
                                <div className="stat-card-value">{metrics.totalDepletion}</div>
                                <div className="stat-card-sub">Mortalitas: {truncateNumber(metrics.mortalityRate, 2)}%</div>
                            </div>
                        </div>

                        {/* Mini BW Chart */}
                        {miniChartData && (
                            <div className="card" style={{ marginBottom: 20 }}>
                                <div className="card-header">
                                    <h3>📈 Tren Body Weight vs Standar</h3>
                                    <button className="btn btn-outline btn-sm" onClick={() => onNavigate('charts')}>
                                        Lihat Semua Grafik →
                                    </button>
                                </div>
                                <div style={{ height: 280, padding: '16px 20px' }}>
                                    <Line data={miniChartData} options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                position: 'top',
                                                labels: { color: '#94a3b8', usePointStyle: true, font: { size: 11 } },
                                            },
                                        },
                                        scales: {
                                            x: {
                                                grid: { color: 'rgba(45,51,72,0.3)' },
                                                ticks: { color: '#64748b', font: { size: 10 } },
                                            },
                                            y: {
                                                grid: { color: 'rgba(45,51,72,0.3)' },
                                                ticks: { color: '#64748b', font: { size: 10 } },
                                            },
                                        },
                                    }} />
                                </div>
                            </div>
                        )}

                        {/* Quick summary table */}
                        <div className="card">
                            <div className="card-header">
                                <h3>📋 Data Terahir vs Standar</h3>
                            </div>
                            <div className="card-body" style={{ padding: 0 }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Parameter</th>
                                            <th>Aktual</th>
                                            <th>Standar</th>
                                            <th>Selisih</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><strong>Body Weight</strong></td>
                                            <td>{formatNum(convert(metrics.lastBw))} {unit === 'kg' ? 'kg' : 'g'}</td>
                                            <td>{formatNum(convert(metrics.stdBw))} {unit === 'kg' ? 'kg' : 'g'}</td>
                                            <td className={metrics.lastBw >= metrics.stdBw ? 'cell-highlight' : 'cell-danger'}>
                                                {metrics.stdBw ? `${truncateNumber(((metrics.lastBw - metrics.stdBw) / metrics.stdBw * 100), 1)}%` : '-'}
                                            </td>
                                            <td>
                                                <span className={`badge ${metrics.lastBw >= metrics.stdBw ? 'badge-green' : 'badge-red'}`}>
                                                    {metrics.lastBw >= metrics.stdBw ? 'Baik' : 'Di Bawah'}
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td><strong>FCR</strong></td>
                                            <td>{metrics.lastFcr ? truncateNumber(metrics.lastFcr, 3) : '-'}</td>
                                            <td>{metrics.stdFcr ? truncateNumber(metrics.stdFcr, 3) : '-'}</td>
                                            <td className={metrics.lastFcr <= metrics.stdFcr ? 'cell-highlight' : 'cell-danger'}>
                                                {metrics.stdFcr && metrics.lastFcr
                                                    ? `${truncateNumber(((metrics.lastFcr - metrics.stdFcr) / metrics.stdFcr * 100), 1)}%`
                                                    : '-'
                                                }
                                            </td>
                                            <td>
                                                <span className={`badge ${metrics.lastFcr <= metrics.stdFcr ? 'badge-green' : 'badge-red'}`}>
                                                    {metrics.lastFcr <= metrics.stdFcr ? 'Baik' : 'Tinggi'}
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td><strong>Mortalitas</strong></td>
                                            <td>{truncateNumber(metrics.mortalityRate, 2)}%</td>
                                            <td>{'< 5%'}</td>
                                            <td className={metrics.mortalityRate < 5 ? 'cell-highlight' : 'cell-danger'}>
                                                {truncateNumber(metrics.mortalityRate, 2)}%
                                            </td>
                                            <td>
                                                <span className={`badge ${metrics.mortalityRate < 5 ? 'badge-green' : 'badge-red'}`}>
                                                    {metrics.mortalityRate < 5 ? 'Baik' : 'Tinggi'}
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
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
