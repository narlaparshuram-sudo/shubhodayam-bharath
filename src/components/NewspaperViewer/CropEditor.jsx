import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import * as pdfjsLib from "pdfjs-dist"

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString()

const PDFJS_VERSION = "6.2.108"

const PDFJS_WASM_URL =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/wasm/`

const LOGO_URL = "/logo.png"

/*
 * =========================================================
 * HIGH QUALITY PDF RENDER
 * =========================================================
 */

const RENDER_SCALE = 2.5

const MAX_RENDER_PIXELS = 24000000
const MAX_RENDER_WIDTH = 5000
const MAX_RENDER_HEIGHT = 9000

const MIN_CROP_SIZE = 20

/*
 * Space around newspaper.
 */

const SIDE_PADDING = 18

export default function CropEditor({
  pdfUrl,
  source: sourceProp,
  pdf,
  pdfDocument,
  url,
  edition,
  isTelugu = false,
  onClose,
}) {
  /*
   * =========================================================
   * PDF SOURCE
   * =========================================================
   */

  const source =
    pdfUrl ||
    sourceProp ||
    url ||
    ""

  /*
   * Reuse PDF already loaded by NewspaperViewer.
   */

  const existingPdfDocument =
    pdfDocument ||
    (
      pdf &&
      typeof pdf === "object" &&
      typeof pdf.getPage === "function"
        ? pdf
        : null
    )

  /*
   * =========================================================
   * REFS
   * =========================================================
   */

  const canvasRef =
    useRef(null)

  const containerRef =
    useRef(null)

  const pdfRef =
    useRef(null)

  const renderTaskRef =
    useRef(null)

  /*
   * TRUE = CropEditor loaded PDF.
   *
   * FALSE = NewspaperViewer owns PDF.
   */

  const ownsPdfRef =
    useRef(false)

  /*
   * =========================================================
   * STATE
   * =========================================================
   */

  const [loading, setLoading] =
    useState(true)

  const [rendering, setRendering] =
    useState(false)

  const [error, setError] =
    useState("")

  const [pageNumber, setPageNumber] =
    useState(1)

  const [numPages, setNumPages] =
    useState(0)

  /*
   * Visual zoom.
   *
   * At 1 the newspaper fits the available screen.
   *
   * Zoom does not re-render the PDF.
   */

  const [zoom, setZoom] =
    useState(1)

  const [selecting, setSelecting] =
    useState(false)

  /*
   * Crop coordinates are stored in
   * REAL high-resolution canvas pixels.
   */

  const [crop, setCrop] =
    useState(null)

  const [dragStart, setDragStart] =
    useState(null)

  const [previewUrl, setPreviewUrl] =
    useState("")

  const [working, setWorking] =
    useState(false)

  const [message, setMessage] =
    useState("")

  /*
   * Actual high-resolution canvas dimensions.
   */

  const [canvasSize, setCanvasSize] =
    useState({
      width: 0,
      height: 0,
    })

  /*
   * Used to trigger recalculation when the
   * mobile container changes size.
   */

  const [displayWidth, setDisplayWidth] =
    useState(0)

  /*
   * =========================================================
   * DATE
   * =========================================================
   */

  const date =
    edition?.date ||
    edition?.Date ||
    new Date()
      .toISOString()
      .slice(0, 10)

  /*
   * =========================================================
   * LANGUAGE TEXT
   * =========================================================
   */

  const text = isTelugu
    ? {
        crop: "క్రాప్",
        select: "ప్రాంతాన్ని ఎంచుకోండి",
        selecting:
          "వార్త చుట్టూ డ్రాగ్ చేయండి",
        cropAgain: "మళ్లీ క్రాప్",
        preview: "ప్రివ్యూ",
        download: "డౌన్‌లోడ్",
        share: "షేర్",
        previous: "మునుపటి",
        next: "తదుపరి",
        close: "మూసివేయి",
        loading:
          "వార్తాపత్రిక లోడ్ అవుతోంది...",
      }
    : {
        crop: "Crop",
        select: "Select Area",
        selecting:
          "Drag around the news",
        cropAgain: "Crop Again",
        preview: "Preview",
        download: "Download",
        share: "Share",
        previous: "Previous",
        next: "Next",
        close: "Close",
        loading:
          "Loading newspaper...",
      }

  /*
   * =========================================================
   * LOAD PDF
   * =========================================================
   */

  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      try {
        setLoading(true)
        setError("")
        setMessage("")

        /*
         * ---------------------------------------------------
         * REUSE ALREADY LOADED PDF
         * ---------------------------------------------------
         */

        if (existingPdfDocument) {
          ownsPdfRef.current = false

          pdfRef.current =
            existingPdfDocument

          setNumPages(
            existingPdfDocument.numPages
          )

          setPageNumber(1)

          setLoading(false)

          return
        }

        /*
         * ---------------------------------------------------
         * FALLBACK PDF LOAD
         * ---------------------------------------------------
         */

        if (!source) {
          setError(
            "PDF source is missing."
          )

          setLoading(false)

          return
        }

        const response =
          await fetch(source, {
            credentials: "omit",
            cache: "no-store",
          })

        if (!response.ok) {
          throw new Error(
            `PDF request failed: ${response.status}`
          )
        }

        const arrayBuffer =
          await response.arrayBuffer()

        if (cancelled) {
          return
        }

        const loadingTask =
          pdfjsLib.getDocument({
            data: new Uint8Array(
              arrayBuffer
            ),

            wasmUrl:
              PDFJS_WASM_URL,

            useWasm: true,

            isImageDecoderSupported:
              false,

            disableRange: true,
            disableStream: true,
            disableAutoFetch: true,

            withCredentials: false,

            useWorkerFetch: true,
            useSystemFonts: true,

            disableFontFace: false,

            stopAtErrors: false,

            canvasMaxAreaInBytes:
              96 * 1024 * 1024,
          })

        const loadedPdf =
          await loadingTask.promise

        if (cancelled) {
          try {
            await loadedPdf.destroy()
          } catch {
            // ignore
          }

          return
        }

        ownsPdfRef.current = true

        pdfRef.current =
          loadedPdf

        setNumPages(
          loadedPdf.numPages
        )

        setPageNumber(1)

        setLoading(false)
      } catch (err) {
        console.error(
          "CROP PDF LOAD ERROR:",
          err
        )

        if (!cancelled) {
          setError(
            "Unable to load the newspaper PDF."
          )

          setLoading(false)
        }
      }
    }

    loadPdf()

    /*
     * -------------------------------------------------------
     * CLEANUP
     * -------------------------------------------------------
     */

    return () => {
      cancelled = true

      if (
        renderTaskRef.current
      ) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          // ignore
        }

        renderTaskRef.current =
          null
      }

      /*
       * Only destroy PDFs loaded by CropEditor.
       */

      if (
        pdfRef.current &&
        ownsPdfRef.current
      ) {
        try {
          pdfRef.current.destroy()
        } catch {
          // ignore
        }
      }

      pdfRef.current =
        null

      ownsPdfRef.current =
        false
    }
  }, [
    source,
    existingPdfDocument,
  ])

  /*
   * =========================================================
   * WATCH MOBILE CONTAINER SIZE
   * =========================================================
   *
   * Important for phones.
   *
   * Mobile browser UI can change the available
   * width/height while the page is open.
   *
   * ResizeObserver detects those changes.
   */

  useEffect(() => {
    const updateDisplaySize =
      () => {
        const container =
          containerRef.current

        if (!container) {
          return
        }

        const availableWidth =
          Math.max(
            100,
            container.clientWidth -
              SIDE_PADDING * 2
          )

        setDisplayWidth(
          availableWidth
        )
      }

    updateDisplaySize()

    window.addEventListener(
      "resize",
      updateDisplaySize
    )

    let resizeObserver = null

    const container =
      containerRef.current

    if (
      container &&
      typeof ResizeObserver !==
        "undefined"
    ) {
      resizeObserver =
        new ResizeObserver(() => {
          updateDisplaySize()
        })

      resizeObserver.observe(
        container
      )
    }

    return () => {
      window.removeEventListener(
        "resize",
        updateDisplaySize
      )

      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [])

  /*
   * =========================================================
   * FIT NEWSPAPER TO SCREEN
   * =========================================================
   *
   * THIS IS THE MOBILE FIX.
   *
   * The newspaper is fitted using BOTH:
   *
   * 1. Available width
   * 2. Available height
   *
   * Whichever requires the smaller scale wins.
   *
   * Therefore the COMPLETE newspaper page fits
   * inside the available mobile area.
   */

  const fitScale =
    canvasSize.width > 0 &&
    canvasSize.height > 0 &&
    displayWidth > 0 &&
    containerRef.current
      ? Math.min(
          1,

          /*
           * WIDTH FIT
           */

          displayWidth /
            canvasSize.width,

          /*
           * HEIGHT FIT
           *
           * Container height is the actual
           * newspaper viewing area between
           * the header and bottom controls.
           */

          Math.max(
            0.1,

            (
              containerRef.current
                .clientHeight -
              SIDE_PADDING * 2
            ) /
              canvasSize.height
          )
        )
      : 1

  /*
   * =========================================================
   * FITTED SIZE
   * =========================================================
   */

  const fittedWidth =
    canvasSize.width *
    fitScale

  const fittedHeight =
    canvasSize.height *
    fitScale

  /*
   * =========================================================
   * ZOOMED DISPLAY SIZE
   * =========================================================
   */

  const displayedWidth =
    fittedWidth *
    zoom

  const displayedHeight =
    fittedHeight *
    zoom

  /*
   * =========================================================
   * RENDER CURRENT PAGE
   * =========================================================
   */

  const renderPage =
    useCallback(
      async () => {
        const pdfDocument =
          pdfRef.current

        const canvas =
          canvasRef.current

        if (
          !pdfDocument ||
          !canvas
        ) {
          return
        }

        try {
          setRendering(true)
          setError("")

          /*
           * Cancel previous render.
           */

          if (
            renderTaskRef.current
          ) {
            try {
              renderTaskRef.current.cancel()
            } catch {
              // ignore
            }

            renderTaskRef.current =
              null
          }

          /*
           * Get current page.
           */

          const page =
            await pdfDocument.getPage(
              pageNumber
            )

          /*
           * Base viewport.
           */

          const baseViewport =
            page.getViewport({
              scale: 1,
            })

          /*
           * =================================================
           * HIGH QUALITY SCALE
           * =================================================
           */

          let scale =
            RENDER_SCALE

          let width =
            baseViewport.width *
            scale

          let height =
            baseViewport.height *
            scale

          let pixels =
            width * height

          /*
           * Pixel limit.
           */

          if (
            pixels >
            MAX_RENDER_PIXELS
          ) {
            const factor =
              Math.sqrt(
                MAX_RENDER_PIXELS /
                  pixels
              )

            scale *= factor

            width =
              baseViewport.width *
              scale

            height =
              baseViewport.height *
              scale
          }

          /*
           * Width limit.
           */

          if (
            width >
            MAX_RENDER_WIDTH
          ) {
            const factor =
              MAX_RENDER_WIDTH /
              width

            scale *= factor

            width =
              baseViewport.width *
              scale

            height =
              baseViewport.height *
              scale
          }

          /*
           * Height limit.
           */

          if (
            height >
            MAX_RENDER_HEIGHT
          ) {
            const factor =
              MAX_RENDER_HEIGHT /
              height

            scale *= factor

            width =
              baseViewport.width *
              scale

            height =
              baseViewport.height *
              scale
          }

          /*
           * Final pixel safety check.
           */

          pixels =
            width * height

          if (
            pixels >
            MAX_RENDER_PIXELS
          ) {
            const factor =
              Math.sqrt(
                MAX_RENDER_PIXELS /
                  pixels
              )

            scale *= factor
          }

          /*
           * Final viewport.
           */

          const viewport =
            page.getViewport({
              scale,
            })

          /*
           * Canvas.
           */

          const context =
            canvas.getContext(
              "2d",
              {
                alpha: false,
              }
            )

          if (!context) {
            throw new Error(
              "Canvas is not supported."
            )
          }

          /*
           * REAL high-resolution pixel size.
           */

          canvas.width =
            Math.floor(
              viewport.width
            )

          canvas.height =
            Math.floor(
              viewport.height
            )

          /*
           * Keep intrinsic CSS size equal
           * to the real canvas size.
           *
           * The parent wrapper will scale
           * it down for mobile.
           */

          canvas.style.width =
            `${Math.floor(
              viewport.width
            )}px`

          canvas.style.height =
            `${Math.floor(
              viewport.height
            )}px`

          setCanvasSize({
            width:
              viewport.width,
            height:
              viewport.height,
          })

          /*
           * White background.
           */

          context.fillStyle =
            "#ffffff"

          context.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
          )

          /*
           * Render.
           */

          const renderTask =
            page.render({
              canvasContext:
                context,
              viewport,
            })

          renderTaskRef.current =
            renderTask

          await renderTask.promise

          if (
            renderTaskRef.current ===
            renderTask
          ) {
            renderTaskRef.current =
              null
          }

          if (page.cleanup) {
            page.cleanup()
          }

          /*
           * Reset selection when page changes.
           */

          setCrop(null)
          setSelecting(false)
          setDragStart(null)
          setZoom(1)

          setRendering(false)
        } catch (err) {
          if (
            err?.name ===
            "RenderingCancelledException"
          ) {
            return
          }

          console.error(
            "CROP PAGE RENDER ERROR:",
            err
          )

          setRendering(false)

          setError(
            "Unable to display this newspaper page."
          )
        }
      },
      [pageNumber]
    )

  /*
   * =========================================================
   * RENDER WHEN PDF READY
   * =========================================================
   */

  useEffect(() => {
    if (
      !loading &&
      pdfRef.current
    ) {
      renderPage()
    }
  }, [
    loading,
    renderPage,
  ])

  /*
   * =========================================================
   * PAGE NAVIGATION
   * =========================================================
   */

  const clearPreview =
    () => {
      if (previewUrl) {
        URL.revokeObjectURL(
          previewUrl
        )

        setPreviewUrl("")
      }
    }

  const resetSelection =
    () => {
      clearPreview()

      setCrop(null)
      setMessage("")
      setSelecting(false)
      setDragStart(null)
    }

  const goPrevious =
    () => {
      if (
        pageNumber <= 1 ||
        working
      ) {
        return
      }

      resetSelection()

      setZoom(1)

      setPageNumber(
        (value) =>
          value - 1
      )

      containerRef.current?.scrollTo(
        {
          top: 0,
          left: 0,
          behavior: "smooth",
        }
      )
    }

  const goNext =
    () => {
      if (
        pageNumber >=
          numPages ||
        working
      ) {
        return
      }

      resetSelection()

      setZoom(1)

      setPageNumber(
        (value) =>
          value + 1
      )

      containerRef.current?.scrollTo(
        {
          top: 0,
          left: 0,
          behavior: "smooth",
        }
      )
    }

  /*
   * =========================================================
   * ZOOM
   * =========================================================
   */

  const zoomIn =
    () => {
      setZoom((value) =>
        Math.min(
          2.5,
          Math.round(
            (value + 0.25) *
              100
          ) / 100
        )
      )
    }

  const zoomOut =
    () => {
      setZoom((value) =>
        Math.max(
          0.6,
          Math.round(
            (value - 0.25) *
              100
          ) / 100
        )
      )
    }

  /*
   * =========================================================
   * GET REAL CANVAS POINT
   * =========================================================
   *
   * Screen position -> high-resolution
   * canvas position.
   */

  const getCanvasPoint =
    (event) => {
      const canvas =
        canvasRef.current

      if (!canvas) {
        return {
          x: 0,
          y: 0,
        }
      }

      const rect =
        canvas.getBoundingClientRect()

      /*
       * IMPORTANT:
       *
       * rect is the ACTUAL displayed size
       * after fitScale + zoom.
       *
       * Therefore this automatically converts
       * the mobile screen coordinates back into
       * the original high-resolution canvas.
       */

      const scaleX =
        canvas.width /
        rect.width

      const scaleY =
        canvas.height /
        rect.height

      let clientX = 0
      let clientY = 0

      if (
        event.touches &&
        event.touches.length >
          0
      ) {
        clientX =
          event.touches[0]
            .clientX

        clientY =
          event.touches[0]
            .clientY
      } else {
        clientX =
          event.clientX

        clientY =
          event.clientY
      }

      const x =
        (clientX -
          rect.left) *
        scaleX

      const y =
        (clientY -
          rect.top) *
        scaleY

      return {
        x: Math.max(
          0,
          Math.min(
            canvas.width,
            x
          )
        ),

        y: Math.max(
          0,
          Math.min(
            canvas.height,
            y
          )
        ),
      }
    }

  /*
   * =========================================================
   * START SELECTING
   * =========================================================
   */

  const startSelecting =
    () => {
      clearPreview()

      setCrop(null)
      setMessage("")
      setSelecting(true)
      setDragStart(null)
    }

  /*
   * =========================================================
   * POINTER DOWN
   * =========================================================
   */

  const handlePointerDown =
    (event) => {
      if (!selecting) {
        return
      }

      event.preventDefault()

      try {
        event.currentTarget.setPointerCapture(
          event.pointerId
        )
      } catch {
        // ignore
      }

      const point =
        getCanvasPoint(event)

      setDragStart(point)

      setCrop({
        x: point.x,
        y: point.y,
        width: 0,
        height: 0,
      })
    }

  /*
   * =========================================================
   * POINTER MOVE
   * =========================================================
   */

  const handlePointerMove =
    (event) => {
      if (
        !selecting ||
        !dragStart
      ) {
        return
      }

      event.preventDefault()

      const point =
        getCanvasPoint(event)

      const x =
        Math.min(
          dragStart.x,
          point.x
        )

      const y =
        Math.min(
          dragStart.y,
          point.y
        )

      const width =
        Math.abs(
          point.x -
            dragStart.x
        )

      const height =
        Math.abs(
          point.y -
            dragStart.y
        )

      setCrop({
        x,
        y,
        width,
        height,
      })
    }

  /*
   * =========================================================
   * FINISH SELECTING
   * =========================================================
   */

  const finishSelecting =
    () => {
      if (
        !selecting ||
        !crop
      ) {
        return
      }

      setSelecting(false)
      setDragStart(null)

      if (
        crop.width <
          MIN_CROP_SIZE ||
        crop.height <
          MIN_CROP_SIZE
      ) {
        setCrop(null)

        setMessage(
          "Please select a larger area."
        )
      }
    }

  /*
   * =========================================================
   * CREATE CROPPED IMAGE
   * =========================================================
   */

  const createCroppedImage =
    useCallback(
      async () => {
        const canvas =
          canvasRef.current

        if (
          !canvas ||
          !crop
        ) {
          throw new Error(
            "Please select an area first."
          )
        }

        if (
          crop.width <
            MIN_CROP_SIZE ||
          crop.height <
            MIN_CROP_SIZE
        ) {
          throw new Error(
            "Selected area is too small."
          )
        }

        /*
         * ---------------------------------------------------
         * LOAD LOGO
         * ---------------------------------------------------
         */

        const logo =
          new Image()

        logo.crossOrigin =
          "anonymous"

        const logoLoaded =
          await new Promise(
            (resolve) => {
              logo.onload = () =>
                resolve(true)

              logo.onerror = () =>
                resolve(false)

              logo.src =
                `${LOGO_URL}?v=1`
            }
          )

        /*
         * ---------------------------------------------------
         * OUTPUT SETTINGS
         * ---------------------------------------------------
         */

        const padding = 30

        const logoHeight =
          logoLoaded
            ? Math.min(
                130,
                Math.max(
                  70,
                  crop.width *
                    0.16
                )
              )
            : 0

        const logoWidth =
          logoLoaded &&
          logo.naturalWidth >
            0 &&
          logo.naturalHeight >
            0
            ? logo.naturalWidth *
              (
                logoHeight /
                logo.naturalHeight
              )
            : 0

        /*
         * ---------------------------------------------------
         * OUTPUT CANVAS
         * ---------------------------------------------------
         */

        const output =
          document.createElement(
            "canvas"
          )

        output.width =
          Math.ceil(
            crop.width +
              padding * 2
          )

        output.height =
          Math.ceil(
            crop.height +
              padding * 2 +
              logoHeight +
              (
                logoLoaded
                  ? 20
                  : 0
              )
          )

        const ctx =
          output.getContext(
            "2d",
            {
              alpha: false,
            }
          )

        if (!ctx) {
          throw new Error(
            "Unable to create image."
          )
        }

        /*
         * White background.
         */

        ctx.fillStyle =
          "#ffffff"

        ctx.fillRect(
          0,
          0,
          output.width,
          output.height
        )

        /*
         * ---------------------------------------------------
         * SHUBHODAYAM BHARATH MASTHEAD
         * ---------------------------------------------------
         */

        if (
          logoLoaded &&
          logoWidth > 0
        ) {
          const logoX =
            (
              output.width -
              logoWidth
            ) / 2

          const logoY =
            padding

          ctx.drawImage(
            logo,
            logoX,
            logoY,
            logoWidth,
            logoHeight
          )
        }

        /*
         * ---------------------------------------------------
         * NEWSPAPER CROP
         * ---------------------------------------------------
         */

        const newspaperY =
          padding +
          logoHeight +
          (
            logoLoaded
              ? 20
              : 0
          )

        /*
         * IMPORTANT:
         *
         * Crop directly from the REAL
         * high-resolution canvas.
         *
         * Screen fitting does not reduce
         * crop quality.
         */

        ctx.drawImage(
          canvas,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          padding,
          newspaperY,
          crop.width,
          crop.height
        )

        /*
         * ---------------------------------------------------
         * PNG
         * ---------------------------------------------------
         */

        return await new Promise(
          (
            resolve,
            reject
          ) => {
            output.toBlob(
              (blob) => {
                if (blob) {
                  resolve(blob)
                } else {
                  reject(
                    new Error(
                      "Unable to create PNG."
                    )
                  )
                }
              },
              "image/png"
            )
          }
        )
      },
      [crop]
    )

  /*
   * =========================================================
   * PREVIEW
   * =========================================================
   */

  const handlePreview =
    async () => {
      try {
        setWorking(true)
        setMessage("")

        const blob =
          await createCroppedImage()

        const objectUrl =
          URL.createObjectURL(
            blob
          )

        setPreviewUrl(
          (oldUrl) => {
            if (oldUrl) {
              URL.revokeObjectURL(
                oldUrl
              )
            }

            return objectUrl
          }
        )

        setWorking(false)
      } catch (err) {
        console.error(
          "PREVIEW ERROR:",
          err
        )

        setWorking(false)

        setMessage(
          err?.message ||
            "Unable to create preview."
        )
      }
    }

  /*
   * =========================================================
   * DOWNLOAD
   * =========================================================
   */

  const handleDownload =
    async () => {
      try {
        setWorking(true)
        setMessage("")

        const blob =
          await createCroppedImage()

        const fileName =
          `${date}-shubhodayam-bharath-crop.png`

        const blobUrl =
          URL.createObjectURL(
            blob
          )

        /*
         * iOS detection.
         */

        const isIOS =
          /iPad|iPhone|iPod/.test(
            navigator.userAgent
          ) ||
          (
            navigator.platform ===
              "MacIntel" &&
            navigator.maxTouchPoints >
              1
          )

        /*
         * iPhone / iPad.
         */

        if (isIOS) {
          const opened =
            window.open(
              blobUrl,
              "_blank"
            )

          if (!opened) {
            window.location.href =
              blobUrl
          }

          setMessage(
            "Image opened. On iPhone, tap Share → Save Image."
          )

          setWorking(false)

          setTimeout(() => {
            URL.revokeObjectURL(
              blobUrl
            )
          }, 60000)

          return
        }

        /*
         * Android / desktop.
         */

        const link =
          document.createElement(
            "a"
          )

        link.href =
          blobUrl

        link.download =
          fileName

        link.rel =
          "noopener"

        link.style.display =
          "none"

        document.body.appendChild(
          link
        )

        link.click()

        document.body.removeChild(
          link
        )

        setMessage(
          "Image downloaded successfully."
        )

        setWorking(false)

        setTimeout(() => {
          URL.revokeObjectURL(
            blobUrl
          )
        }, 10000)
      } catch (err) {
        console.error(
          "DOWNLOAD ERROR:",
          err
        )

        setWorking(false)

        setMessage(
          err?.message ||
            "Download could not start."
        )
      }
    }

  /*
   * =========================================================
   * SHARE
   * =========================================================
   *
   * YOUR WORKING NATIVE IMAGE SHARE.
   *
   * DO NOT CHANGE TO URL SHARE.
   */

  const handleShare =
    async () => {
      try {
        if (working) {
          return
        }

        setWorking(true)
        setMessage("")

        const blob =
          await createCroppedImage()

        const fileName =
          `${date}-shubhodayam-bharath-crop.png`

        const file =
          new File(
            [blob],
            fileName,
            {
              type: "image/png",
            }
          )

        /*
         * Browser does not support Web Share.
         */

        if (
          typeof navigator.share !==
          "function"
        ) {
          setWorking(false)

          setMessage(
            "Image sharing is not supported in this browser. Please open the website in Chrome on Android or Safari on iPhone."
          )

          return
        }

        /*
         * Check file-sharing capability.
         */

        if (
          typeof navigator.canShare ===
          "function"
        ) {
          let canShareFiles =
            false

          try {
            canShareFiles =
              navigator.canShare({
                files: [file],
              })
          } catch (
            canShareError
          ) {
            console.warn(
              "CAN SHARE CHECK ERROR:",
              canShareError
            )
          }

          if (!canShareFiles) {
            setWorking(false)

            setMessage(
              "This browser cannot share the cropped image. Please open the website directly in Chrome on Android or Safari on iPhone."
            )

            return
          }
        }

        /*
         * Native share sheet.
         */

        await navigator.share({
          title:
            "Shubhodayam Bharath",

          text:
            "Shubhodayam Bharath Newspaper",

          files: [file],
        })

        setWorking(false)

        setMessage(
          "Share completed."
        )
      } catch (err) {
        console.error(
          "NATIVE SHARE ERROR:",
          err
        )

        setWorking(false)

        /*
         * User cancelled share.
         */

        if (
          err?.name ===
          "AbortError"
        ) {
          setMessage("")
          return
        }

        setMessage(
          "Unable to open the device share menu. Please open the website directly in Chrome on Android or Safari on iPhone."
        )
      }
    }

  /*
   * =========================================================
   * CROP AGAIN
   * =========================================================
   *
   * NO PDF DOWNLOAD.
   * NO PDF RELOAD.
   * NO getDocument().
   *
   * Uses the same high-resolution canvas.
   */

  const handleCropAgain =
    () => {
      if (working) {
        return
      }

      clearPreview()

      setCrop(null)
      setMessage("")
      setSelecting(true)
      setDragStart(null)
    }

  /*
   * =========================================================
   * PREVIEW URL CLEANUP
   * =========================================================
   */

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(
          previewUrl
        )
      }
    }
  }, [previewUrl])

  /*
   * =========================================================
   * LOADING SCREEN
   * =========================================================
   */

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "#111",
          color: "#fff",

          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          flexDirection: "column",

          gap: 14,

          padding: 20,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          {text.loading}
        </div>

        <div
          style={{
            fontSize: 13,
            opacity: 0.7,
          }}
        >
          Shubhodayam Bharath
        </div>
      </div>
    )
  }

  /*
   * =========================================================
   * ERROR SCREEN
   * =========================================================
   */

  if (error) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "#111",
          color: "#fff",

          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          padding: 20,
        }}
      >
        <div
          style={{
            maxWidth: 500,
            width: "100%",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Unable to load newspaper
          </div>

          <div
            style={{
              opacity: 0.8,
              marginBottom: 20,
            }}
          >
            {error}
          </div>

          <button
            onClick={onClose}
            style={{
              border: 0,
              borderRadius: 10,

              padding:
                "12px 20px",

              cursor:
                "pointer",
            }}
          >
            {text.close}
          </button>
        </div>
      </div>
    )
  }

  /*
   * =========================================================
   * CROP OVERLAY
   * =========================================================
   *
   * Crop is stored in high-resolution coordinates.
   *
   * Convert it to fitted display coordinates.
   */

  const cropStyle =
    crop
      ? {
          position: "absolute",

          left:
            crop.x *
            fitScale,

          top:
            crop.y *
            fitScale,

          width:
            crop.width *
            fitScale,

          height:
            crop.height *
            fitScale,

          border:
            "3px solid #ffffff",

          boxShadow:
            "0 0 0 99999px rgba(0,0,0,0.55)",

          pointerEvents:
            "none",

          zIndex: 10,
        }
      : null

  /*
   * =========================================================
   * MAIN UI
   * =========================================================
   */

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,

        zIndex: 9999,

        background: "#111",
        color: "#fff",

        display: "flex",
        flexDirection: "column",

        overflow: "hidden",

        /*
         * Helps mobile browsers calculate
         * the viewport correctly.
         */

        height: "100dvh",
        minHeight: 0,
      }}
    >
      {/* ===================================================
          HEADER
          =================================================== */}

      <div
        style={{
          flexShrink: 0,

          minHeight: 58,

          background: "#181818",

          borderBottom:
            "1px solid #333",

          display: "flex",

          alignItems:
            "center",

          justifyContent:
            "space-between",

          padding:
            "8px 12px",

          gap: 8,
        }}
      >
        <button
          onClick={onClose}
          style={{
            border: 0,

            background: "#333",

            color: "#fff",

            borderRadius: 8,

            padding:
              "9px 13px",

            cursor:
              "pointer",
          }}
        >
          ← {text.close}
        </button>

        <div
          style={{
            fontWeight: 700,

            fontSize: 16,

            textAlign:
              "center",
          }}
        >
          {text.crop}
        </div>

        <div
          style={{
            fontSize: 13,

            opacity: 0.8,

            whiteSpace:
              "nowrap",
          }}
        >
          {pageNumber} / {numPages}
        </div>
      </div>

      {/* ===================================================
          NEWSPAPER AREA
          =================================================== */}

      <div
        ref={containerRef}
        style={{
          flex: 1,

          minHeight: 0,

          overflow: "auto",

          WebkitOverflowScrolling:
            "touch",

          overscrollBehavior:
            "contain",

          background:
            "#2a2a2a",

          padding:
            `${SIDE_PADDING}px`,

          /*
           * The controls remain outside this
           * area, so clientHeight is the actual
           * available newspaper area.
           */

          touchAction:
            selecting
              ? "none"
              : "auto",
        }}
      >
        {/* =================================================
            PAGE HOLDER
            ================================================= */}

        <div
          style={{
            position: "relative",

            width:
              displayedWidth ||
              fittedWidth ||
              "max-content",

            height:
              displayedHeight ||
              fittedHeight ||
              "max-content",

            margin:
              "0 auto",

            lineHeight: 0,

            /*
             * Prevent flex/layout shrinking.
             */

            flexShrink: 0,
          }}
        >
          {/* =================================================
              FITTED + ZOOMED PAGE
              ================================================= */}

          <div
            style={{
              position: "absolute",

              left: 0,
              top: 0,

              width:
                fittedWidth ||
                0,

              height:
                fittedHeight ||
                0,

              /*
               * First fit the high-resolution
               * page to screen.
               *
               * Then apply user zoom.
               */

              transform:
                `scale(${zoom})`,

              transformOrigin:
                "top left",
            }}
          >
            {/* =================================================
                HIGH RESOLUTION CANVAS
                ================================================= */}

            <canvas
              ref={canvasRef}

              onPointerDown={
                handlePointerDown
              }

              onPointerMove={
                handlePointerMove
              }

              onPointerUp={
                finishSelecting
              }

              onPointerCancel={
                finishSelecting
              }

              style={{
                display: "block",

                /*
                 * IMPORTANT:
                 *
                 * This is the SCREEN size.
                 *
                 * The REAL pixel dimensions are
                 * still canvas.width/canvas.height.
                 */

                width:
                  fittedWidth
                    ? `${fittedWidth}px`
                    : "auto",

                height:
                  fittedHeight
                    ? `${fittedHeight}px`
                    : "auto",

                maxWidth:
                  "none",

                background:
                  "#fff",

                cursor:
                  selecting
                    ? "crosshair"
                    : "default",

                touchAction:
                  selecting
                    ? "none"
                    : "auto",

                userSelect:
                  selecting
                    ? "none"
                    : "auto",
              }}
            />

            {/* =================================================
                CROP SELECTION
                ================================================= */}

            {crop && (
              <div
                style={
                  cropStyle
                }
              />
            )}

            {/* =================================================
                RENDERING INDICATOR
                ================================================= */}

            {rendering && (
              <div
                style={{
                  position:
                    "absolute",

                  inset: 0,

                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "center",

                  pointerEvents:
                    "none",
                }}
              >
                <div
                  style={{
                    background:
                      "rgba(0,0,0,0.7)",

                    padding:
                      "10px 15px",

                    borderRadius:
                      8,

                    fontSize: 13,
                  }}
                >
                  Loading page...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================
          MESSAGE
          =================================================== */}

      {message && (
        <div
          style={{
            flexShrink: 0,

            background:
              "#222",

            padding:
              "7px 12px",

            textAlign:
              "center",

            fontSize: 13,

            color:
              "#ddd",
          }}
        >
          {message}
        </div>
      )}

      {/* ===================================================
          CONTROLS
          =================================================== */}

      <div
        style={{
          flexShrink: 0,

          background:
            "#181818",

          borderTop:
            "1px solid #333",

          padding:
            "8px 10px",

          /*
           * Keep controls above the mobile
           * browser safe area.
           */

          paddingBottom:
            "calc(8px + env(safe-area-inset-bottom))",
        }}
      >
        {/* =================================================
            PAGE + ZOOM
            ================================================= */}

        <div
          style={{
            display:
              "flex",

            justifyContent:
              "center",

            alignItems:
              "center",

            gap: 7,

            marginBottom:
              8,

            flexWrap:
              "wrap",
          }}
        >
          <button
            onClick={
              goPrevious
            }
            disabled={
              pageNumber <=
                1 ||
              working
            }
            style={{
              ...buttonStyle,

              opacity:
                pageNumber <=
                1
                  ? 0.4
                  : 1,
            }}
          >
            ←{" "}
            {
              text.previous
            }
          </button>

          <button
            onClick={
              zoomOut
            }
            disabled={
              working ||
              zoom <=
                0.6
            }
            style={{
              ...buttonStyle,

              fontSize: 20,

              minWidth: 44,
              minHeight: 42,

              opacity:
                zoom <=
                0.6
                  ? 0.4
                  : 1,
            }}
          >
            −
          </button>

          <div
            style={{
              minWidth: 60,

              textAlign:
                "center",

              fontSize: 13,

              fontWeight:
                600,
            }}
          >
            {Math.round(
              zoom * 100
            )}
            %
          </div>

          <button
            onClick={
              zoomIn
            }
            disabled={
              working ||
              zoom >=
                2.5
            }
            style={{
              ...buttonStyle,

              fontSize: 20,

              minWidth: 44,
              minHeight: 42,

              opacity:
                zoom >=
                2.5
                  ? 0.4
                  : 1,
            }}
          >
            +
          </button>

          <button
            onClick={
              goNext
            }
            disabled={
              pageNumber >=
                numPages ||
              working
            }
            style={{
              ...buttonStyle,

              opacity:
                pageNumber >=
                numPages
                  ? 0.4
                  : 1,
            }}
          >
            {text.next} →
          </button>
        </div>

        {/* =================================================
            CROP ACTIONS
            ================================================= */}

        <div
          style={{
            display:
              "flex",

            justifyContent:
              "center",

            gap: 8,

            flexWrap:
              "wrap",
          }}
        >
          {/* SELECT AREA */}

          {!crop &&
            !selecting && (
              <button
                onClick={
                  startSelecting
                }
                style={{
                  ...buttonStyle,

                  background:
                    "#ffffff",

                  color:
                    "#111",

                  fontWeight:
                    700,

                  minWidth:
                    150,
                }}
              >
                ✂️{" "}
                {
                  text.select
                }
              </button>
            )}

          {/* SELECTING */}

          {selecting && (
            <div
              style={{
                background:
                  "#d97706",

                color:
                  "#fff",

                borderRadius:
                  8,

                padding:
                  "10px 16px",

                fontSize:
                  14,

                fontWeight:
                  600,
              }}
            >
              ✂️{" "}
              {
                text.selecting
              }
            </div>
          )}

          {/* AFTER CROP */}

          {crop &&
            !selecting && (
              <>
                {/* CROP AGAIN */}

                <button
                  onClick={
                    handleCropAgain
                  }
                  disabled={
                    working
                  }
                  style={
                    buttonStyle
                  }
                >
                  ✂️{" "}
                  {
                    text.cropAgain
                  }
                </button>

                {/* PREVIEW */}

                <button
                  onClick={
                    handlePreview
                  }
                  disabled={
                    working
                  }
                  style={
                    buttonStyle
                  }
                >
                  👁️{" "}
                  {
                    text.preview
                  }
                </button>

                {/* DOWNLOAD */}

                <button
                  onClick={
                    handleDownload
                  }
                  disabled={
                    working
                  }
                  style={{
                    ...buttonStyle,

                    background:
                      "#ffffff",

                    color:
                      "#111",

                    fontWeight:
                      700,
                  }}
                >
                  ⬇️{" "}
                  {
                    text.download
                  }
                </button>

                {/* SHARE */}

                <button
                  onClick={
                    handleShare
                  }
                  disabled={
                    working
                  }
                  style={{
                    ...buttonStyle,

                    background:
                      "#2563eb",

                    color:
                      "#fff",

                    fontWeight:
                      700,
                  }}
                >
                  📤{" "}
                  {
                    text.share
                  }
                </button>
              </>
            )}
        </div>
      </div>

      {/* ===================================================
          PREVIEW MODAL
          =================================================== */}

      {previewUrl && (
        <div
          onClick={() =>
            setPreviewUrl("")
          }
          style={{
            position:
              "fixed",

            inset: 0,

            zIndex: 10000,

            background:
              "rgba(0,0,0,0.88)",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            padding: 20,
          }}
        >
          <div
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
            style={{
              maxWidth:
                "95vw",

              maxHeight:
                "90vh",

              overflow:
                "auto",

              background:
                "#fff",

              padding: 10,

              borderRadius:
                10,
            }}
          >
            <img
              src={
                previewUrl
              }
              alt="Cropped newspaper"
              style={{
                display:
                  "block",

                maxWidth:
                  "90vw",

                maxHeight:
                  "80vh",

                width:
                  "auto",

                height:
                  "auto",
              }}
            />

            {/* PREVIEW BUTTONS */}

            <div
              style={{
                display:
                  "flex",

                justifyContent:
                  "center",

                gap: 8,

                marginTop:
                  10,

                flexWrap:
                  "wrap",
              }}
            >
              <button
                onClick={
                  handleDownload
                }
                disabled={
                  working
                }
                style={{
                  ...buttonStyle,

                  background:
                    "#111",

                  color:
                    "#fff",
                }}
              >
                ⬇️{" "}
                {
                  text.download
                }
              </button>

              <button
                onClick={
                  handleShare
                }
                disabled={
                  working
                }
                style={{
                  ...buttonStyle,

                  background:
                    "#2563eb",

                  color:
                    "#fff",
                }}
              >
                📤{" "}
                {
                  text.share
                }
              </button>

              <button
                onClick={() =>
                  setPreviewUrl("")
                }
                style={{
                  ...buttonStyle,

                  background:
                    "#ddd",

                  color:
                    "#111",
                }}
              >
                {
                  text.close
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          PROCESSING
          =================================================== */}

      {working && (
        <div
          style={{
            position:
              "fixed",

            inset: 0,

            zIndex: 11000,

            background:
              "rgba(0,0,0,0.35)",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            pointerEvents:
              "none",
          }}
        >
          <div
            style={{
              background:
                "#181818",

              color:
                "#fff",

              borderRadius:
                10,

              padding:
                "12px 18px",

              fontSize: 14,
            }}
          >
            Processing...
          </div>
        </div>
      )}
    </div>
  )
}

/*
 * =========================================================
 * BUTTON STYLE
 * =========================================================
 */

const buttonStyle = {
  border:
    "1px solid #444",

  background:
    "#292929",

  color:
    "#fff",

  borderRadius: 8,

  padding:
    "9px 12px",

  cursor:
    "pointer",

  fontSize: 13,

  fontWeight: 500,

  WebkitTapHighlightColor:
    "transparent",
}