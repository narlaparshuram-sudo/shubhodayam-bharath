import { BrowserRouter, Routes, Route } from "react-router-dom"

import Home from "./pages/Home/Home"
import Calendar from "./pages/Calendar/Calendar"
import Newspaper from "./pages/Newspaper/Newspaper"
import Login from "./pages/Admin/Login"
import ProtectedAdmin from "./pages/Admin/ProtectedAdmin"

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

      </Routes>
    </BrowserRouter>
  )
}

export default App