import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import Header from "../../components/Header"
import { supabase } from "../../lib/supabase"
import "./Home.css"

export default function Home() {
  const [latestEdition, setLatestEdition] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState("")

  // =========================================
  // LANGUAGE
  // =========================================

  const [language, setLanguage] = useState(() => {
    return (
      localStorage.getItem(
        "shubhodayam-language"
      ) || "en"
    )
  })

  const isTelugu =
    language === "te"

  // =========================================
  // SEO
  // =========================================

  useEffect(() => {
    document.title = isTelugu
      ? "శుభోదయం భారత్ – దినపత్రిక"
      : "Shubhodayam Bharath – Daily Telugu & English Newspaper"

    const description = isTelugu
      ? "శుభోదయం భారత్ – తాజా తెలుగు మరియు ఇంగ్లీష్ దినపత్రికను ఆన్‌లైన్‌లో చదవండి."
      : "Shubhodayam Bharath – Read the latest Telugu and English daily newspaper online."

    let metaDescription =
      document.querySelector(
        'meta[name="description"]'
      )

    if (!metaDescription) {
      metaDescription =
        document.createElement("meta")

      metaDescription.setAttribute(
        "name",
        "description"
      )

      document.head.appendChild(
        metaDescription
      )
    }

    metaDescription.setAttribute(
      "content",
      description
    )
  }, [isTelugu])

  // =========================================
  // LANGUAGE LISTENER
  // =========================================

  useEffect(() => {
    function updateLanguage() {
      setLanguage(
        localStorage.getItem(
          "shubhodayam-language"
        ) || "en"
      )
    }

    window.addEventListener(
      "languagechange",
      updateLanguage
    )

    window.addEventListener(
      "storage",
      updateLanguage
    )

    return () => {
      window.removeEventListener(
        "languagechange",
        updateLanguage
      )

      window.removeEventListener(
        "storage",
        updateLanguage
      )
    }
  }, [])

  // =========================================
  // SAVE LANGUAGE
  // =========================================

  useEffect(() => {
    localStorage.setItem(
      "shubhodayam-language",
      language
    )
  }, [language])

  // =========================================
  // LOAD LATEST EDITION
  // =========================================

  useEffect(() => {
    let cancelled = false

    async function loadLatestEdition() {
      try {
        setLoading(true)
        setError("")

        const {
          data,
          error: editionError,
        } = await supabase
          .from("editions")
          .select("*")
          .not("pdf_path", "is", null)
          .order("date", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle()

        if (cancelled) {
          return
        }

        if (editionError) {
          console.error(
            "Latest edition error:",
            editionError
          )

          setError(
            isTelugu
              ? "తాజా సంచికను లోడ్ చేయడం సాధ్యం కాలేదు."
              : "Unable to load the latest edition."
          )

          setLatestEdition(null)

          return
        }

        console.log(
          "HOME LATEST EDITION:",
          data
        )

        setLatestEdition(
          data || null
        )
      } catch (err) {
        console.error(
          "Home latest edition error:",
          err
        )

        if (!cancelled) {
          setError(
            isTelugu
              ? "తాజా సంచికను లోడ్ చేస్తున్నప్పుడు సమస్య వచ్చింది."
              : "Something went wrong while loading the latest edition."
          )

          setLatestEdition(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadLatestEdition()

    return () => {
      cancelled = true
    }
  }, [isTelugu])

  // =========================================
  // FORMAT NEWSPAPER DATE
  // =========================================

  function formatDate(dateString) {
    if (!dateString) {
      return ""
    }

    const date = new Date(
      `${dateString}T00:00:00`
    )

    return date.toLocaleDateString(
      isTelugu
        ? "te-IN"
        : "en-IN",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    )
  }

  // =========================================
  // TEXT
  // =========================================

  const text = {
    en: {
      badge:
        "DAILY NEWSPAPER",

      heroTitle:
        "Shubhodayam Bharath",

      heroText:
        "Your daily newspaper, available digitally.",

      latestLabel:
        "LATEST EDITION",

      latestTitle:
        "Latest Newspaper",

      digital:
        "Digital Newspaper Edition",

      read:
        "Read Newspaper",

      archive:
        "NEWSPAPER ARCHIVE",

      archiveTitle:
        "Browse Previous Editions",

      archiveText:
        "View newspapers from previous dates using the calendar.",

      viewCalendar:
        "View Calendar",

      about:
        "ABOUT",

      aboutTitle:
        "Shubhodayam Bharath",

      aboutText:
        "Shubhodayam Bharath is a daily newspaper bringing news and information to readers in a simple and accessible digital format.",

      loading:
        "Loading latest edition...",

      noEdition:
        "No newspaper edition has been uploaded yet.",
    },

    te: {
      badge:
        "దినపత్రిక",

      heroTitle:
        "శుభోదయం భారత్",

      heroText:
        "మీ దినపత్రికను డిజిటల్ రూపంలో చదవండి.",

      latestLabel:
        "తాజా సంచిక",

      latestTitle:
        "తాజా వార్తాపత్రిక",

      digital:
        "డిజిటల్ వార్తాపత్రిక సంచిక",

      read:
        "వార్తాపత్రిక చదవండి",

      archive:
        "వార్తాపత్రిక ఆర్కైవ్",

      archiveTitle:
        "మునుపటి సంచికలను చూడండి",

      archiveText:
        "క్యాలెండర్ ద్వారా మునుపటి తేదీల వార్తాపత్రికలను చూడండి.",

      viewCalendar:
        "క్యాలెండర్ చూడండి",

      about:
        "గురించి",

      aboutTitle:
        "శుభోదయం భారత్",

      aboutText:
        "శుభోదయం భారత్ ఒక దినపత్రిక. వార్తలు మరియు సమాచారాన్ని సరళమైన, అందుబాటులో ఉండే డిజిటల్ రూపంలో పాఠకులకు అందిస్తుంది.",

      loading:
        "తాజా సంచికను లోడ్ చేస్తోంది...",

      noEdition:
        "ఇంకా వార్తాపత్రిక సంచికను అప్‌లోడ్ చేయలేదు.",
    },
  }

  const t =
    text[language] || text.en

  // =========================================
  // PAGE
  // =========================================

  return (
    <div className="home-page">

      {/* HEADER */}

      <Header />

      {/* MAIN */}

      <main className="home-main">

        {/* ===================================
            HERO
        =================================== */}

        <section className="home-hero">

          <div className="home-hero-content">

            {/* Hidden duplicate logo.
                Header already contains logo. */}

            <div
              className="home-logo"
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <img
                src="/logo.png"
                alt="Shubhodayam Bharath"
                style={{
                  display: "block",
                  width: "auto",
                  maxWidth: "220px",
                  height: "auto",
                  maxHeight: "120px",
                  objectFit: "contain",
                }}
              />
            </div>

            <span className="home-hero-badge">
              {t.badge}
            </span>

            <h1>
              {t.heroTitle}
            </h1>

            <p>
              {t.heroText}
            </p>

          </div>

        </section>

        {/* ===================================
            LATEST EDITION
        =================================== */}

        <section className="home-latest-section">

          <span className="home-section-label">
            {t.latestLabel}
          </span>

          <h2 className="home-section-title">
            {t.latestTitle}
          </h2>

          {/* LOADING */}

          {loading && (
            <div className="home-loading">
              {t.loading}
            </div>
          )}

          {/* ERROR */}

          {!loading && error && (
            <div className="home-error">
              {error}
            </div>
          )}

          {/* NO EDITION */}

          {!loading &&
            !error &&
            !latestEdition && (
              <div className="home-empty">
                {t.noEdition}
              </div>
            )}

          {/* LATEST EDITION */}

          {!loading &&
            !error &&
            latestEdition && (
              <div className="home-latest-card">

                {/* TOP */}

                <div className="home-latest-top">

                  <strong className="home-latest-label">
                    {t.latestLabel}
                  </strong>

                  <span className="home-latest-date">
                    {formatDate(
                      latestEdition.date
                    )}
                  </span>

                </div>

                {/* CONTENT */}

                <div className="home-latest-content">

                  {/* NEWSPAPER ICON */}

                  <div className="home-newspaper-icon">
                    📰
                  </div>

                  {/* INFORMATION */}

                  <div className="home-latest-info">

                    <h3>
                      {isTelugu
                        ? "శుభోదయం భారత్"
                        : "SHUBHODAYAM BHARATH"}
                    </h3>

                    <p>
                      {formatDate(
                        latestEdition.date
                      )}
                    </p>

                    <span>
                      {t.digital}
                    </span>

                  </div>

                  {/* READ */}

                  <Link
                    to={`/newspaper/${latestEdition.date}`}
                    className="home-read-button"
                    onClick={() => {
                      console.log(
                        "HOME READ NEWSPAPER:",
                        latestEdition.date
                      )
                    }}
                  >
                    {t.read}
                  </Link>

                </div>

              </div>
            )}

        </section>

        {/* ===================================
            CALENDAR / ARCHIVE
        =================================== */}

        <section className="home-calendar-section">

          <div className="home-calendar-content">

            <span className="home-section-label">
              {t.archive}
            </span>

            <h2>
              {t.archiveTitle}
            </h2>

            <p>
              {t.archiveText}
            </p>

          </div>

          <Link
            to="/calendar"
            className="home-calendar-button"
          >
            {t.viewCalendar}
          </Link>

        </section>

        {/* ===================================
            ABOUT
        =================================== */}

        <section className="home-about-section">

          <span className="home-section-label">
            {t.about}
          </span>

          <h2>
            {t.aboutTitle}
          </h2>

          <p>
            {t.aboutText}
          </p>

        </section>

      </main>

      {/* FOOTER */}

      <footer className="home-footer">

        ©️ {new Date().getFullYear()}
        {" "}
        Shubhodayam Bharath

      </footer>

    </div>
  )
}