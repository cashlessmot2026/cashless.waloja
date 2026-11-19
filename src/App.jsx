import { useEffect, useState } from 'react'
import { rpc, session } from './lib/supabase'
import Login from './pages/Login'
import Guest from './pages/Guest'
import Operator from './pages/Operator'
import Admin from './pages/Admin'
import { useLang } from './lib/i18n'

export default function App() {
  useLang()
  const [role, setRole] = useState(session.token ? session.role : null)

  useEffect(() => {
    const h = () => setRole(null)
    window.addEventListener('cl-logout', h)
    return () => window.removeEventListener('cl-logout', h)
  }, [])

  const logout = async () => {
    try { await rpc('app_logout') } catch { /* ignore */ }
    session.clear()
    setRole(null)
  }

  if (!role) return <Login onLogin={setRole} />
  if (role === 'guest') return <Guest onLogout={logout} />
  if (role === 'operator') return <Operator onLogout={logout} />
  return <Admin onLogout={logout} />
}
