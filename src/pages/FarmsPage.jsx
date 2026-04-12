import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Plus, Edit3, Trash2, MapPin, User, X } from 'lucide-react'

export default function FarmsPage({ onNavigate }) {
    const { farms, addFarm, updateFarm, deleteFarm, setSelectedFarm } = useApp()
    const [showModal, setShowModal] = useState(false)
    const [editingFarm, setEditingFarm] = useState(null)
    const [form, setForm] = useState({ name: '', owner: '', address: '', notes: '' })

    const openAdd = () => {
        setEditingFarm(null)
        setForm({ name: '', owner: '', address: '', notes: '' })
        setShowModal(true)
    }

    const openEdit = (e, farm) => {
        e.stopPropagation()
        setEditingFarm(farm)
        setForm({
            name: farm.name || '',
            owner: farm.owner || '',
            address: farm.address || '',
            notes: farm.notes || '',
        })
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.name.trim()) return

        if (editingFarm) {
            await updateFarm(editingFarm.id, form)
        } else {
            await addFarm(form)
        }
        setShowModal(false)
    }

    const handleDelete = async (e, farm) => {
        e.stopPropagation()
        if (window.confirm(`Hapus peternakan "${farm.name}"? Semua data periode dan recording akan ikut terhapus.`)) {
            await deleteFarm(farm.id)
        }
    }

    const handleSelectFarm = (farm) => {
        setSelectedFarm(farm)
        onNavigate('recording')
    }

    return (
        <>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2>🏠 Peternakan</h2>
                        <p>Kelola daftar peternakan/kandang Anda</p>
                    </div>
                    <button className="btn btn-primary" onClick={openAdd}>
                        <Plus size={16} /> Tambah Peternakan
                    </button>
                </div>
            </div>

            <div className="page-body">
                {farms.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🏠</div>
                        <h3>Belum Ada Peternakan</h3>
                        <p>Tambahkan peternakan pertama Anda untuk mulai mencatat recording ternak</p>
                        <button className="btn btn-primary" onClick={openAdd}>
                            <Plus size={16} /> Tambah Peternakan
                        </button>
                    </div>
                ) : (
                    <div className="farm-grid">
                        {farms.map(farm => (
                            <div key={farm.id} className="farm-card" onClick={() => handleSelectFarm(farm)}>
                                <div className="farm-card-name">{farm.name}</div>
                                {farm.owner && (
                                    <div className="farm-card-info">
                                        <User size={14} /> {farm.owner}
                                    </div>
                                )}
                                {farm.address && (
                                    <div className="farm-card-info">
                                        <MapPin size={14} /> {farm.address}
                                    </div>
                                )}
                                {farm.notes && (
                                    <div className="farm-card-info" style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                        {farm.notes}
                                    </div>
                                )}
                                <div className="farm-card-actions">
                                    <button
                                        className="btn btn-outline btn-sm"
                                        onClick={(e) => openEdit(e, farm)}
                                    >
                                        <Edit3 size={14} /> Edit
                                    </button>
                                    <button
                                        className="btn btn-outline btn-sm"
                                        onClick={(e) => handleDelete(e, farm)}
                                        style={{ color: 'var(--accent-red)', borderColor: 'rgba(239,68,68,0.3)' }}
                                    >
                                        <Trash2 size={14} /> Hapus
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingFarm ? 'Edit Peternakan' : 'Tambah Peternakan Baru'}</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Nama Peternakan *</label>
                                    <input
                                        className="form-input"
                                        placeholder="Contoh: Peternakan Pak Rusdi"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Pemilik</label>
                                    <input
                                        className="form-input"
                                        placeholder="Nama pemilik"
                                        value={form.owner}
                                        onChange={e => setForm({ ...form, owner: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Alamat</label>
                                    <input
                                        className="form-input"
                                        placeholder="Alamat peternakan"
                                        value={form.address}
                                        onChange={e => setForm({ ...form, address: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Catatan</label>
                                    <textarea
                                        className="form-textarea"
                                        placeholder="Catatan tambahan"
                                        rows={3}
                                        value={form.notes}
                                        onChange={e => setForm({ ...form, notes: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                                    Batal
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingFarm ? 'Simpan Perubahan' : 'Tambah Peternakan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
