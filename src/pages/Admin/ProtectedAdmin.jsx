import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import Admin from "./Admin"
function ProtectedAdmin() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession()

      setSession(data.session)
      setLoading(false)
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <main className="home-main">
        <div className="calendar-message">
          <p>Checking admin access...</p>
        </div>
      </main>
    )
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />
  }

  return <AdminContent />
}

function AdminContent() {
  return <Admin />
}

export default ProtectedAdmin