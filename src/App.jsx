import { BrowserRouter, Routes, Route } from "react-router-dom"

import Home from "./pages/Home/Home"
import Calendar from "./pages/Calendar/Calendar"
import Newspaper from "./pages/Newspaper/Newspaper"
import Login from "./pages/Admin/Login"
import ProtectedAdmin from "./pages/Admin/ProtectedAdmin"

function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div>
        <h1
          style={{
            marginBottom: "10px",
            color: "#123c69",
          }}
        >
          404
        </h1>

        <h2>Page Not Found</h2>

        <p
          style={{
            margin: "12px 0 24px",
            color: "#64748b",
          }}
        >
          The page you are looking for does not exist.
        </p>

        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "11px 20px",
            borderRadius: "8px",
            background: "#123c69",
            color: "#ffffff",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Back to Home
        </a>
      </div>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Home />} />

        <Route
          path="/calendar"
          element={<Calendar />}
        />

        <Route
          path="/newspaper/:date"
          element={<Newspaper />}
        />

        <Route
          path="/admin/login"
          element={<Login />}
        />

        <Route
          path="/admin"
          element={<ProtectedAdmin />}
        />

        {/* 404 */}
        <Route
          path="*"
          element={<NotFound />}
        />

      </Routes>
    </BrowserRouter>
  )
}

export default App