import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { STANDARD_DATA } from '../lib/standardData'

const AppContext = createContext()

export function AppProvider({ children }) {
    const [farms, setFarms] = useState([])
    const [selectedFarm, setSelectedFarm] = useState(null)
    const [periods, setPeriods] = useState([])
    const [selectedPeriod, setSelectedPeriod] = useState(null)
    const [records, setRecords] = useState([])
    const [standardData, setStandardData] = useState(STANDARD_DATA)
    const [unit, setUnit] = useState('gram') // 'gram' or 'kg'
    const [loading, setLoading] = useState(false)
    const [toasts, setToasts] = useState([])
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const addToast = useCallback((message, type = 'success') => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 3000)
    }, [])

    // ---- FARMS ----
    const fetchFarms = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('farms')
            .select('*')
            .order('created_at', { ascending: false })
        if (error) {
            addToast('Gagal memuat data peternakan: ' + error.message, 'error')
        } else {
            setFarms(data || [])
        }
        setLoading(false)
    }, [addToast])

    const addFarm = useCallback(async (farm) => {
        const { data, error } = await supabase
            .from('farms')
            .insert([farm])
            .select()
            .single()
        if (error) {
            addToast('Gagal menambah peternakan: ' + error.message, 'error')
            return null
        }
        setFarms(prev => [data, ...prev])
        addToast('Peternakan berhasil ditambahkan!')
        return data
    }, [addToast])

    const updateFarm = useCallback(async (id, updates) => {
        const { data, error } = await supabase
            .from('farms')
            .update(updates)
            .eq('id', id)
            .select()
            .single()
        if (error) {
            addToast('Gagal mengupdate peternakan: ' + error.message, 'error')
            return null
        }
        setFarms(prev => prev.map(f => f.id === id ? data : f))
        if (selectedFarm?.id === id) setSelectedFarm(data)
        addToast('Peternakan berhasil diupdate!')
        return data
    }, [addToast, selectedFarm])

    const deleteFarm = useCallback(async (id) => {
        const { error } = await supabase.from('farms').delete().eq('id', id)
        if (error) {
            addToast('Gagal menghapus peternakan: ' + error.message, 'error')
            return false
        }
        setFarms(prev => prev.filter(f => f.id !== id))
        if (selectedFarm?.id === id) {
            setSelectedFarm(null)
            setPeriods([])
            setSelectedPeriod(null)
            setRecords([])
        }
        addToast('Peternakan berhasil dihapus!')
        return true
    }, [addToast, selectedFarm])

    // ---- PERIODS ----
    const fetchPeriods = useCallback(async (farmId) => {
        if (!farmId) return
        setLoading(true)
        const { data, error } = await supabase
            .from('periods')
            .select('*')
            .eq('farm_id', farmId)
            .order('created_at', { ascending: false })
        if (error) {
            addToast('Gagal memuat periode: ' + error.message, 'error')
        } else {
            setPeriods(data || [])
        }
        setLoading(false)
    }, [addToast])

    const addPeriod = useCallback(async (period) => {
        const { data, error } = await supabase
            .from('periods')
            .insert([period])
            .select()
            .single()
        if (error) {
            addToast('Gagal menambah periode: ' + error.message, 'error')
            return null
        }
        setPeriods(prev => [data, ...prev])
        addToast('Periode berhasil ditambahkan!')
        return data
    }, [addToast])

    const updatePeriod = useCallback(async (id, updates) => {
        const { data, error } = await supabase
            .from('periods')
            .update(updates)
            .eq('id', id)
            .select()
            .single()
        if (error) {
            addToast('Gagal mengupdate periode: ' + error.message, 'error')
            return null
        }
        setPeriods(prev => prev.map(p => p.id === id ? data : p))
        if (selectedPeriod?.id === id) setSelectedPeriod(data)
        addToast('Periode berhasil diupdate!')
        return data
    }, [addToast, selectedPeriod])

    const deletePeriod = useCallback(async (id) => {
        const { error } = await supabase.from('periods').delete().eq('id', id)
        if (error) {
            addToast('Gagal menghapus periode: ' + error.message, 'error')
            return false
        }
        setPeriods(prev => prev.filter(p => p.id !== id))
        if (selectedPeriod?.id === id) {
            setSelectedPeriod(null)
            setRecords([])
        }
        addToast('Periode berhasil dihapus!')
        return true
    }, [addToast, selectedPeriod])

    // ---- RECORDS ----
    const fetchRecords = useCallback(async (periodId) => {
        if (!periodId) return
        setLoading(true)
        const { data, error } = await supabase
            .from('daily_records')
            .select('*')
            .eq('period_id', periodId)
            .order('day', { ascending: true })
        if (error) {
            addToast('Gagal memuat data recording: ' + error.message, 'error')
        } else {
            setRecords(data || [])
        }
        setLoading(false)
    }, [addToast])

    const saveRecord = useCallback(async (record) => {
        // Upsert based on period_id + day
        const { data, error } = await supabase
            .from('daily_records')
            .upsert([{
                ...record,
                updated_at: new Date().toISOString()
            }], {
                onConflict: 'period_id,day'
            })
            .select()
            .single()
        if (error) {
            addToast('Gagal menyimpan data: ' + error.message, 'error')
            return null
        }
        setRecords(prev => {
            const exists = prev.find(r => r.day === data.day)
            if (exists) {
                return prev.map(r => r.day === data.day ? data : r).sort((a, b) => a.day - b.day)
            }
            return [...prev, data].sort((a, b) => a.day - b.day)
        })
        return data
    }, [addToast])

    const saveMultipleRecords = useCallback(async (recordsToSave) => {
        const updated = recordsToSave.map(r => ({
            ...r,
            updated_at: new Date().toISOString()
        }))
        const { data, error } = await supabase
            .from('daily_records')
            .upsert(updated, { onConflict: 'period_id,day' })
            .select()
        if (error) {
            addToast('Gagal menyimpan data: ' + error.message, 'error')
            return null
        }
        // Refresh records
        if (selectedPeriod) {
            await fetchRecords(selectedPeriod.id)
        }
        addToast('Data berhasil disimpan!')
        return data
    }, [addToast, selectedPeriod, fetchRecords])

    const deleteRecord = useCallback(async (id) => {
        const { error } = await supabase.from('daily_records').delete().eq('id', id)
        if (error) {
            addToast('Gagal menghapus data: ' + error.message, 'error')
            return false
        }
        setRecords(prev => prev.filter(r => r.id !== id))
        addToast('Data berhasil dihapus!')
        return true
    }, [addToast])

    // Fetch records for a specific period (for comparison)
    const fetchRecordsForPeriod = useCallback(async (periodId) => {
        const { data, error } = await supabase
            .from('daily_records')
            .select('*')
            .eq('period_id', periodId)
            .order('day', { ascending: true })
        if (error) return []
        return data || []
    }, [])

    // Initialize
    useEffect(() => {
        fetchFarms()
    }, [fetchFarms])

    // When farm changes, fetch periods
    useEffect(() => {
        if (selectedFarm) {
            fetchPeriods(selectedFarm.id)
            setSelectedPeriod(null)
            setRecords([])
        }
    }, [selectedFarm, fetchPeriods])

    // When period changes, fetch records
    useEffect(() => {
        if (selectedPeriod) {
            fetchRecords(selectedPeriod.id)
        }
    }, [selectedPeriod, fetchRecords])

    const value = {
        farms, selectedFarm, setSelectedFarm,
        periods, selectedPeriod, setSelectedPeriod,
        records, standardData,
        unit, setUnit,
        loading, toasts,
        sidebarOpen, setSidebarOpen,
        addToast,
        addFarm, updateFarm, deleteFarm, fetchFarms,
        addPeriod, updatePeriod, deletePeriod, fetchPeriods,
        saveRecord, saveMultipleRecords, deleteRecord, fetchRecords,
        fetchRecordsForPeriod,
    }

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
    const context = useContext(AppContext)
    if (!context) throw new Error('useApp must be used within AppProvider')
    return context
}
