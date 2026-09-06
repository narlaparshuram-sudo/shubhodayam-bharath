import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import Header from "../../components/Header"
import NewspaperViewer from "../../components/NewspaperViewer/NewspaperViewer"
import { supabase } from "../../lib/supabase"

function Newspaper() {
  const { date } = useParams()
  const navigate = useNavigate()

  const [edition, setEdition] = useState(null)
  const [editions, setEditions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [language, setLanguage] = useState(
    localStorage.getItem("shubhodayam-language") || "en"
  )

  const isTelugu = language === "te"

  // ==========================================================
  // LANGUAGE
  // ==========================================================

  useEffect(() => {
    function updateLanguage() {
      setLanguage(
        localStorage.getItem("shubhodayam-language") || "en"
      )
    }

    window.addEventListener("storage", updateLanguage)
    window.addEventListener("languagechange", updateLanguage)

    const interval = setInterval(updateLanguage, 300)

    return () => {
      window.removeEventListener("storage", updateLanguage)
      window.removeEventListener("languagechange", updateLanguage)
      clearInterval(interval)
    }
  }, [])

  // ==========================================================
  // LOAD ALL EDITIONS
  // ==========================================================

  useEffect(() => {
    async function loadEditions() {
      const { data, error } = await supabase
        .from("editions")
        .select("*")
        .order("date", { ascending: true })

      if (error) {
        console.error("Editions navigation error:", error)
        setEditions([])
        return
      }

      setEditions(data || [])
    }

    loadEditions()
  }, [])

  // ==========================================================
  // LOAD CURRENT EDITION
  // ==========================================================

  useEffect(() => {
    async function loadEdition() {
      try {
        setLoading(true)
        setError("")
        setEdition(null)

        console.log("Loading newspaper date:", date)

        if (!date) {
          setError(
            isTelugu
              ? "వార్తాపత్రిక తేదీ అందుబాటులో లేదు."
              : "Newspaper date is missing."
          )

          setLoading(false)
          return
        }

        const {
          data,
          error: editionError,
        } = await supabase
          .from("editions")
          .select("*")
          .eq("date", date)
          .maybeSingle()

        console.log("EDITION DATA:", data)
        console.log("EDITION ERROR:", editionError)

        if (editionError) {
          console.error(
            "Edition loading error:",
            editionError
          )

          setError(
            isTelugu
              ? "ఈ వార్తాపత్రిక సంచికను లోడ్ చేయడం సాధ్యం కాలేదు."
              : "Unable to load this newspaper edition."
          )

          setLoading(false)
          return
        }

        if (!data) {
          setError(
            isTelugu
              ? `${date} తేదీకి వార్తాపత్రిక సంచిక కనుగొనబడలేదు.`
              : `No newspaper edition found for ${date}.`
          )

          setLoading(false)
          return
        }

        // ======================================================
        // CREATE PUBLIC PDF URL
        // ======================================================

        if (data.pdf_path) {
          const {
            data: publicUrlData,
          } = supabase.storage
            .from("newspapers")
            .getPublicUrl(data.pdf_path)

          console.log(
            "PDF PATH:",
            data.pdf_path
          )

          console.log(
            "PDF PUBLIC URL:",
            publicUrlData?.publicUrl
          )

          data.pdf_url =
            publicUrlData?.publicUrl || ""
        }

        setEdition(data)

      } catch (err) {
        console.error(
          "NEWSPAPER PAGE ERROR:",
          err
        )

        setError(
          isTelugu
            ? "వార్తాపత్రికను లోడ్ చేస్తున్నప్పుడు సమస్య వచ్చింది."
            : "Something went wrong while loading the newspaper."
        )
      } finally {
        setLoading(false)
      }
    }

    loadEdition()
  }, [date, isTelugu])

  // ==========================================================
  // FIND PREVIOUS / NEXT EDITION
  // ==========================================================

  const currentIndex = editions.findIndex(
    (item) => item.date === date
  )

  const previousEdition =
    currentIndex > 0
      ? editions[currentIndex - 1]
      : null

  const nextEdition =
    currentIndex >= 0 &&
    currentIndex < editions.length - 1
      ? editions[currentIndex + 1]
      : null

  function goToEdition(targetDate) {
    if (!targetDate) return

    navigate(`/newspaper/${targetDate}`)
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <>
        <Header />

        <main className="home-main">
          <section className="calendar-page">

            <div className="section-heading">

              <h2>
                {isTelugu
                  ? "వార్తాపత్రిక లోడ్ అవుతోంది..."
                  : "Loading Newspaper..."}
              </h2>

              <p>
                {isTelugu
                  ? "దయచేసి వేచి ఉండండి."
                  : "Please wait."}
              </p>

            </div>

          </section>
        </main>
      </>
    )
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error) {
    return (
      <>
        <Header />

        <main className="home-main">
          <section className="calendar-page">

            <div className="section-heading">

              <h2>
                {isTelugu
                  ? "వార్తాపత్రిక"
                  : "Newspaper"}
              </h2>

              <p
                style={{
                  color: "#b00020",
                  fontWeight: "600",
                }}
              >
                {error}
              </p>

              <Link
                to="/calendar"
                className="primary-button"
              >
                {isTelugu
                  ? "క్యాలెండర్‌కు తిరిగి వెళ్లండి"
                  : "Back to Calendar"}
              </Link>

            </div>

          </section>
        </main>
      </>
    )
  }

  // ==========================================================
  // NEWSPAPER
  // ==========================================================

  return (
    <>
      <Header />

      <main className="home-main">

        <section className="calendar-page">

          {/* BACK TO CALENDAR */}

          <div className="section-heading">

            <Link
              to="/calendar"
              className="back-link"
            >
              {isTelugu
                ? "← క్యాలెండర్‌కు తిరిగి వెళ్లండి"
                : "← Back to Calendar"}
            </Link>

          </div>


          {/* ==================================================
              EDITION NAVIGATION
          ================================================== */}

          <div
            className="edition-navigation"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              margin: "20px 0",
              padding: "14px",
              background: "#ffffff",
              border: "1px solid #dfe5eb",
              borderRadius: "12px",
            }}
          >

            {/* PREVIOUS */}

            <button
              type="button"
              onClick={() =>
                goToEdition(previousEdition?.date)
              }
              disabled={!previousEdition}
              style={{
                flex: 1,
                padding: "11px 14px",
                borderRadius: "8px",
                border: "1px solid #dfe5eb",
                background: previousEdition
                  ? "#123c69"
                  : "#f1f5f9",
                color: previousEdition
                  ? "#ffffff"
                  : "#9ca3af",
                cursor: previousEdition
                  ? "pointer"
                  : "not-allowed",
                fontWeight: 700,
              }}
            >
              {isTelugu
                ? "← మునుపటి సంచిక"
                : "← Previous Edition"}
            </button>


            {/* CURRENT DATE */}

            <div
              style={{
                minWidth: "150px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#167447",
                  letterSpacing: "1px",
                }}
              >
                {isTelugu
                  ? "ప్రస్తుత సంచిక"
                  : "CURRENT EDITION"}
              </div>

              <div
                style={{
                  marginTop: "4px",
                  fontWeight: 700,
                  color: "#123c69",
                }}
              >
                {date}
              </div>
            </div>


            {/* NEXT */}

            <button
              type="button"
              onClick={() =>
                goToEdition(nextEdition?.date)
              }
              disabled={!nextEdition}
              style={{
                flex: 1,
                padding: "11px 14px",
                borderRadius: "8px",
                border: "1px solid #dfe5eb",
                background: nextEdition
                  ? "#167447"
                  : "#f1f5f9",
                color: nextEdition
                  ? "#ffffff"
                  : "#9ca3af",
                cursor: nextEdition
                  ? "pointer"
                  : "not-allowed",
                fontWeight: 700,
              }}
            >
              {isTelugu
                ? "తదుపరి సంచిక →"
                : "Next Edition →"}
            </button>

          </div>


          {/* NEWSPAPER VIEWER */}

          <NewspaperViewer
            edition={edition}
          />

        </section>

      </main>
    </>
  )
}

export default Newspaper