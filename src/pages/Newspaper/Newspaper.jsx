import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import Header from "../../components/Header"
import NewspaperViewer from "../../components/NewspaperViewer/NewspaperViewer"
import { supabase } from "../../lib/supabase"

const SITE_URL =
  "https://shubhodayam-bharath.vercel.app"

const SITE_NAME =
  "Shubhodayam Bharath"

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
  // SEO + SOCIAL SHARE PREVIEW
  // ==========================================================

  useEffect(() => {
    const pageUrl = date
      ? `${SITE_URL}/newspaper/${date}`
      : SITE_URL

    const pageTitle = date
      ? isTelugu
        ? `శుభోదయం భారత్ – ${date} వార్తాపత్రిక`
        : `Shubhodayam Bharath – ${date} Newspaper`
      : isTelugu
        ? "శుభోదయం భారత్ – వార్తాపత్రిక"
        : "Shubhodayam Bharath – Newspaper"

    const description = date
      ? isTelugu
        ? `${date} తేదీ శుభోదయం భారత్ తెలుగు మరియు ఇంగ్లీష్ దినపత్రిక సంచికను ఆన్‌లైన్‌లో చదవండి.`
        : `Read the Shubhodayam Bharath Telugu and English daily newspaper edition for ${date} online.`
      : isTelugu
        ? "శుభోదయం భారత్ దినపత్రికను ఆన్‌లైన్‌లో చదవండి."
        : "Read Shubhodayam Bharath daily newspaper online."

    // --------------------------------------------------------
    // Newspaper thumbnail
    // --------------------------------------------------------

    let thumbnailUrl = ""

    if (date) {
      const {
        data: thumbnailData,
      } = supabase.storage
        .from("newspapers")
        .getPublicUrl(
          `thumbnails/${date}.jpg`
        )

      thumbnailUrl =
        thumbnailData?.publicUrl || ""
    }

    document.title = pageTitle

    // --------------------------------------------------------
    // Helper for meta tags
    // --------------------------------------------------------

    function setMetaTag(
      attribute,
      attributeValue,
      content
    ) {
      if (!content) {
        return
      }

      let element =
        document.querySelector(
          `meta[${attribute}="${attributeValue}"]`
        )

      if (!element) {
        element =
          document.createElement("meta")

        element.setAttribute(
          attribute,
          attributeValue
        )

        document.head.appendChild(
          element
        )
      }

      element.setAttribute(
        "content",
        content
      )
    }

    // --------------------------------------------------------
    // Standard description
    // --------------------------------------------------------

    setMetaTag(
      "name",
      "description",
      description
    )

    // --------------------------------------------------------
    // Open Graph
    // --------------------------------------------------------

    setMetaTag(
      "property",
      "og:type",
      "article"
    )

    setMetaTag(
      "property",
      "og:title",
      pageTitle
    )

    setMetaTag(
      "property",
      "og:description",
      description
    )

    setMetaTag(
      "property",
      "og:url",
      pageUrl
    )

    setMetaTag(
      "property",
      "og:site_name",
      SITE_NAME
    )

    if (thumbnailUrl) {
      setMetaTag(
        "property",
        "og:image",
        thumbnailUrl
      )

      setMetaTag(
        "property",
        "og:image:secure_url",
        thumbnailUrl
      )

      setMetaTag(
        "property",
        "og:image:type",
        "image/jpeg"
      )

      setMetaTag(
        "property",
        "og:image:alt",
        `${SITE_NAME} ${date || ""} Newspaper`
      )
    }

    // --------------------------------------------------------
    // Twitter / X
    // --------------------------------------------------------

    setMetaTag(
      "name",
      "twitter:card",
      "summary_large_image"
    )

    setMetaTag(
      "name",
      "twitter:title",
      pageTitle
    )

    setMetaTag(
      "name",
      "twitter:description",
      description
    )

    if (thumbnailUrl) {
      setMetaTag(
        "name",
        "twitter:image",
        thumbnailUrl
      )
    }

    // --------------------------------------------------------
    // Canonical URL
    // --------------------------------------------------------

    let canonical =
      document.querySelector(
        'link[rel="canonical"]'
      )

    if (!canonical) {
      canonical =
        document.createElement("link")

      canonical.setAttribute(
        "rel",
        "canonical"
      )

      document.head.appendChild(
        canonical
      )
    }

    canonical.setAttribute(
      "href",
      pageUrl
    )

    // --------------------------------------------------------
    // Structured data
    // --------------------------------------------------------

    const existingSchema =
      document.getElementById(
        "newspaper-schema"
      )

    if (existingSchema) {
      existingSchema.remove()
    }

    const schema = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": pageTitle,
      "description": description,
      "url": pageUrl,
      "datePublished": date || undefined,
      "image": thumbnailUrl
        ? [thumbnailUrl]
        : undefined,
      "publisher": {
        "@type": "Organization",
        "name": SITE_NAME,
        "url": SITE_URL,
      },
      "isPartOf": {
        "@type": "WebSite",
        "name": SITE_NAME,
        "url": `${SITE_URL}/`,
      },
    }

    const schemaScript =
      document.createElement("script")

    schemaScript.id =
      "newspaper-schema"

    schemaScript.type =
      "application/ld+json"

    schemaScript.textContent =
      JSON.stringify(schema)

    document.head.appendChild(
      schemaScript
    )

    console.log(
      "SHARE PAGE URL:",
      pageUrl
    )

    console.log(
      "SHARE THUMBNAIL URL:",
      thumbnailUrl
    )

    return () => {
      const schemaToRemove =
        document.getElementById(
          "newspaper-schema"
        )

      if (schemaToRemove) {
        schemaToRemove.remove()
      }
    }
  }, [date, isTelugu])

  // ==========================================================
  // LOAD ALL EDITIONS
  // ==========================================================

  useEffect(() => {
    async function loadEditions() {
      const {
        data,
        error: editionsError,
      } = await supabase
        .from("editions")
        .select("*")
        .order("date", {
          ascending: true,
        })

      if (editionsError) {
        console.error(
          "Editions navigation error:",
          editionsError
        )

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

        console.log(
          "Loading newspaper date:",
          date
        )

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

        console.log(
          "EDITION DATA:",
          data
        )

        console.log(
          "EDITION ERROR:",
          editionError
        )

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
            .getPublicUrl(
              data.pdf_path
            )

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

        // ======================================================
        // CREATE THUMBNAIL URL
        // ======================================================

        const {
          data: thumbnailData,
        } = supabase.storage
          .from("newspapers")
          .getPublicUrl(
            `thumbnails/${date}.jpg`
          )

        data.thumbnail_url =
          thumbnailData?.publicUrl || ""

        console.log(
          "THUMBNAIL URL:",
          data.thumbnail_url
        )

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

  const currentIndex =
    editions.findIndex(
      (item) =>
        item.date === date
    )

  const previousEdition =
    currentIndex > 0
      ? editions[currentIndex - 1]
      : null

  const nextEdition =
    currentIndex >= 0 &&
    currentIndex <
      editions.length - 1
      ? editions[currentIndex + 1]
      : null

  function goToEdition(
    targetDate
  ) {
    if (!targetDate) {
      return
    }

    navigate(
      `/newspaper/${targetDate}`
    )

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

            <div className="section-heading newspaper-loading">

              <div className="loading-spinner"></div>

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

          {/* ==================================================
              BACK TO CALENDAR
          ================================================== */}

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
                goToEdition(
                  previousEdition?.date
                )
              }
              disabled={
                !previousEdition
              }
              style={{
                flex: 1,
                padding: "11px 14px",
                borderRadius: "8px",
                border: "1px solid #dfe5eb",
                background:
                  previousEdition
                    ? "#123c69"
                    : "#f1f5f9",
                color:
                  previousEdition
                    ? "#ffffff"
                    : "#9ca3af",
                cursor:
                  previousEdition
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
                goToEdition(
                  nextEdition?.date
                )
              }
              disabled={
                !nextEdition
              }
              style={{
                flex: 1,
                padding: "11px 14px",
                borderRadius: "8px",
                border: "1px solid #dfe5eb",
                background:
                  nextEdition
                    ? "#167447"
                    : "#f1f5f9",
                color:
                  nextEdition
                    ? "#ffffff"
                    : "#9ca3af",
                cursor:
                  nextEdition
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

          {/* ==================================================
              NEWSPAPER VIEWER
          ================================================== */}

          <NewspaperViewer
            edition={edition}
          />

        </section>

      </main>
    </>
  )
}

export default Newspaper