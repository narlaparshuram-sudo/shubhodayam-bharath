import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { supabase } from "../lib/supabase"
import logo from "../assets/logo.png"

function Header() {
  const location = useLocation()

  const [language, setLanguage] = useState(
    localStorage.getItem("shubhodayam-language") || "en"
  )

  const [latestDate, setLatestDate] = useState("")

  const isTelugu = language === "te"

  // =========================================
  // LANGUAGE
  // =========================================

  useEffect(() => {
    function updateLanguage() {
      setLanguage(
        localStorage.getItem("shubhodayam-language") || "en"
      )
    }

    window.addEventListener("languagechange", updateLanguage)
    window.addEventListener("storage", updateLanguage)

    return () => {
      window.removeEventListener("languagechange", updateLanguage)
      window.removeEventListener("storage", updateLanguage)
    }
  }, [])

  // =========================================
  // LOAD LATEST NEWSPAPER
  // =========================================

  useEffect(() => {
    async function loadLatestEdition() {
      const { data, error } = await supabase
        .from("editions")
        .select("date")
        .order("date", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error(
          "Header latest edition error:",
          error
        )
        return
      }

      if (data?.date) {
        setLatestDate(data.date)
      }
    }

    loadLatestEdition()
  }, [])

  // =========================================
  // LANGUAGE CHANGE
  // =========================================

  function changeLanguage(event) {
    const newLanguage = event.target.value

    localStorage.setItem(
      "shubhodayam-language",
      newLanguage
    )

    setLanguage(newLanguage)

    window.dispatchEvent(
      new Event("languagechange")
    )
  }

  // =========================================
  // NEWSPAPER PATH
  // =========================================

  const newspaperPath = latestDate
    ? `/newspaper/${latestDate}`
    : "/calendar"

  // =========================================
  // ACTIVE NAVIGATION
  // =========================================

  const isHome = location.pathname === "/"
  const isCalendar = location.pathname === "/calendar"
  const isNewspaper =
    location.pathname.startsWith("/newspaper")

  // =========================================
  // HEADER
  // =========================================

  return (
    <header className="site-header">

      <div className="header-inner">

        {/* =====================================
            LOGO
        ===================================== */}

        <Link
          to="/"
          className="site-brand"
          aria-label="Shubhodayam Bharath Home"
        >
          <img
            src={logo}
            alt="Shubhodayam Bharath"
            className="site-logo"
          />
        </Link>


        {/* =====================================
            NAVIGATION
        ===================================== */}

        <nav className="main-nav">

          {/* HOME */}

          <Link
            to="/"
            className={isHome ? "active" : ""}
          >
            {isTelugu
              ? "హోమ్"
              : "Home"}
          </Link>


          {/* CALENDAR */}

          <Link
            to="/calendar"
            className={isCalendar ? "active" : ""}
          >
            {isTelugu
              ? "క్యాలెండర్"
              : "Calendar"}
          </Link>


          {/* NEWSPAPER */}

          <Link
            to={newspaperPath}
            className={isNewspaper ? "active" : ""}
          >
            {isTelugu
              ? "వార్తాపత్రిక"
              : "Read Newspaper"}
          </Link>


          {/* LANGUAGE */}

          <select
            value={language}
            onChange={changeLanguage}
            className="language-select"
            aria-label={
              isTelugu
                ? "భాషను ఎంచుకోండి"
                : "Select language"
            }
          >
            <option value="en">
              English
            </option>

            <option value="te">
              తెలుగు
            </option>
          </select>

        </nav>

      </div>

    </header>
  )
}

export default Header