import { useCallback, useEffect, useRef, useState } from "react"
import * as pdfjsLib from "pdfjs-dist"
import { supabase } from "../../lib/supabase"
import CropEditor from "./CropEditor"
import "./NewspaperViewer.css"

const PDFJS_VERSION = "6.2.108"

const PDFJS_WASM_URL =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/wasm/`

const MIN_ZOOM = 1
const MAX_ZOOM = 4

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

function NewspaperViewer({ edition }) {
  const canvasRef = useRef(null)
  const pdfRef = useRef(null)
  const loadingTaskRef = useRef(null)
  const renderTaskRef = useRef(null)

  const pageContainerRef = useRef(null)
  const pageSurfaceRef = useRef(null)

  const renderedSizeRef = useRef({
    width: 0,
    height: 0,
  })

  const baseDisplaySizeRef = useRef({
    width: 0,
    height: 0,
  })

  /*
   * iPhone / Android touch state
   */
  const touchStateRef = useRef({
    pinchActive: false,
    startDistance: 0,
    startZoom: 1,
    startCenterX: 0,
    startCenterY: 0,
  })

  const panStateRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
  })

  const [pdfUrl, setPdfUrl] = useState("")
  const [pdf, setPdf] = useState(null)

  const [showCrop, setShowCrop] = useState(false)

  const [pageNumber, setPageNumber] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  const [pdfLoading, setPdfLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [pdfError, setPdfError] = useState("")

  const [zoom, setZoom] = useState(1)

  const [downloadPreparing, setDownloadPreparing] =
    useState(false)

  const [downloadProgress, setDownloadProgress] =
    useState(0)

  /*
   * ---------------------------------------------------------
   * LANGUAGE
   * ---------------------------------------------------------
   */

  const [language, setLanguage] = useState(() => {
    return (
      localStorage.getItem("shubhodayam-language") ||
      "english"
    )
  })

  useEffect(() => {
    const handleLanguageChange = () => {
      setLanguage(
        localStorage.getItem("shubhodayam-language") ||
          "english"
      )
    }

    window.addEventListener(
      "shubhodayam-language-change",
      handleLanguageChange
    )

    return () => {
      window.removeEventListener(
        "shubhodayam-language-change",
        handleLanguageChange
      )
    }
  }, [])

  /*
   * ---------------------------------------------------------
   * GET PDF URL
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!edition) {
      setPdfUrl("")
      return
    }

    if (edition.pdf_url) {
      setPdfUrl(edition.pdf_url)
      return
    }

    if (edition.pdf_path) {
      const { data } = supabase.storage
        .from("newspapers")
        .getPublicUrl(edition.pdf_path)

      setPdfUrl(data?.publicUrl || "")
      return
    }

    setPdfUrl("")
  }, [edition])

  /*
   * ---------------------------------------------------------
   * LOAD PDF
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!pdfUrl) {
      setPdf(null)
      setPdfLoading(false)
      return
    }

    let cancelled = false

    async function loadPdf() {
      try {
        setPdfLoading(true)
        setPdfError("")
        setPdf(null)

        setPageNumber(1)
        setTotalPages(0)
        setZoom(1)

        if (loadingTaskRef.current) {
          try {
            await loadingTaskRef.current.destroy()
          } catch {
            // ignore
          }

          loadingTaskRef.current = null
        }

        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,

          wasmUrl: PDFJS_WASM_URL,

          useWasm: true,

          isImageDecoderSupported: false,

          disableRange: false,
          disableStream: false,
          disableAutoFetch: false,

          rangeChunkSize: 1024 * 1024,

          withCredentials: false,

          useWorkerFetch: true,
          useSystemFonts: true,

          disableFontFace: false,

          stopAtErrors: false,

          canvasMaxAreaInBytes:
            32 * 1024 * 1024,
        })

        loadingTaskRef.current = loadingTask

        const loadedPdf =
          await loadingTask.promise

        if (cancelled) {
          return
        }

        pdfRef.current = loadedPdf

        setPdf(loadedPdf)
        setTotalPages(loadedPdf.numPages)
        setPageNumber(1)
        setPdfLoading(false)
      } catch (error) {
        if (cancelled) {
          return
        }

        console.error(
          "PDF LOAD ERROR:",
          error
        )

        setPdfError(
          "Unable to load the newspaper PDF. Please try again."
        )

        setPdfLoading(false)
      }
    }

    loadPdf()

    return () => {
      cancelled = true

      if (loadingTaskRef.current) {
        try {
          loadingTaskRef.current.destroy()
        } catch {
          // ignore
        }

        loadingTaskRef.current = null
      }

      pdfRef.current = null
    }
  }, [pdfUrl])

  /*
   * ---------------------------------------------------------
   * APPLY DISPLAY SIZE
   * ---------------------------------------------------------
   */

  const applyDisplaySize = useCallback(
    (nextZoom) => {
      const canvas = canvasRef.current
      const surface = pageSurfaceRef.current

      const base =
        baseDisplaySizeRef.current

      if (
        !canvas ||
        !surface ||
        !base.width ||
        !base.height
      ) {
        return
      }

      const width =
        base.width * nextZoom

      const height =
        base.height * nextZoom

      canvas.style.width =
        `${width}px`

      canvas.style.height =
        `${height}px`

      canvas.style.maxWidth = "none"
      canvas.style.display = "block"

      surface.style.width =
        `${width}px`

      surface.style.height =
        `${height}px`

      surface.style.minWidth =
        `${width}px`

      surface.style.minHeight =
        `${height}px`
    },
    []
  )

  /*
   * ---------------------------------------------------------
   * FIT PAGE
   * ---------------------------------------------------------
   */

  const fitPageToFrame = useCallback(() => {
    const canvas = canvasRef.current
    const container =
      pageContainerRef.current

    const rendered =
      renderedSizeRef.current

    if (
      !canvas ||
      !container ||
      !rendered.width ||
      !rendered.height
    ) {
      return
    }

    const availableWidth =
      Math.max(
        100,
        container.clientWidth - 24
      )

    const displayWidth =
      Math.min(
        rendered.width,
        availableWidth
      )

    const ratio =
      displayWidth /
      rendered.width

    const displayHeight =
      rendered.height * ratio

    baseDisplaySizeRef.current = {
      width: displayWidth,
      height: displayHeight,
    }

    setZoom(1)

    applyDisplaySize(1)

    container.scrollLeft = 0
    container.scrollTop = 0
  }, [applyDisplaySize])

  /*
   * ---------------------------------------------------------
   * RENDER PAGE
   * ---------------------------------------------------------
   */

  const renderPage = useCallback(
    async (pageNum) => {
      if (
        !pdfRef.current ||
        !canvasRef.current
      ) {
        return
      }

      try {
        setRendering(true)
        setPdfError("")

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel()
          } catch {
            // ignore
          }

          renderTaskRef.current = null
        }

        const page =
          await pdfRef.current.getPage(
            pageNum
          )

        const renderScale = 1.35

        let viewport =
          page.getViewport({
            scale: renderScale,
          })

        const MAX_RENDER_WIDTH = 2600
        const MAX_RENDER_HEIGHT = 3600

        let finalScale =
          renderScale

        if (
          viewport.width >
            MAX_RENDER_WIDTH ||
          viewport.height >
            MAX_RENDER_HEIGHT
        ) {
          const widthScale =
            MAX_RENDER_WIDTH /
            viewport.width

          const heightScale =
            MAX_RENDER_HEIGHT /
            viewport.height

          finalScale =
            Math.min(
              widthScale,
              heightScale
            )

          viewport =
            page.getViewport({
              scale: finalScale,
            })
        }

        const canvas =
          canvasRef.current

        const context =
          canvas.getContext(
            "2d",
            {
              alpha: false,
            }
          )

        canvas.width =
          Math.floor(viewport.width)

        canvas.height =
          Math.floor(viewport.height)

        canvas.style.maxWidth =
          "none"

        const renderTask =
          page.render({
            canvasContext: context,
            viewport,
          })

        renderTaskRef.current =
          renderTask

        await renderTask.promise

        renderTaskRef.current = null

        renderedSizeRef.current = {
          width: canvas.width,
          height: canvas.height,
        }

        requestAnimationFrame(() => {
          fitPageToFrame()
        })

        setRendering(false)
      } catch (error) {
        if (
          error?.name ===
          "RenderingCancelledException"
        ) {
          return
        }

        console.error(
          "PDF RENDER ERROR:",
          error
        )

        setPdfError(
          "Unable to display this newspaper page."
        )

        setRendering(false)
      }
    },
    [fitPageToFrame]
  )

  /*
   * ---------------------------------------------------------
   * RENDER PAGE WHEN NUMBER CHANGES
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!pdf || !pageNumber) {
      return
    }

    renderPage(pageNumber)
  }, [
    pdf,
    pageNumber,
    renderPage,
  ])

  /*
   * ---------------------------------------------------------
   * SCREEN ROTATION / RESIZE
   * ---------------------------------------------------------
   */

  useEffect(() => {
    let timer = null

    const handleResize = () => {
      clearTimeout(timer)

      timer = setTimeout(() => {
        if (zoom === 1) {
          fitPageToFrame()
        }
      }, 100)
    }

    window.addEventListener(
      "resize",
      handleResize
    )

    return () => {
      clearTimeout(timer)

      window.removeEventListener(
        "resize",
        handleResize
      )
    }
  }, [
    fitPageToFrame,
    zoom,
  ])

  /*
   * ---------------------------------------------------------
   * ZOOM
   * ---------------------------------------------------------
   */

  const applyZoom = useCallback(
    (value) => {
      const nextZoom =
        Math.min(
          MAX_ZOOM,
          Math.max(
            MIN_ZOOM,
            value
          )
        )

      setZoom(nextZoom)

      applyDisplaySize(nextZoom)

      /*
       * When returning to 1x,
       * put page back at the beginning.
       */
      if (nextZoom <= 1) {
        const container =
          pageContainerRef.current

        if (container) {
          container.scrollLeft = 0
          container.scrollTop = 0
        }
      }
    },
    [applyDisplaySize]
  )

  /*
   * ---------------------------------------------------------
   * DISTANCE BETWEEN TWO TOUCHES
   * ---------------------------------------------------------
   */

  const getTouchDistance = useCallback(
    (touch1, touch2) => {
      const dx =
        touch1.clientX -
        touch2.clientX

      const dy =
        touch1.clientY -
        touch2.clientY

      return Math.sqrt(
        dx * dx + dy * dy
      )
    },
    []
  )

  /*
   * ---------------------------------------------------------
   * TOUCH START
   *
   * iPhone uses native Touch Events here.
   * ---------------------------------------------------------
   */

  const handleTouchStart =
    useCallback(
      (event) => {
        const touches =
          event.touches

        const container =
          pageContainerRef.current

        if (!container) {
          return
        }

        /*
         * TWO FINGERS
         */
        if (touches.length === 2) {
          const distance =
            getTouchDistance(
              touches[0],
              touches[1]
            )

          touchStateRef.current = {
            pinchActive: true,
            startDistance: distance,
            startZoom: zoom,
            startCenterX:
              (touches[0].clientX +
                touches[1].clientX) /
              2,
            startCenterY:
              (touches[0].clientY +
                touches[1].clientY) /
              2,
          }

          panStateRef.current.active =
            false

          /*
           * Prevent iPhone Safari's
           * native page gesture.
           */
          event.preventDefault()

          return
        }

        /*
         * ONE FINGER WHILE ZOOMED
         */
        if (
          touches.length === 1 &&
          zoom > 1
        ) {
          panStateRef.current = {
            active: true,
            startX:
              touches[0].clientX,
            startY:
              touches[0].clientY,
            startScrollLeft:
              container.scrollLeft,
            startScrollTop:
              container.scrollTop,
          }

          event.preventDefault()
        }
      },
      [
        getTouchDistance,
        zoom,
      ]
    )

  /*
   * ---------------------------------------------------------
   * TOUCH MOVE
   * ---------------------------------------------------------
   */

  const handleTouchMove =
    useCallback(
      (event) => {
        const touches =
          event.touches

        const container =
          pageContainerRef.current

        if (!container) {
          return
        }

        /*
         * TWO FINGER PINCH
         */
        if (
          touches.length === 2 &&
          touchStateRef.current
            .pinchActive
        ) {
          const distance =
            getTouchDistance(
              touches[0],
              touches[1]
            )

          const startDistance =
            touchStateRef.current
              .startDistance

          if (!startDistance) {
            return
          }

          const scale =
            distance /
            startDistance

          const nextZoom =
            touchStateRef.current
              .startZoom *
            scale

          applyZoom(nextZoom)

          /*
           * This is critical on iPhone.
           * It prevents Safari from treating
           * the gesture as browser zoom.
           */
          event.preventDefault()

          return
        }

        /*
         * ONE FINGER PAN WHEN ZOOMED
         */
        if (
          touches.length === 1 &&
          zoom > 1 &&
          panStateRef.current.active
        ) {
          const state =
            panStateRef.current

          const deltaX =
            touches[0].clientX -
            state.startX

          const deltaY =
            touches[0].clientY -
            state.startY

          container.scrollLeft =
            state.startScrollLeft -
            deltaX

          container.scrollTop =
            state.startScrollTop -
            deltaY

          event.preventDefault()
        }
      },
      [
        applyZoom,
        getTouchDistance,
        zoom,
      ]
    )

  /*
   * ---------------------------------------------------------
   * TOUCH END
   * ---------------------------------------------------------
   */

  const handleTouchEnd =
    useCallback(
      (event) => {
        if (
          event.touches.length < 2
        ) {
          touchStateRef.current.pinchActive =
            false
        }

        if (
          event.touches.length === 0
        ) {
          panStateRef.current.active =
            false
        }
      },
      []
    )

  /*
   * ---------------------------------------------------------
   * DESKTOP CTRL + WHEEL ZOOM
   * ---------------------------------------------------------
   */

  const handleWheel =
    useCallback(
      (event) => {
        if (!event.ctrlKey) {
          return
        }

        event.preventDefault()

        const direction =
          event.deltaY < 0
            ? 1
            : -1

        const amount =
          direction > 0
            ? 0.15
            : -0.15

        applyZoom(
          zoom + amount
        )
      },
      [applyZoom, zoom]
    )

  /*
   * ---------------------------------------------------------
   * PREVIOUS PAGE
   * ---------------------------------------------------------
   */

  const goPreviousPage =
    useCallback(() => {
      if (pageNumber <= 1) {
        return
      }

      setPageNumber(
        (current) =>
          current - 1
      )
    }, [pageNumber])

  /*
   * ---------------------------------------------------------
   * NEXT PAGE
   * ---------------------------------------------------------
   */

  const goNextPage =
    useCallback(() => {
      if (
        pageNumber >= totalPages
      ) {
        return
      }

      setPageNumber(
        (current) =>
          current + 1
      )
    }, [
      pageNumber,
      totalPages,
    ])

  /*
   * ---------------------------------------------------------
   * DOWNLOAD
   * ---------------------------------------------------------
   */

  const handleDownload =
    async () => {
      if (
        !pdfUrl ||
        downloadPreparing
      ) {
        return
      }

      try {
        setDownloadPreparing(true)
        setDownloadProgress(0)

        const response =
          await fetch(pdfUrl)

        if (!response.ok) {
          throw new Error(
            `Download failed: ${response.status}`
          )
        }

        const contentLength =
          response.headers.get(
            "content-length"
          )

        const total =
          contentLength
            ? Number(contentLength)
            : 0

        if (!response.body) {
          const blob =
            await response.blob()

          const blobUrl =
            URL.createObjectURL(
              blob
            )

          const link =
            document.createElement(
              "a"
            )

          link.href = blobUrl

          link.download =
            `${edition?.date || "newspaper"}.pdf`

          document.body.appendChild(
            link
          )

          link.click()
          link.remove()

          URL.revokeObjectURL(
            blobUrl
          )

          setDownloadProgress(100)

          return
        }

        const reader =
          response.body.getReader()

        const chunks = []

        let received = 0

        while (true) {
          const { done, value } =
            await reader.read()

          if (done) {
            break
          }

          chunks.push(value)

          received += value.length

          if (total > 0) {
            setDownloadProgress(
              Math.round(
                (received /
                  total) *
                  100
              )
            )
          }
        }

        const blob =
          new Blob(chunks, {
            type: "application/pdf",
          })

        const blobUrl =
          URL.createObjectURL(
            blob
          )

        const link =
          document.createElement(
            "a"
          )

        link.href = blobUrl

        link.download =
          `${edition?.date || "newspaper"}.pdf`

        document.body.appendChild(
          link
        )

        link.click()

        link.remove()

        URL.revokeObjectURL(
          blobUrl
        )

        setDownloadProgress(100)
      } catch (error) {
        console.error(
          "PDF DOWNLOAD ERROR:",
          error
        )

        try {
          window.open(
            pdfUrl,
            "_blank",
            "noopener,noreferrer"
          )
        } catch {
          // ignore
        }
      } finally {
        setTimeout(() => {
          setDownloadPreparing(false)
          setDownloadProgress(0)
        }, 500)
      }
    }

  /*
   * ---------------------------------------------------------
   * SHARE
   * ---------------------------------------------------------
   */

  const handleShare =
    async () => {
      if (!pdfUrl) {
        return
      }

      const shareTitle =
        edition?.title ||
        "Shubhodayam Bharath"

      const shareText =
        language === "telugu"
          ? "శుభోదయం భారత్ - ఈరోజు వార్తాపత్రిక"
          : "Shubhodayam Bharath - Daily Newspaper"

      try {
        if (
          typeof navigator !==
            "undefined" &&
          typeof navigator.share ===
            "function"
        ) {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: pdfUrl,
          })

          return
        }

        window.open(
          pdfUrl,
          "_blank",
          "noopener,noreferrer"
        )
      } catch (error) {
        if (
          error?.name ===
          "AbortError"
        ) {
          return
        }

        console.error(
          "SHARE ERROR:",
          error
        )

        window.open(
          pdfUrl,
          "_blank",
          "noopener,noreferrer"
        )
      }
    }

  /*
   * ---------------------------------------------------------
   * CROP
   * ---------------------------------------------------------
   */

  if (showCrop) {
    return (
      <CropEditor
        pdfUrl={pdfUrl}
        edition={edition}
        logoUrl="/logo.png"
        onClose={() =>
          setShowCrop(false)
        }
      />
    )
  }

  /*
   * ---------------------------------------------------------
   * NO EDITION
   * ---------------------------------------------------------
   */

  if (!edition) {
    return (
      <div className="newspaper-viewer">
        <div className="viewer-empty">
          <h3>
            {language === "telugu"
              ? "వార్తాపత్రిక అందుబాటులో లేదు"
              : "Newspaper not available"}
          </h3>

          <p>
            {language === "telugu"
              ? "ఈ తేదీకి వార్తాపత్రిక అందుబాటులో లేదు."
              : "No newspaper edition is available for this date."}
          </p>
        </div>
      </div>
    )
  }

  /*
   * ---------------------------------------------------------
   * PDF NOT AVAILABLE
   * ---------------------------------------------------------
   */

  if (!pdfUrl) {
    return (
      <div className="newspaper-viewer">
        <div className="viewer-empty">
          <h3>
            {language === "telugu"
              ? "PDF అందుబాటులో లేదు"
              : "PDF not available"}
          </h3>

          <p>
            {language === "telugu"
              ? "ఈ ఎడిషన్ PDF ఇంకా అప్లోడ్ చేయలేదు."
              : "The PDF for this edition has not been uploaded yet."}
          </p>
        </div>
      </div>
    )
  }

  /*
   * ---------------------------------------------------------
   * MAIN VIEW
   * ---------------------------------------------------------
   */

  return (
    <div className="newspaper-viewer">

      {/* HEADER */}

      <div className="viewer-header">
        <p className="viewer-label">
          {language === "telugu"
            ? "రోజువారీ వార్తాపత్రిక"
            : "Daily Newspaper"}
        </p>

        <h2>
          {edition.title ||
            "SHUBHODAYAM BHARATH"}
        </h2>

        <p className="viewer-date">
          {edition.date}
        </p>
      </div>

      {/* NEWSPAPER */}

      <div className="newspaper-page-wrapper">

        {/* PREVIOUS */}

        <button
          type="button"
          className="newspaper-nav-button newspaper-prev"
          onClick={goPreviousPage}
          disabled={
            pageNumber <= 1 ||
            pdfLoading ||
            rendering
          }
          aria-label="Previous page"
        >
          ‹
        </button>

        {/* PDF CONTAINER */}

        <div
          ref={pageContainerRef}
          className="viewer-pdf-container"
          onWheel={handleWheel}
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
        >
          <div
            ref={pageSurfaceRef}
            className="viewer-page-surface"
          >
            <canvas
              ref={canvasRef}
              className="viewer-pdf-canvas"
            />
          </div>

          {/* LOADING */}

          {pdfLoading && (
            <div className="viewer-loading-overlay">
              <div className="viewer-loading-spinner" />

              <p>
                Loading newspaper...
              </p>
            </div>
          )}

          {/* RENDERING */}

          {!pdfLoading &&
            rendering && (
              <div className="viewer-rendering-indicator">
                Loading page...
              </div>
            )}
        </div>

        {/* NEXT */}

        <button
          type="button"
          className="newspaper-nav-button newspaper-next"
          onClick={goNextPage}
          disabled={
            pageNumber >=
              totalPages ||
            pdfLoading ||
            rendering
          }
          aria-label="Next page"
        >
          ›
        </button>
      </div>

      {/* ERROR */}

      {pdfError && (
        <div className="viewer-error">
          {pdfError}
        </div>
      )}

      {/* PAGE INDICATOR */}

      {!pdfLoading &&
        totalPages > 0 && (
          <div className="viewer-page-indicator">
            Page {pageNumber} /{" "}
            {totalPages}
          </div>
        )}

      {/* ZOOM HINT */}

      <p className="viewer-zoom-hint">
        Pinch with two fingers to zoom
      </p>

      {/* ACTION BUTTONS */}

      <div className="viewer-actions">

        <button
          type="button"
          className="secondary-button"
          onClick={
            handleDownload
          }
          disabled={
            pdfLoading ||
            downloadPreparing
          }
        >
          {downloadPreparing
            ? `Downloading ${downloadProgress}%`
            : "Download PDF"}
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={handleShare}
          disabled={pdfLoading}
        >
          Share
        </button>

        <button
          type="button"
          className="primary-button"
          onClick={() =>
            setShowCrop(true)
          }
          disabled={pdfLoading}
        >
          Crop
        </button>

      </div>
    </div>
  )
}

export default NewspaperViewer