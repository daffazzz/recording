import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
    const { signIn, signUp } = useAuth()
    const [mode, setMode] = useState('login') // 'login' | 'register'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [showPass, setShowPass] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (!email.trim() || !password) {
            setError('Email dan password wajib diisi.')
            return
        }

        if (mode === 'register') {
            if (password !== confirmPassword) {
                setError('Password dan konfirmasi password tidak cocok.')
                return
            }
            if (password.length < 6) {
                setError('Password minimal 6 karakter.')
                return
            }
        }

        setLoading(true)
        if (mode === 'login') {
            const { error } = await signIn(email.trim(), password)
            if (error) setError(error.message === 'Invalid login credentials'
                ? 'Email atau password salah.'
                : error.message)
        } else {
            const { error } = await signUp(email.trim(), password)
            if (error) {
                setError(error.message)
            } else {
                setSuccess('Akun berhasil dibuat! Silakan cek email Anda untuk konfirmasi, lalu login.')
                setMode('login')
                setPassword('')
                setConfirmPassword('')
            }
        }
        setLoading(false)
    }

    const switchMode = () => {
        setMode(m => m === 'login' ? 'register' : 'login')
        setError('')
        setSuccess('')
        setPassword('')
        setConfirmPassword('')
    }

    return (
        <div className="login-page">
            {/* Background decoration */}
            <div className="login-bg-orb login-bg-orb-1" />
            <div className="login-bg-orb login-bg-orb-2" />

            <div className="login-card">
                {/* Logo */}
                <div className="login-logo">
                    <div className="login-logo-icon">🐔</div>
                    <div>
                        <h1 className="login-logo-title">FarmRecord</h1>
                        <p className="login-logo-sub">Poultry Management</p>
                    </div>
                </div>

                {/* Mode tabs */}
                <div className="login-tabs">
                    <button
                        className={`login-tab ${mode === 'login' ? 'active' : ''}`}
                        onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                    >
                        Masuk
                    </button>
                    <button
                        className={`login-tab ${mode === 'register' ? 'active' : ''}`}
                        onClick={() => { setMode('register'); setError(''); setSuccess('') }}
                    >
                        Daftar
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <div className="login-input-wrap">
                            <span className="login-input-icon">✉️</span>
                            <input
                                className="form-input login-input"
                                type="email"
                                placeholder="contoh@email.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div className="login-input-wrap">
                            <span className="login-input-icon">🔒</span>
                            <input
                                className="form-input login-input"
                                type={showPass ? 'text' : 'password'}
                                placeholder={mode === 'register' ? 'Minimal 6 karakter' : 'Masukkan password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                required
                            />
                            <button
                                type="button"
                                className="login-show-pass"
                                onClick={() => setShowPass(s => !s)}
                                tabIndex={-1}
                            >
                                {showPass ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    {mode === 'register' && (
                        <div className="form-group">
                            <label className="form-label">Konfirmasi Password</label>
                            <div className="login-input-wrap">
                                <span className="login-input-icon">🔒</span>
                                <input
                                    className="form-input login-input"
                                    type={showPass ? 'text' : 'password'}
                                    placeholder="Ulangi password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="login-alert login-alert-error">
                            ⚠️ {error}
                        </div>
                    )}

                    {success && (
                        <div className="login-alert login-alert-success">
                            ✅ {success}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary login-submit"
                        disabled={loading}
                    >
                        {loading
                            ? <span className="login-spinner" />
                            : mode === 'login' ? '🚀 Masuk' : '✨ Buat Akun'
                        }
                    </button>

                    <p className="login-switch">
                        {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}
                        {' '}
                        <button type="button" className="login-switch-btn" onClick={switchMode}>
                            {mode === 'login' ? 'Daftar sekarang' : 'Masuk'}
                        </button>
                    </p>
                </form>

                <p className="login-footer">
                    🔐 Data disimpan aman dengan Supabase
                </p>
            </div>
        </div>
    )
}
