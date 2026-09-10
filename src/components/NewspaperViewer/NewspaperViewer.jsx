import { useEffect, useRef, useState } from "react"
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs"

import CropEditor from "./CropEditor"

import "./NewspaperViewer.css"

// ==========================================================
// PDF.JS WORKER
// ==========================================================

const PDFJS_VERSION = "6.2.108"

const PDF_WORKER_URL =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`

const PDF_WASM_URL =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/wasm/`

pdfjsLib.GlobalWorkerOptions.workerSrc =
  PDF_WORKER_URL

// ==========================================================
// CONSTANTS
// ==========================================================

const MAX_RENDER_PIXELS = 24000000
const MAX_RENDER_WIDTH = 5000
const MAX_RENDER_HEIGHT = 9000

const MIN_ZOOM = 0.6
const MAX_ZOOM = 2.5

const HIGH_QUALITY_SCALE = 2.5

// ==========================================================
// HELPER
// ==========================================================

function getPdfUrl(edition) {
  if (!edition) {
    return ""
  }

  return (
    edition.pdf_url ||
    edition.pdfUrl ||
    edition.url ||
    ""
  )
}

// ==========================================================
// COMPONENT
// ==========================================================

function NewspaperViewer({ edition }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  const pdfRef = useRef(null)
  const renderTaskRef = useRef(null)

  const [pdfDocument, setPdfDocument] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState("")

  const [currentPage, setCurrentPage] =
    useState(1)

  const [totalPages, setTotalPages] =
    useState(0)

  const [zoom, setZoom] =
    useState(1)

  const [cropOpen, setCropOpen] =
    useState(false)

  const [containerSize, setContainerSize] =
    useState({
      width: 0,
      height: 0,
    })

  const [sharing, setSharing] =
    useState(false)

  const [shareMessage, setShareMessage] =
    useState("")

  // ========================================================
  // LOAD PDF
  // ========================================================

  useEffect(() => {
    let cancelled = false
    let loadingTask = null

    async function loadPdf() {
      try {
        setLoading(true)
        setError("")
        setPdfDocument(null)
        setCurrentPage(1)
        setTotalPages(0)
        setZoom(1)

        if (!edition) {
          setError(
            "Newspaper edition is not available."
          )

          setLoading(false)
          return
        }

        const pdfUrl =
          getPdfUrl(edition)

        if (!pdfUrl) {
          setError(
            "The PDF for this edition has not been uploaded yet."
          )

          setLoading(false)
          return
        }

        console.log(
          "NEWSPAPER PDF URL:",
          pdfUrl
        )

        pdfjsLib.GlobalWorkerOptions.workerSrc =
          PDF_WORKER_URL

        loadingTask =
          pdfjsLib.getDocument({
            url: pdfUrl,

            rangeChunkSize: 65536,

            disableAutoFetch: false,

            disableStream: false,

            wasmUrl: PDF_WASM_URL,

            httpHeaders: {},

            withCredentials: false,
          })

        const pdf =
          await loadingTask.promise

        if (cancelled) {
          if (
            pdf &&
            typeof pdf.destroy ===
              "function"
          ) {
            try {
              await pdf.destroy()
            } catch {
              // Ignore cleanup errors.
            }
          }

          return
        }

        console.log(
          "PDF LOADED. TOTAL PAGES:",
          pdf.numPages
        )

        pdfRef.current =
          pdf

        setPdfDocument(
          pdf
        )

        setTotalPages(
          pdf.numPages
        )

        setCurrentPage(
          1
        )

        setLoading(
          false
        )
      } catch (err) {
        console.error(
          "NEWSPAPER PDF LOAD ERROR:",
          err
        )

        if (cancelled) {
          return
        }

        setPdfDocument(
          null
        )

        setLoading(
          false
        )

        setError(
          err?.message ||
            "Unable to load the newspaper PDF."
        )
      }
    }

    loadPdf()

    return () => {
      cancelled = true

      // ----------------------------------------------------
      // Cancel active render
      // ----------------------------------------------------

      if (
        renderTaskRef.current
      ) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          // Ignore render cleanup errors.
        }

        renderTaskRef.current =
          null
      }

      // ----------------------------------------------------
      // Destroy old PDF safely
      // ----------------------------------------------------

      const oldPdf =
        pdfRef.current

      pdfRef.current =
        null

      if (
        oldPdf &&
        typeof oldPdf.destroy ===
          "function"
      ) {
        try {
          const result =
            oldPdf.destroy()

          if (
            result &&
            typeof result.catch ===
              "function"
          ) {
            result.catch(() => {})
          }
        } catch {
          // Ignore PDF cleanup errors.
        }
      }

      // ----------------------------------------------------
      // Cancel loading task if possible
      // ----------------------------------------------------

      if (
        loadingTask &&
        typeof loadingTask.destroy ===
          "function"
      ) {
        try {
          loadingTask.destroy()
        } catch {
          // Ignore cleanup errors.
        }
      }
    }
  }, [edition])

  // ========================================================
  // WATCH CONTAINER SIZE
  // ========================================================

  useEffect(() => {
    const element =
      containerRef.current

    if (!element) {
      return
    }

    function updateSize() {
      const rect =
        element.getBoundingClientRect()

      setContainerSize({
        width: rect.width,
        height: rect.height,
      })
    }

    updateSize()

    const resizeObserver =
      new ResizeObserver(
        updateSize
      )

    resizeObserver.observe(
      element
    )

    window.addEventListener(
      "resize",
      updateSize
    )

    return () => {
      resizeObserver.disconnect()

      window.removeEventListener(
        "resize",
        updateSize
      )
    }
  }, [])

  // ========================================================
  // CENTER CANVAS
  // ========================================================

  function centerCanvas() {
    const container =
      containerRef.current

    const canvas =
      canvasRef.current

    if (
      !container ||
      !canvas
    ) {
      return
    }

    const containerWidth =
      container.clientWidth

    const containerHeight =
      container.clientHeight

    const canvasWidth =
      canvas.clientWidth

    const canvasHeight =
      canvas.clientHeight

    const left =
      Math.max(
        0,
        (
          containerWidth -
          canvasWidth
        ) / 2
      )

    const top =
      Math.max(
        0,
        (
          containerHeight -
          canvasHeight
        ) / 2
      )

    canvas.style.marginLeft =
      `${left}px`

    canvas.style.marginTop =
      `${top}px`
  }

  // ========================================================
  // RENDER CURRENT PAGE
  // ========================================================

  useEffect(() => {
    let cancelled = false

    async function renderPage() {
      const pdf =
        pdfRef.current

      const canvas =
        canvasRef.current

      if (
        !pdf ||
        !canvas ||
        !totalPages
      ) {
        return
      }

      if (
        currentPage < 1 ||
        currentPage > totalPages
      ) {
        return
      }

      try {
        // --------------------------------------------------
        // Cancel previous render
        // --------------------------------------------------

        if (
          renderTaskRef.current
        ) {
          try {
            renderTaskRef.current.cancel()
          } catch {
            // Ignore.
          }

          renderTaskRef.current =
            null
        }

        // --------------------------------------------------
        // Get page
        // --------------------------------------------------

        const page =
          await pdf.getPage(
            currentPage
          )

        if (cancelled) {
          return
        }

        // --------------------------------------------------
        // Base viewport
        // --------------------------------------------------

        const baseViewport =
          page.getViewport({
            scale: 1,
          })

        const pageWidth =
          baseViewport.width

        const pageHeight =
          baseViewport.height

        // --------------------------------------------------
        // Available display area
        // --------------------------------------------------

        const availableWidth =
          containerSize.width > 20
            ? containerSize.width - 20
            : window.innerWidth - 20

        const availableHeight =
          containerSize.height > 20
            ? containerSize.height - 20
            : window.innerHeight * 0.75

        const widthScale =
          availableWidth /
          pageWidth

        const heightScale =
          availableHeight /
          pageHeight

        // --------------------------------------------------
        // Fit entire newspaper page
        // --------------------------------------------------

        let fitScale =
          Math.min(
            widthScale,
            heightScale
          )

        if (
          !Number.isFinite(
            fitScale
          )
        ) {
          fitScale = 1
        }

        fitScale =
          Math.max(
            fitScale,
            0.1
          )

        // --------------------------------------------------
        // Visual scale
        // --------------------------------------------------

        const visualScale =
          fitScale *
          zoom

        // --------------------------------------------------
        // High quality render scale
        // --------------------------------------------------

        let renderScale =
          visualScale *
          HIGH_QUALITY_SCALE

        let renderWidth =
          pageWidth *
          renderScale

        let renderHeight =
          pageHeight *
          renderScale

        // --------------------------------------------------
        // Maximum canvas pixels
        // --------------------------------------------------

        const totalPixels =
          renderWidth *
          renderHeight

        if (
          totalPixels >
          MAX_RENDER_PIXELS
        ) {
          const reduction =
            Math.sqrt(
              MAX_RENDER_PIXELS /
                totalPixels
            )

          renderScale *=
            reduction

          renderWidth =
            pageWidth *
            renderScale

          renderHeight =
            pageHeight *
            renderScale
        }

        // --------------------------------------------------
        // Maximum dimensions
        // --------------------------------------------------

        if (
          renderWidth >
          MAX_RENDER_WIDTH
        ) {
          renderScale *=
            MAX_RENDER_WIDTH /
            renderWidth
        }

        if (
          renderHeight >
          MAX_RENDER_HEIGHT
        ) {
          renderScale *=
            MAX_RENDER_HEIGHT /
            renderHeight
        }

        // --------------------------------------------------
        // Display viewport
        // --------------------------------------------------

        const displayViewport =
          page.getViewport({
            scale:
              visualScale,
          })

        // --------------------------------------------------
        // Render viewport
        // --------------------------------------------------

        const renderViewport =
          page.getViewport({
            scale:
              renderScale,
          })

        // --------------------------------------------------
        // Canvas dimensions
        // --------------------------------------------------

        canvas.width =
          Math.max(
            1,
            Math.floor(
              renderViewport.width
            )
          )

        canvas.height =
          Math.max(
            1,
            Math.floor(
              renderViewport.height
            )
          )

        canvas.style.width =
          `${displayViewport.width}px`

        canvas.style.height =
          `${displayViewport.height}px`

        // --------------------------------------------------
        // Canvas context
        // --------------------------------------------------

        const context =
          canvas.getContext(
            "2d",
            {
              alpha: false,
            }
          )

        if (!context) {
          throw new Error(
            "Unable to create PDF canvas."
          )
        }

        context.fillStyle =
          "#ffffff"

        context.fillRect(
          0,
          0,
          canvas.width,
          canvas.height
        )

        // --------------------------------------------------
        // Render
        // --------------------------------------------------

        const renderTask =
          page.render({
            canvasContext:
              context,

            viewport:
              renderViewport,

            intent:
              "display",
          })

        renderTaskRef.current =
          renderTask

        await renderTask.promise

        if (cancelled) {
          return
        }

        renderTaskRef.current =
          null

        requestAnimationFrame(
          () => {
            if (!cancelled) {
              centerCanvas()
            }
          }
        )
      } catch (err) {
        if (
          err?.name ===
          "RenderingCancelledException"
        ) {
          return
        }

        console.error(
          "PDF PAGE RENDER ERROR:",
          err
        )

        if (!cancelled) {
          setError(
            err?.message ||
              "Unable to display this newspaper page."
          )
        }
      }
    }

    renderPage()

    return () => {
      cancelled = true

      if (
        renderTaskRef.current
      ) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          // Ignore.
        }

        renderTaskRef.current =
          null
      }
    }
  }, [
    pdfDocument,
    currentPage,
    zoom,
    totalPages,
    containerSize.width,
    containerSize.height,
  ])

  // ========================================================
  // PAGE NAVIGATION
  // ========================================================

  function previousPage() {
    setCurrentPage(
      (page) =>
        Math.max(
          1,
          page - 1
        )
    )
  }

  function nextPage() {
    setCurrentPage(
      (page) =>
        Math.min(
          totalPages,
          page + 1
        )
    )
  }

  // ========================================================
  // KEYBOARD NAVIGATION
  // ========================================================

  useEffect(() => {
    function handleKeyDown(
      event
    ) {
      if (cropOpen) {
        return
      }

      if (
        event.key ===
        "ArrowLeft"
      ) {
        previousPage()
      }

      if (
        event.key ===
        "ArrowRight"
      ) {
        nextPage()
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    )

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      )
    }
  }, [
    cropOpen,
    totalPages,
  ])

  // ========================================================
  // TOUCH PINCH ZOOM
  // ========================================================

  const touchStartDistanceRef =
    useRef(null)

  const touchStartZoomRef =
    useRef(1)

  function getTouchDistance(
    touch1,
    touch2
  ) {
    const dx =
      touch1.clientX -
      touch2.clientX

    const dy =
      touch1.clientY -
      touch2.clientY

    return Math.sqrt(
      dx * dx +
        dy * dy
    )
  }

  function handleTouchStart(
    event
  ) {
    if (
      event.touches.length !==
      2
    ) {
      return
    }

    const distance =
      getTouchDistance(
        event.touches[0],
        event.touches[1]
      )

    touchStartDistanceRef.current =
      distance

    touchStartZoomRef.current =
      zoom
  }

  function handleTouchMove(
    event
  ) {
    if (
      event.touches.length !==
      2
    ) {
      return
    }

    const startDistance =
      touchStartDistanceRef.current

    if (!startDistance) {
      return
    }

    const currentDistance =
      getTouchDistance(
        event.touches[0],
        event.touches[1]
      )

    if (!currentDistance) {
      return
    }

    const ratio =
      currentDistance /
      startDistance

    const newZoom =
      touchStartZoomRef.current *
      ratio

    const clampedZoom =
      Math.min(
        MAX_ZOOM,
        Math.max(
          MIN_ZOOM,
          newZoom
        )
      )

    setZoom(
      clampedZoom
    )

    event.preventDefault()
  }

  function handleTouchEnd() {
    touchStartDistanceRef.current =
      null
  }

  // ========================================================
  // CROP
  // ========================================================

  function openCropEditor() {
    if (!pdfDocument) {
      return
    }

    setCropOpen(
      true
    )
  }

  function closeCropEditor() {
    setCropOpen(
      false
    )
  }

  // ========================================================
  // RESET VIEW
  // ========================================================

  function resetView() {
    setZoom(1)

    setCurrentPage(1)

    requestAnimationFrame(
      () => {
        centerCanvas()
      }
    )
  }

  // ========================================================
  // DOWNLOAD NEWSPAPER
  // ========================================================

  function downloadNewspaper() {
    const pdfUrl =
      getPdfUrl(edition)

    if (!pdfUrl) {
      return
    }

    const editionDate =
      edition?.date ||
      "newspaper"

    const fileName =
      `${editionDate}-shubhodayam-bharath.pdf`

    const link =
      document.createElement(
        "a"
      )

    link.href =
      pdfUrl

    link.download =
      fileName

    link.target =
      "_blank"

    link.rel =
      "noopener noreferrer"

    document.body.appendChild(
      link
    )

    link.click()

    document.body.removeChild(
      link
    )
  }

  // ========================================================
  // SHARE NEWSPAPER
  // ========================================================

  async function shareNewspaper() {
    if (!edition) {
      return
    }

    const editionDate =
      edition?.date ||
      ""

    if (!editionDate) {
      return
    }

    // IMPORTANT:
    // Share the Vercel server-side preview URL,
    // NOT the direct PDF URL.
    //
    // WhatsApp/Facebook can read the Open Graph
    // thumbnail from /api/share before React loads.

    const shareUrl =
      `https://shubhodayam-bharath.vercel.app/share/${editionDate}`

    const title =
      `Shubhodayam Bharath – Newspaper Edition ${editionDate}`

    const text =
      "Shubhodayam Bharath – Daily Telugu & English Newspaper"

    try {
      setSharing(true)
      setShareMessage("")

      // ----------------------------------------------------
      // Native mobile share
      // ----------------------------------------------------

      if (
        navigator.share
      ) {
        await navigator.share({
          title,
          text,
          url: shareUrl,
        })

        return
      }

      // ----------------------------------------------------
      // Clipboard fallback
      // ----------------------------------------------------

      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText ===
          "function"
      ) {
        await navigator.clipboard.writeText(
          shareUrl
        )

        setShareMessage(
          "Newspaper link copied."
        )

        setTimeout(() => {
          setShareMessage("")
        }, 2500)

        return
      }

      // ----------------------------------------------------
      // Older browser fallback
      // ----------------------------------------------------

      window.prompt(
        "Copy newspaper link:",
        shareUrl
      )
    } catch (err) {
      // User cancelling native share is not an error

      if (
        err?.name ===
        "AbortError"
      ) {
        return
      }

      console.error(
        "SHARE ERROR:",
        err
      )

      // Try clipboard if native sharing fails

      try {
        if (
          navigator.clipboard &&
          typeof navigator.clipboard.writeText ===
            "function"
        ) {
          await navigator.clipboard.writeText(
            shareUrl
          )

          setShareMessage(
            "Newspaper link copied."
          )

          setTimeout(() => {
            setShareMessage("")
          }, 2500)
        } else {
          setShareMessage(
            "Unable to share the newspaper."
          )
        }
      } catch {
        setShareMessage(
          "Unable to share the newspaper."
        )
      }
    } finally {
      setSharing(false)
    }
  }

  // ========================================================
  // LOADING
  // ========================================================

  if (loading) {
    return (
      <section className="newspaper-viewer">
        <div className="newspaper-viewer-loading">
          <div className="newspaper-spinner"></div>

          <h3>
            Loading newspaper...
          </h3>

          <p>
            Shubhodayam Bharath
          </p>
        </div>
      </section>
    )
  }

  // ========================================================
  // ERROR
  // ========================================================

  if (error) {
    return (
      <section className="newspaper-viewer">
        <div className="newspaper-viewer-error">
          <div className="newspaper-error-icon">
            !
          </div>

          <h3>
            Unable to load newspaper
          </h3>

          <p>
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="newspaper-retry-button"
          >
            Try Again
          </button>
        </div>
      </section>
    )
  }

  // ========================================================
  // CROP EDITOR
  // ========================================================

  if (cropOpen) {
    return (
      <CropEditor
        pdfDocument={
          pdfDocument
        }
        pdf={
          pdfDocument
        }
        edition={
          edition
        }
        pageNumber={
          currentPage
        }
        onClose={
          closeCropEditor
        }
      />
    )
  }

  // ========================================================
  // MAIN VIEWER
  // ========================================================

  return (
    <section
      className="newspaper-viewer"
      style={{
        paddingBottom:
          "max(16px, env(safe-area-inset-bottom))",
      }}
    >
      {/* ====================================================
          TOP TOOLBAR
      ==================================================== */}

      <div className="newspaper-toolbar">

        {/* ZOOM OUT */}

        <button
          type="button"
          onClick={() =>
            setZoom(
              (value) =>
                Math.max(
                  MIN_ZOOM,
                  Number(
                    (
                      value - 0.1
                    ).toFixed(2)
                  )
                )
            )
          }
          disabled={
            zoom <= MIN_ZOOM
          }
          className="viewer-nav-button"
          aria-label="Zoom out"
        >
          −
        </button>

        {/* PAGE */}

        <div className="viewer-page-info">
          <span>
            Page{" "}
            {currentPage}
          </span>

          <span className="viewer-page-separator">
            /
          </span>

          <span>
            {totalPages}
          </span>
        </div>

        {/* ZOOM IN */}

        <button
          type="button"
          onClick={() =>
            setZoom(
              (value) =>
                Math.min(
                  MAX_ZOOM,
                  Number(
                    (
                      value + 0.1
                    ).toFixed(2)
                  )
                )
            )
          }
          disabled={
            zoom >= MAX_ZOOM
          }
          className="viewer-nav-button"
          aria-label="Zoom in"
        >
          +
        </button>

        {/* RESET */}

        <button
          type="button"
          onClick={
            resetView
          }
          className="viewer-reset-button"
        >
          Reset
        </button>
      </div>

      {/* ====================================================
          NEWSPAPER AREA
      ==================================================== */}

      <div
        ref={
          containerRef
        }
        className="newspaper-pdf-container"
        onTouchStart={
          handleTouchStart
        }
        onTouchMove={
          handleTouchMove
        }
        onTouchEnd={
          handleTouchEnd
        }
        onTouchCancel={
          handleTouchEnd
        }
        style={{
          position:
            "relative",
        }}
      >
        {/* --------------------------------------------------
            PDF
        -------------------------------------------------- */}

        <canvas
          ref={
            canvasRef
          }
          className="newspaper-pdf-canvas"
        />

        {/* ==================================================
            PREVIOUS BUTTON ON PAPER
        ================================================== */}

        <button
          type="button"
          onClick={
            previousPage
          }
          disabled={
            currentPage <= 1
          }
          aria-label="Previous newspaper page"
          className="newspaper-paper-nav newspaper-paper-nav-prev"
        >
          <span className="paper-nav-arrow">
            ←
          </span>

          <span className="paper-nav-text">
            Previous
          </span>
        </button>

        {/* ==================================================
            NEXT BUTTON ON PAPER
        ================================================== */}

        <button
          type="button"
          onClick={
            nextPage
          }
          disabled={
            currentPage >=
            totalPages
          }
          aria-label="Next newspaper page"
          className="newspaper-paper-nav newspaper-paper-nav-next"
        >
          <span className="paper-nav-text">
            Next
          </span>

          <span className="paper-nav-arrow">
            →
          </span>
        </button>
      </div>

      {/* ====================================================
          SHARE MESSAGE
      ==================================================== */}

      {shareMessage && (
        <div
          className="newspaper-share-message"
        >
          {shareMessage}
        </div>
      )}

      {/* ====================================================
          ACTION BUTTONS
      ==================================================== */}

      <div className="newspaper-action-bar">

        {/* DOWNLOAD */}

        <button
          type="button"
          onClick={
            downloadNewspaper
          }
          disabled={
            !pdfDocument
          }
          className="newspaper-action-button"
          aria-label="Download newspaper"
        >
          <span className="newspaper-action-icon">
            ↓
          </span>

          <span>
            Download
          </span>
        </button>

        {/* SHARE */}

        <button
          type="button"
          onClick={
            shareNewspaper
          }
          disabled={
            !pdfDocument ||
            sharing
          }
          className="newspaper-action-button"
          aria-label="Share newspaper"
        >
          <span className="newspaper-action-icon">
            ↗
          </span>

          <span>
            {sharing
              ? "Sharing..."
              : "Share"}
          </span>
        </button>

        {/* CROP */}

        <button
          type="button"
          onClick={
            openCropEditor
          }
          disabled={
            !pdfDocument
          }
          className="newspaper-action-button"
          aria-label="Crop newspaper"
        >
          <span className="newspaper-action-icon">
            ⛶
          </span>

          <span>
            Crop
          </span>
        </button>
      </div>

      {/* ====================================================
          PAGE INDICATOR
      ==================================================== */}

      <div className="newspaper-page-indicator">
        Page{" "}
        {currentPage}{" "}
        of{" "}
        {totalPages}
      </div>
    </section>
  )
}

export default NewspaperViewer