import { useState } from "react"
import { useNavigate } from "react-router-dom"
import Header from "../../components/Header"
import { supabase } from "../../lib/supabase"

function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLogin(event) {
    event.preventDefault()

    setLoading(true)
    setError("")

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError("Invalid email or password.")
      setLoading(false)
      return
    }

    setLoading(false)
    navigate("/admin")
  }

  return (
    <>
      <Header />

      <main className="home-main">
        <section className="calendar-page">

          <div className="section-heading">
            <h2>Admin Login</h2>

            <p>
              Sign in to manage newspaper editions.
            </p>
          </div>

          <form
            className="calendar-box"
            onSubmit={handleLogin}
          >

            <label htmlFor="admin-email">
              Email
            </label>

            <input
              id="admin-email"
              type="email"
              className="date-picker"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
            />

            <br />
            <br />

            <label htmlFor="admin-password">
              Password
            </label>

            <input
              id="admin-password"
              type="password"
              className="date-picker"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
            />

            <br />
            <br />

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            {error && (
              <p
                style={{
                  marginTop: "20px",
                  color: "red",
                }}
              >
                {error}
              </p>
            )}

          </form>

        </section>
      </main>
    </>
  )
}

export default Login