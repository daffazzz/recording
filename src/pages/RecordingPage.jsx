import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { STANDARD_DATA, SACK_WEIGHT_GRAM, calcFCR, formatValue, truncateNumber } from '../lib/standardData'
import { Plus, Save, Trash2, X, Calendar, Users, ChevronDown } from 'lucide-react'

export default function RecordingPage() {
    const {
        farms, selectedFarm, setSelectedFarm,
        periods, selectedPeriod, setSelectedPeriod,
        records, unit, addToast,
        addPeriod, deletePeriod,
        saveMultipleRecords, deleteRecord,
    } = useApp()

    const [showPeriodModal, setShowPeriodModal] = useState(false)
    const [periodForm, setPeriodForm] = useState({
        name: '', start_date: '', initial_population: '', doc_weight: '40', notes: ''
    })
    const [editRows, setEditRows] = useState([])
    const [saving, setSaving] = useState(false)

    // Initialize edit rows from records
    useEffect(() => {
        if (selectedPeriod && records) {
            // Create rows for days 0-35 (or more if records exist beyond 35)
            const maxDay = Math.max(35, ...records.map(r => r.day))
            const rows = []
            for (let day = 0; day <= maxDay; day++) {
                const existing = records.find(r => r.day === day)
                if (existing) {
                    rows.push({ ...existing, _dirty: false })
                } else {
                    rows.push({
                        period_id: selectedPeriod.id,
                        day,
                        bw: null,
                        feed_sacks_added: 0,
                        feed_sacks_remaining: 0,
                        manual_daily_feed_intake: null,
                        manual_cum_feed_intake: null,
                        manual_daily_gain: null,
                        manual_fcr: null,
                        depletion: 0,
                        current_population: null,
                        notes: '',
                        _dirty: false,
                    })
                }
            }
            setEditRows(rows)
        } else {
            setEditRows([])
        }
    }, [records, selectedPeriod])

    // Computed values for each row
    // LOGIC: "Total Pakan" = total sak pakan yang sudah diberikan sampai hari itu (kumulatif, bukan harian)
    //        "Sisa Pakan" = sisa sak pakan pada hari itu
    //        Cumulative feed consumed = (Total Pakan - Sisa Pakan) * 50kg
    //        Cumulative feed intake per bird = cumulative consumed / populasi
    const computedRows = useMemo(() => {
        if (!selectedPeriod) return []

        let prevBw = selectedPeriod.doc_weight || 40
        let prevCumFeedConsumed = 0 // for daily feed calc

        return editRows.map((row, idx) => {
            const std = STANDARD_DATA.find(s => s.day === row.day) || {}
            const population = row.current_population
                || (idx === 0
                    ? selectedPeriod.initial_population
                    : (computedPop(editRows, idx, selectedPeriod.initial_population)))

            // Total feed consumed = (total sak masuk - sisa sak) * 50kg
            // feed_sacks_added = total sak yang sudah diberikan (absolut, bukan harian)
            // feed_sacks_remaining = sisa sak hari ini
            const totalSacks = row.feed_sacks_added || 0
            const remainingSacks = row.feed_sacks_remaining || 0
            const cumFeedConsumedGram = Math.max(0, (totalSacks - remainingSacks)) * SACK_WEIGHT_GRAM

            // Cumulative feed intake per bird (gram)
            const cumFeedIntakeCalc = population > 0 && cumFeedConsumedGram > 0
                ? cumFeedConsumedGram / population : 0

            // Use manual override if available
            const cumFeedIntake = row.manual_cum_feed_intake !== null && row.manual_cum_feed_intake !== undefined && row.manual_cum_feed_intake !== ''
                ? parseFloat(row.manual_cum_feed_intake)
                : cumFeedIntakeCalc

            // Daily feed intake = perbedaan cum consumed hari ini vs kemarin, dibagi populasi
            const dailyConsumedDiff = cumFeedConsumedGram - prevCumFeedConsumed
            const dailyFeedIntakeCalc = population > 0 && dailyConsumedDiff > 0
                ? dailyConsumedDiff / population : 0

            const dailyFeedIntake = row.manual_daily_feed_intake !== null && row.manual_daily_feed_intake !== undefined && row.manual_daily_feed_intake !== ''
                ? parseFloat(row.manual_daily_feed_intake)
                : dailyFeedIntakeCalc

            // Track for next day's daily calc
            if (cumFeedConsumedGram > 0) prevCumFeedConsumed = cumFeedConsumedGram

            // BW
            const bw = row.bw !== null && row.bw !== undefined && row.bw !== '' ? parseFloat(row.bw) : null

            // Daily gain
            const dailyGainCalc = bw !== null && prevBw !== null ? bw - prevBw : null
            const dailyGain = row.manual_daily_gain !== null && row.manual_daily_gain !== undefined && row.manual_daily_gain !== ''
                ? parseFloat(row.manual_daily_gain)
                : dailyGainCalc

            // FCR
            const fcrCalc = bw && bw > 0 && cumFeedIntake > 0 ? cumFeedIntake / bw : null
            const fcr = row.manual_fcr !== null && row.manual_fcr !== undefined && row.manual_fcr !== ''
                ? parseFloat(row.manual_fcr)
                : fcrCalc

            if (bw !== null) prevBw = bw

            return {
                ...row,
                population,
                cumFeedIntake,
                dailyFeedIntake,
                dailyGain,
                fcr,
                std,
                _isComputed: {
                    cumFeedIntake: !(row.manual_cum_feed_intake !== null && row.manual_cum_feed_intake !== undefined && row.manual_cum_feed_intake !== ''),
                    dailyFeedIntake: !(row.manual_daily_feed_intake !== null && row.manual_daily_feed_intake !== undefined && row.manual_daily_feed_intake !== ''),
                    dailyGain: !(row.manual_daily_gain !== null && row.manual_daily_gain !== undefined && row.manual_daily_gain !== ''),
                    fcr: !(row.manual_fcr !== null && row.manual_fcr !== undefined && row.manual_fcr !== ''),
                }
            }
        })
    }, [editRows, selectedPeriod])

    const updateRow = useCallback((idx, field, value) => {
        setEditRows(prev => {
            const copy = [...prev]
            copy[idx] = { ...copy[idx], [field]: value, _dirty: true }
            return copy
        })
    }, [])

    const handleSave = async () => {
        if (!selectedPeriod) return
        setSaving(true)
        const dirtyRows = editRows.filter(r => r._dirty)
        if (dirtyRows.length === 0) {
            addToast('Tidak ada perubahan untuk disimpan', 'error')
            setSaving(false)
            return
        }
        const toSave = dirtyRows.map(r => {
            const { _dirty, ...rest } = r
            return { ...rest, period_id: selectedPeriod.id }
        })
        await saveMultipleRecords(toSave)
        setSaving(false)
    }

    const handleAddPeriod = async (e) => {
        e.preventDefault()
        if (!selectedFarm || !periodForm.name.trim() || !periodForm.start_date || !periodForm.initial_population) return
        await addPeriod({
            farm_id: selectedFarm.id,
            name: periodForm.name.trim(),
            start_date: periodForm.start_date,
            initial_population: parseInt(periodForm.initial_population),
            doc_weight: parseFloat(periodForm.doc_weight) || 40,
            notes: periodForm.notes,
        })
        setShowPeriodModal(false)
        setPeriodForm({ name: '', start_date: '', initial_population: '', doc_weight: '40', notes: '' })
    }

    const handleDeletePeriod = async (e, period) => {
        e.stopPropagation()
        if (window.confirm(`Hapus periode "${period.name}"? Semua data recording akan ikut terhapus.`)) {
            await deletePeriod(period.id)
        }
    }

    const addMoreDays = () => {
        const lastDay = editRows.length > 0 ? editRows[editRows.length - 1].day : -1
        const newRows = []
        for (let i = 1; i <= 7; i++) {
            newRows.push({
                period_id: selectedPeriod.id,
                day: lastDay + i,
                bw: null,
                feed_sacks_added: 0,
                feed_sacks_remaining: 0,
                manual_daily_feed_intake: null,
                manual_cum_feed_intake: null,
                manual_daily_gain: null,
                manual_fcr: null,
                depletion: 0,
                current_population: null,
                notes: '',
                _dirty: false,
            })
        }
        setEditRows(prev => [...prev, ...newRows])
    }

    const unitLabel = unit === 'kg' ? 'kg' : 'g'
    const convertVal = (val) => {
        if (val === null || val === undefined || val === '') return ''
        const num = parseFloat(val)
        if (isNaN(num)) return ''
        return unit === 'kg' ? truncateNumber(num / 1000, 3) : truncateNumber(num, 0)
    }
    const parseInput = (val) => {
        if (val === '' || val === null) return null
        const num = parseFloat(val)
        if (isNaN(num)) return null
        return unit === 'kg' ? num * 1000 : num
    }

    // No farm selected
    if (!selectedFarm) {
        return (
            <>
                <div className="page-header">
                    <h2>📋 Input Recording</h2>
                    <p>Pilih peternakan terlebih dahulu</p>
                </div>
                <div className="page-body">
                    <div className="empty-state">
                        <div className="empty-state-icon">🏠</div>
                        <h3>Pilih Peternakan</h3>
                        <p>Pilih peternakan dari sidebar atau halaman peternakan untuk mulai input recording</p>
                    </div>
                </div>
            </>
        )
    }

    return (
        <>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h2>📋 Input Recording</h2>
                        <p>{selectedFarm.name} {selectedPeriod ? `› ${selectedPeriod.name}` : ''}</p>
                    </div>
                    <div className="btn-group">
                        {selectedPeriod && (
                            <button className="btn btn-success" onClick={handleSave} disabled={saving}>
                                <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Data'}
                            </button>
                        )}
                        <button className="btn btn-primary" onClick={() => setShowPeriodModal(true)}>
                            <Plus size={16} /> Tambah Periode
                        </button>
                    </div>
                </div>
            </div>

            <div className="page-body">
                {/* Farm & Period Selector */}
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
                            {farms.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>
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
                            {periods.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({new Date(p.start_date).toLocaleDateString('id-ID')})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Period List (if no period selected) */}
                {!selectedPeriod && periods.length > 0 && (
                    <div className="period-list">
                        {periods.map(period => (
                            <div
                                key={period.id}
                                className={`period-item ${period.is_active ? 'active-period' : ''}`}
                                onClick={() => setSelectedPeriod(period)}
                            >
                                <div className="period-info">
                                    <h4>{period.name}</h4>
                                    <p>
                                        <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />
                                        Mulai: {new Date(period.start_date).toLocaleDateString('id-ID')}
                                        {' · '}
                                        <Users size={12} style={{ display: 'inline', marginRight: 4 }} />
                                        Populasi: {period.initial_population?.toLocaleString()} ekor
                                        {period.doc_weight && ` · DOC: ${period.doc_weight}g`}
                                    </p>
                                </div>
                                <div className="period-meta">
                                    {period.is_active && <span className="badge badge-green">Aktif</span>}
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={(e) => handleDeletePeriod(e, period)}
                                        style={{ color: 'var(--accent-red)' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!selectedPeriod && periods.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-state-icon">📅</div>
                        <h3>Belum Ada Periode</h3>
                        <p>Tambahkan periode baru untuk mulai recording data harian</p>
                        <button className="btn btn-primary" onClick={() => setShowPeriodModal(true)}>
                            <Plus size={16} /> Tambah Periode
                        </button>
                    </div>
                )}

                {/* Recording Table */}
                {selectedPeriod && (
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-header">
                            <h3>
                                📊 Data Recording - {selectedPeriod.name}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="badge badge-blue">Satuan: {unitLabel}</span>
                                <span className="badge badge-green">
                                    {selectedPeriod.initial_population?.toLocaleString()} ekor
                                </span>
                            </div>
                        </div>
                        <div className="card-body" style={{ padding: 0 }}>
                            <div className="table-container" style={{ maxHeight: '70vh', overflowX: 'auto', overflowY: 'auto' }}>
                                <table className="table-editable" style={{ minWidth: 1400 }}>
                                    <thead>
                                        <tr>
                                            <th style={{ position: 'sticky', left: 0, zIndex: 20, background: 'var(--bg-tertiary)', minWidth: 55 }}>Hari</th>
                                            <th style={{ minWidth: 90 }}>BW ({unitLabel})</th>
                                            <th style={{ minWidth: 110 }}>Total Pakan (Sak)</th>
                                            <th style={{ minWidth: 110 }}>Sisa Pakan (Sak)</th>
                                            <th style={{ minWidth: 120 }}>Daily Feed ({unitLabel}/ekor)</th>
                                            <th style={{ minWidth: 120 }}>Cum Feed ({unitLabel}/ekor)</th>
                                            <th style={{ minWidth: 100 }}>Daily Gain ({unitLabel})</th>
                                            <th style={{ minWidth: 80 }}>FCR</th>
                                            <th style={{ minWidth: 70 }}>Deplesi</th>
                                            <th style={{ minWidth: 80 }}>Populasi</th>
                                            <th style={{ minWidth: 90 }}>Std BW</th>
                                            <th style={{ minWidth: 80 }}>Std FCR</th>
                                            <th style={{ minWidth: 120 }}>Catatan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {computedRows.map((row, idx) => {
                                            const std = row.std || {}
                                            const bwDiff = row.bw && std.bw ? ((row.bw - std.bw) / std.bw * 100) : null
                                            const fcrDiff = row.fcr && std.fcr ? ((row.fcr - std.fcr) / std.fcr * 100) : null

                                            return (
                                                <tr key={row.day}>
                                                    <td style={{
                                                        position: 'sticky', left: 0, zIndex: 5,
                                                        background: 'var(--bg-card)',
                                                        fontWeight: 700, textAlign: 'center',
                                                        color: row.day % 7 === 0 ? 'var(--accent-orange)' : 'var(--text-primary)'
                                                    }}>
                                                        {row.day}
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            value={row.bw !== null && row.bw !== undefined && row.bw !== '' ? convertVal(row.bw) : ''}
                                                            onChange={e => updateRow(idx, 'bw', parseInput(e.target.value))}
                                                            placeholder="-"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            min="0"
                                                            value={row.feed_sacks_added || ''}
                                                            onChange={e => updateRow(idx, 'feed_sacks_added', parseFloat(e.target.value) || 0)}
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            min="0"
                                                            value={row.feed_sacks_remaining || ''}
                                                            onChange={e => updateRow(idx, 'feed_sacks_remaining', parseFloat(e.target.value) || 0)}
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            className={row._isComputed?.dailyFeedIntake ? 'computed' : ''}
                                                            value={row._isComputed?.dailyFeedIntake
                                                                ? (row.dailyFeedIntake ? convertVal(row.dailyFeedIntake) : '')
                                                                : (row.manual_daily_feed_intake !== null && row.manual_daily_feed_intake !== '' ? convertVal(row.manual_daily_feed_intake) : '')
                                                            }
                                                            onChange={e => updateRow(idx, 'manual_daily_feed_intake', parseInput(e.target.value))}
                                                            placeholder="auto"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            className={row._isComputed?.cumFeedIntake ? 'computed' : ''}
                                                            value={row._isComputed?.cumFeedIntake
                                                                ? (row.cumFeedIntake ? convertVal(row.cumFeedIntake) : '')
                                                                : (row.manual_cum_feed_intake !== null && row.manual_cum_feed_intake !== '' ? convertVal(row.manual_cum_feed_intake) : '')
                                                            }
                                                            onChange={e => updateRow(idx, 'manual_cum_feed_intake', parseInput(e.target.value))}
                                                            placeholder="auto"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            className={row._isComputed?.dailyGain ? 'computed' : ''}
                                                            value={row._isComputed?.dailyGain
                                                                ? (row.dailyGain !== null ? convertVal(row.dailyGain) : '')
                                                                : (row.manual_daily_gain !== null && row.manual_daily_gain !== '' ? convertVal(row.manual_daily_gain) : '')
                                                            }
                                                            onChange={e => updateRow(idx, 'manual_daily_gain', parseInput(e.target.value))}
                                                            placeholder="auto"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            className={row._isComputed?.fcr ? 'computed' : ''}
                                                            value={row._isComputed?.fcr
                                                                ? (row.fcr !== null ? truncateNumber(row.fcr, 3) : '')
                                                                : (row.manual_fcr !== null && row.manual_fcr !== '' ? truncateNumber(parseFloat(row.manual_fcr), 3) : '')
                                                            }
                                                            onChange={e => updateRow(idx, 'manual_fcr', e.target.value === '' ? null : parseFloat(e.target.value))}
                                                            placeholder="auto"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={row.depletion || ''}
                                                            onChange={e => updateRow(idx, 'depletion', parseInt(e.target.value) || 0)}
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={row.current_population || ''}
                                                            onChange={e => updateRow(idx, 'current_population', parseInt(e.target.value) || null)}
                                                            placeholder={row.population || '-'}
                                                        />
                                                    </td>
                                                    <td style={{
                                                        color: 'var(--text-muted)',
                                                        fontSize: '0.78rem',
                                                    }}>
                                                        {std.bw ? convertVal(std.bw) : '-'}
                                                        {bwDiff !== null && (
                                                            <span style={{
                                                                display: 'block',
                                                                fontSize: '0.68rem',
                                                                color: bwDiff >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                                                            }}>
                                                                {bwDiff >= 0 ? '+' : ''}{truncateNumber(bwDiff, 1)}%
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{
                                                        color: 'var(--text-muted)',
                                                        fontSize: '0.78rem',
                                                    }}>
                                                        {std.fcr ? truncateNumber(std.fcr, 3) : '-'}
                                                        {fcrDiff !== null && (
                                                            <span style={{
                                                                display: 'block',
                                                                fontSize: '0.68rem',
                                                                color: fcrDiff <= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                                                            }}>
                                                                {fcrDiff >= 0 ? '+' : ''}{truncateNumber(fcrDiff, 1)}%
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={row.notes || ''}
                                                            onChange={e => updateRow(idx, 'notes', e.target.value)}
                                                            placeholder=""
                                                            style={{ minWidth: 100 }}
                                                        />
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between' }}>
                            <button className="btn btn-outline btn-sm" onClick={addMoreDays}>
                                <Plus size={14} /> Tambah 7 Hari
                            </button>
                            <div className="btn-group">
                                <button className="btn btn-success" onClick={handleSave} disabled={saving}>
                                    <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Semua'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Info Box */}
                {selectedPeriod && (
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-body" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>💡 Cara Penggunaan:</strong>
                            <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.8 }}>
                                <li><strong>BW (Body Weight)</strong>: Masukkan berat badan rata-rata (dalam {unitLabel})</li>
                                <li><strong>Total Pakan</strong>: Total sak pakan yang sudah diberikan sampai hari ini (kumulatif, 1 sak = 50 kg). Misal hari ini 25 sak berarti total 25 sak sudah masuk.</li>
                                <li><strong>Sisa Pakan</strong>: Sisa sak pakan pada hari itu. Misal sisa 10 sak.</li>
                                <li><strong>Rumus</strong>: Pakan dikonsumsi = (Total Pakan - Sisa Pakan) × 50 kg</li>
                                <li>Field dengan warna <span style={{ color: 'var(--accent-green)' }}>hijau</span> dihitung otomatis, tapi bisa diisi manual untuk override</li>
                                <li><strong>Cumulative Feed Intake</strong> = pakan dikonsumsi ÷ jumlah ternak</li>
                                <li><strong>FCR</strong> = cumulative feed intake ÷ BW</li>
                                <li><strong>Deplesi</strong>: Jumlah ternak yang mati/afkir hari itu</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {/* Period Modal */}
            {showPeriodModal && (
                <div className="modal-overlay" onClick={() => setShowPeriodModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Tambah Periode Baru</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowPeriodModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleAddPeriod}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Nama Periode *</label>
                                    <input
                                        className="form-input"
                                        placeholder="Contoh: Periode 1 - Jan 2026"
                                        value={periodForm.name}
                                        onChange={e => setPeriodForm({ ...periodForm, name: e.target.value })}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Tanggal Mulai (DOC) *</label>
                                        <input
                                            className="form-input"
                                            type="date"
                                            value={periodForm.start_date}
                                            onChange={e => setPeriodForm({ ...periodForm, start_date: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Populasi Awal (ekor) *</label>
                                        <input
                                            className="form-input"
                                            type="number"
                                            min="1"
                                            placeholder="5000"
                                            value={periodForm.initial_population}
                                            onChange={e => setPeriodForm({ ...periodForm, initial_population: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Berat DOC (gram)</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        step="0.1"
                                        placeholder="40"
                                        value={periodForm.doc_weight}
                                        onChange={e => setPeriodForm({ ...periodForm, doc_weight: e.target.value })}
                                    />
                                    <div className="form-hint">Berat rata-rata DOC saat masuk (default: 40 gram)</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Catatan</label>
                                    <textarea
                                        className="form-textarea"
                                        placeholder="Catatan tambahan"
                                        rows={2}
                                        value={periodForm.notes}
                                        onChange={e => setPeriodForm({ ...periodForm, notes: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowPeriodModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary">Tambah Periode</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}

// Helper to compute population from depletion
function computedPop(rows, idx, initialPop) {
    let pop = initialPop
    for (let i = 0; i < idx; i++) {
        if (rows[i].current_population) {
            pop = rows[i].current_population
        } else {
            pop -= (rows[i].depletion || 0)
        }
    }
    return Math.max(0, pop - (rows[idx]?.depletion || 0))
}
