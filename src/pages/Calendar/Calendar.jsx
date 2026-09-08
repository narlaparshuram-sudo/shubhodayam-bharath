import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import "../Calendar.css"

export default function Calendar() {
  const navigate = useNavigate()

  const today = new Date()

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

  const [currentMonth, setCurrentMonth] = useState(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    )
  )

  const [editions, setEditions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Search editions
  const [searchTerm, setSearchTerm] = useState("")

  // =========================================
  // SEO
  // =========================================

  const isTelugu = language === "te"

  useEffect(() => {
    document.title = isTelugu
      ? "శుభోదయం భారత్ – వార్తాపత్రిక క్యాలెండర్"
      : "Shubhodayam Bharath – Newspaper Calendar"

    const description = isTelugu
      ? "శుభోదయం భారత్ వార్తాపత్రిక క్యాలెండర్ ద్వారా మునుపటి మరియు తాజా దినపత్రిక సంచికలను తేదీ వారీగా చదవండి."
      : "Browse and read Shubhodayam Bharath Telugu and English newspaper editions by date."

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
  // SAVE LANGUAGE
  // =========================================

  useEffect(() => {
    localStorage.setItem(
      "shubhodayam-language",
      language
    )
  }, [language])

  // =========================================
  // TRANSLATIONS
  // =========================================

  const text = {
    en: {
      tagline: "Your Daily Newspaper",
      home: "Home",
      calendar: "Calendar",
      read: "Read Newspaper",

      title: "Newspaper Calendar",

      description:
        "Select a date to read the Shubhodayam Bharath edition.",

      today: "Today",

      weekdays: [
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
      ],

      newspaper: "Newspaper",

      available: "Newspaper available",
      unavailable: "Not available",

      availableEditions: "Available Editions",

      edition: "edition",
      editions: "editions",

      loading:
        "Loading newspaper editions...",

      noEditions:
        "No newspaper editions are available yet.",

      noSearchResults:
        "No editions found for your search.",

      readNewspaper:
        "Read Newspaper",

      unavailableTitle:
        "Newspaper not available",

      error:
        "Unable to load newspaper editions.",

      searchPlaceholder:
        "Search by date...",

      searchLabel:
        "Search newspaper by date",
    },

    te: {
      tagline: "మీ దినపత్రిక",

      home: "హోమ్",

      calendar: "క్యాలెండర్",

      read: "వార్తాపత్రిక చదవండి",

      title:
        "వార్తాపత్రిక క్యాలెండర్",

      description:
        "శుభోదయం భారత్ సంచికను చదవడానికి తేదీని ఎంచుకోండి.",

      today: "ఈరోజు",

      weekdays: [
        "ఆది",
        "సోమ",
        "మంగళ",
        "బుధ",
        "గురు",
        "శుక్ర",
        "శని",
      ],

      newspaper:
        "వార్తాపత్రిక",

      available:
        "వార్తాపత్రిక అందుబాటులో ఉంది",

      unavailable:
        "అందుబాటులో లేదు",

      availableEditions:
        "అందుబాటులో ఉన్న సంచికలు",

      edition: "సంచిక",

      editions: "సంచికలు",

      loading:
        "వార్తాపత్రిక సంచికలను లోడ్ చేస్తోంది...",

      noEditions:
        "ఇంకా వార్తాపత్రిక సంచికలు అందుబాటులో లేవు.",

      noSearchResults:
        "మీ శోధనకు సంచికలు కనుగొనబడలేదు.",

      readNewspaper:
        "వార్తాపత్రిక చదవండి",

      unavailableTitle:
        "వార్తాపత్రిక అందుబాటులో లేదు",

      error:
        "వార్తాపత్రిక సంచికలను లోడ్ చేయలేకపోయాము.",

      searchPlaceholder:
        "తేదీ ద్వారా వెతకండి...",

      searchLabel:
        "వార్తాపత్రిక తేదీని వెతకండి",
    },
  }

  const t =
    text[language] || text.en

  // =========================================
  // LOAD EDITIONS
  // =========================================

  useEffect(() => {
    async function loadEditions() {
      setLoading(true)
      setError("")

      const { data, error } = await supabase
        .from("editions")
        .select("*")
        .not("pdf_path", "is", null)
        .order("date", {
          ascending: false,
        })

      if (error) {
        console.error(
          "Calendar error:",
          error
        )

        setError(t.error)
        setEditions([])
      } else {
        setEditions(data || [])
      }

      setLoading(false)
    }

    loadEditions()
  }, [])

  // =========================================
  // EDITION DATE LOOKUP
  // =========================================

  const editionDates = useMemo(() => {
    const map = {}

    editions.forEach((edition) => {
      if (edition.date) {
        map[edition.date] = edition
      }
    })

    return map
  }, [editions])

  // =========================================
  // SEARCH
  // =========================================

  const filteredEditions = useMemo(() => {
    const term =
      searchTerm
        .trim()
        .toLowerCase()

    if (!term) {
      return editions
    }

    return editions.filter(
      (edition) => {
        const date = String(
          edition.date || ""
        ).toLowerCase()

        const title = String(
          edition.title || ""
        ).toLowerCase()

        return (
          date.includes(term) ||
          title.includes(term)
        )
      }
    )
  }, [editions, searchTerm])

  // =========================================
  // CALENDAR
  // =========================================

  const year =
    currentMonth.getFullYear()

  const month =
    currentMonth.getMonth()

  const firstDay = new Date(
    year,
    month,
    1
  ).getDay()

  const daysInMonth = new Date(
    year,
    month + 1,
    0
  ).getDate()

  const calendarDays = []

  for (
    let i = 0;
    i < firstDay;
    i++
  ) {
    calendarDays.push(null)
  }

  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {
    calendarDays.push(day)
  }

  // =========================================
  // MONTH NAME
  // =========================================

  const monthName =
    currentMonth.toLocaleString(
      language === "te"
        ? "te-IN"
        : "en-US",
      {
        month: "long",
      }
    )

  // =========================================
  // MONTH NAVIGATION
  // =========================================

  function previousMonth() {
    setCurrentMonth(
      new Date(
        year,
        month - 1,
        1
      )
    )
  }

  function nextMonth() {
    const currentYear =
      today.getFullYear()

    const currentMonth =
      today.getMonth()

    if (
      year > currentYear ||
      (
        year === currentYear &&
        month >= currentMonth
      )
    ) {
      return
    }

    setCurrentMonth(
      new Date(
        year,
        month + 1,
        1
      )
    )
  }

  function goToToday() {
    setCurrentMonth(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    )
  }

  // =========================================
  // FORMAT DATE
  // =========================================

  function formatDate(day) {
    return `${year}-${String(
      month + 1
    ).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`
  }

  // =========================================
  // OPEN NEWSPAPER
  // =========================================

  function openEdition(date) {
    if (editionDates[date]) {
      navigate(
        `/newspaper/${date}`
      )
    }
  }

  // =========================================
  // PAGE
  // =========================================

  return (
    <div className="calendar-page">

      {/* HEADER */}

      <header className="calendar-header">

        <div className="calendar-brand">

          <Link
            to="/"
            className="calendar-logo"
          >
            Shubhodayam Bharath
          </Link>

          <span className="calendar-tagline">
            {t.tagline}
          </span>

        </div>

        <nav className="calendar-navigation">

          <Link to="/">
            {t.home}
          </Link>

          <Link
            to="/calendar"
            className="active"
          >
            {t.calendar}
          </Link>

          {editions.length > 0 && (
            <Link
              to={`/newspaper/${editions[0].date}`}
            >
              {t.read}
            </Link>
          )}

          {/* LANGUAGE */}

          <div className="language-switcher">

            <button
              type="button"
              className={
                language === "te"
                  ? "selected"
                  : ""
              }
              onClick={() =>
                setLanguage("te")
              }
            >
              తెలుగు
            </button>

            <span>|</span>

            <button
              type="button"
              className={
                language === "en"
                  ? "selected"
                  : ""
              }
              onClick={() =>
                setLanguage("en")
              }
            >
              English
            </button>

          </div>

        </nav>

      </header>

      {/* MAIN */}

      <main className="calendar-main">

        {/* TITLE */}

        <div className="calendar-title-section">

          <h1>
            {t.title}
          </h1>

          <p>
            {t.description}
          </p>

        </div>

        {/* CALENDAR CARD */}

        <section className="calendar-card">

          {/* TOOLBAR */}

          <div className="calendar-toolbar">

            <button
              type="button"
              className="month-button"
              onClick={
                previousMonth
              }
            >
              ‹
            </button>

            <div className="month-title">

              <h2>
                {monthName} {year}
              </h2>

              <button
                type="button"
                className="today-button"
                onClick={
                  goToToday
                }
              >
                {t.today}
              </button>

            </div>

            <button
              type="button"
              className="month-button"
              onClick={
                nextMonth
              }
              disabled={
                year ===
                  today.getFullYear() &&
                month ===
                  today.getMonth()
              }
            >
              ›
            </button>

          </div>

          {/* WEEKDAYS */}

          <div className="calendar-weekdays">

            {t.weekdays.map(
              (day) => (
                <div key={day}>
                  {day}
                </div>
              )
            )}

          </div>

          {/* DAYS */}

          <div className="calendar-grid">

            {calendarDays.map(
              (day, index) => {

                if (
                  day === null
                ) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="calendar-day empty"
                    />
                  )
                }

                const dateString =
                  formatDate(day)

                const edition =
                  editionDates[
                    dateString
                  ]

                const isToday =
                  day ===
                    today.getDate() &&
                  month ===
                    today.getMonth() &&
                  year ===
                    today.getFullYear()

                return (
                  <button
                    key={
                      dateString
                    }
                    type="button"
                    className={`calendar-day ${
                      edition
                        ? "has-edition"
                        : ""
                    } ${
                      isToday
                        ? "today"
                        : ""
                    }`}
                    onClick={() => {
                      if (edition) {
                        openEdition(
                          dateString
                        )
                      }
                    }}
                    disabled={
                      !edition
                    }
                    title={
                      edition
                        ? `${t.readNewspaper} - ${dateString}`
                        : t.unavailableTitle
                    }
                  >

                    <span className="day-number">
                      {day}
                    </span>

                    {edition && (
                      <span className="edition-dot">
                        {t.newspaper}
                      </span>
                    )}

                  </button>
                )
              }
            )}

          </div>

          {/* LEGEND */}

          <div className="calendar-legend">

            <div className="legend-item">

              <span className="legend-dot available"></span>

              {t.available}

            </div>

            <div className="legend-item">

              <span className="legend-dot unavailable"></span>

              {t.unavailable}

            </div>

          </div>

        </section>

        {/* AVAILABLE EDITIONS */}

        <section className="editions-section">

          {/* SEARCH */}

          <div className="edition-search">

            <input
              type="search"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
              placeholder={
                t.searchPlaceholder
              }
              aria-label={
                t.searchLabel
              }
            />

          </div>

          {/* HEADING */}

          <div className="section-heading">

            <h2>
              {t.availableEditions}
            </h2>

            <span>
              {filteredEditions.length}{" "}
              {filteredEditions.length ===
              1
                ? t.edition
                : t.editions}
            </span>

          </div>

          {/* LOADING */}

          {loading && (
            <div className="calendar-message">
              {t.loading}
            </div>
          )}

          {/* ERROR */}

          {error && (
            <div className="calendar-error">
              {error}
            </div>
          )}

          {/* NO EDITIONS */}

          {!loading &&
            !error &&
            editions.length ===
              0 && (
              <div className="calendar-message">
                {t.noEditions}
              </div>
            )}

          {/* NO SEARCH RESULTS */}

          {!loading &&
            !error &&
            editions.length > 0 &&
            filteredEditions.length ===
              0 && (
              <div className="calendar-message">
                {t.noSearchResults}
              </div>
            )}

          {/* EDITION LIST */}

          {!loading &&
            !error &&
            filteredEditions.length >
              0 && (

              <div className="edition-list">

                {filteredEditions.map(
                  (edition) => (

                    <div
                      className="edition-card"
                      key={
                        edition.id ||
                        edition.date
                      }
                    >

                      <div className="edition-info">

                        <span className="edition-label">
                          SHUBHODAYAM BHARATH
                        </span>

                        <strong>
                          {edition.date}
                        </strong>

                      </div>

                      <button
                        type="button"
                        className="read-edition-button"
                        onClick={() =>
                          openEdition(
                            edition.date
                          )
                        }
                      >
                        {
                          t.readNewspaper
                        }
                      </button>

                    </div>

                  )
                )}

              </div>

            )}

        </section>

      </main>

      {/* FOOTER */}

      <footer className="calendar-footer">

        ©️{" "}
        {new Date().getFullYear()}{" "}
        Shubhodayam Bharath

      </footer>

    </div>
  )
}