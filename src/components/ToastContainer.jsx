import { useApp } from '../context/AppContext'
import { CheckCircle, XCircle } from 'lucide-react'

export default function ToastContainer() {
    const { toasts } = useApp()

    if (toasts.length === 0) return null

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div key={toast.id} className={`toast toast-${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.message}
                </div>
            ))}
        </div>
    )
}
