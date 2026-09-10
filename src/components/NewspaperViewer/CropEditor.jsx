import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import * as pdfjsLib from "pdfjs-dist"

/*
 * =========================================================
 * PDF.JS WORKER
 * =========================================================
 */

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString()

/*
 * =========================================================
 * SETTINGS
 * =========================================================
 */

const PDFJS_VERSION = "6.2.108"

const PDFJS_WASM_URL =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/wasm/`

const LOGO_URL = "/logo.png"

const RENDER_SCALE = 2.5

const MAX_RENDER_PIXELS = 24000000

const MAX_RENDER_WIDTH = 5000

const MAX_RENDER_HEIGHT = 9000

const MIN_CROP_SIZE = 20

const SIDE_PADDING = 18

const MIN_ZOOM = 0.6

const MAX_ZOOM = 3

const ZOOM_STEP = 0.25

const HANDLE_SIZE = 14

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value))

const roundZoom = (value) =>
  Math.round(value * 100) / 100

/*
 * =========================================================
 * COMPONENT
 * =========================================================
 */

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
   * =======================================================
   * PDF SOURCE
   * =======================================================
   */

  const source =
    pdfUrl ||
    sourceProp ||
    url ||
    ""

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
   * =======================================================
   * REFS
   * =======================================================
   */

  const canvasRef = useRef(null)

  const containerRef = useRef(null)

  const pdfRef = useRef(null)

  const renderTaskRef = useRef(null)

  const ownsPdfRef = useRef(false)

  const interactionRef = useRef(null)

  const cropRef = useRef(null)

  const renderIdRef = useRef(0)

  /*
   * =======================================================
   * STATE
   * =======================================================
   */

  const [loading, setLoading] = useState(true)

  const [rendering, setRendering] = useState(false)

  const [error, setError] = useState("")

  const [pageNumber, setPageNumber] = useState(1)

  const [numPages, setNumPages] = useState(0)

  const [zoom, setZoom] = useState(1)

  const [selecting, setSelecting] = useState(false)

  const [crop, setCrop] = useState(null)

  const [previewUrl, setPreviewUrl] = useState("")

  const [working, setWorking] = useState(false)

  const [message, setMessage] = useState("")

  const [canvasSize, setCanvasSize] = useState({
    width: 0,
    height: 0,
  })

  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
  })

  /*
   * =======================================================
   * KEEP CROP REF IN SYNC
   * =======================================================
   */

  useEffect(() => {
    cropRef.current = crop
  }, [crop])

  /*
   * =======================================================
   * DATE
   * =======================================================
   */

  const date =
    edition?.date ||
    edition?.Date ||
    new Date().toISOString().slice(0, 10)

  /*
   * =======================================================
   * LANGUAGE
   * =======================================================
   */

  const text = isTelugu
    ? {
        crop: "క్రాప్",
        select: "ప్రాంతాన్ని ఎంచుకోండి",
        selecting: "వార్త చుట్టూ డ్రాగ్ చేయండి",
        adjust: "క్రాప్‌ను సర్దుబాటు చేయండి",
        cropAgain: "మళ్లీ క్రాప్",
        preview: "ప్రివ్యూ",
        download: "డౌన్‌లోడ్",
        share: "షేర్",
        previous: "మునుపటి",
        next: "తదుపరి",
        close: "మూసివేయి",
        loading: "వార్తాపత్రిక లోడ్ అవుతోంది...",
      }
    : {
        crop: "Crop",
        select: "Select Area",
        selecting: "Drag around the news",
        adjust: "Drag corners or edges to adjust",
        cropAgain: "Crop Again",
        preview: "Preview",
        download: "Download",
        share: "Share",
        previous: "Previous",
        next: "Next",
        close: "Close",
        loading: "Loading newspaper...",
      }

  /*
   * =======================================================
   * LOAD PDF
   * =======================================================
   */

  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      try {
        setLoading(true)
        setError("")
        setMessage("")

        if (existingPdfDocument) {
          ownsPdfRef.current = false

          pdfRef.current = existingPdfDocument

          setNumPages(
            existingPdfDocument.numPages || 0
          )

          setPageNumber(1)

          setLoading(false)

          return
        }

        if (!source) {
          setError("PDF source is missing.")
          setLoading(false)
          return
        }

        const response = await fetch(source, {
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
            data: new Uint8Array(arrayBuffer),

            wasmUrl: PDFJS_WASM_URL,

            useWasm: true,

            isImageDecoderSupported: false,

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
            // Ignore.
          }

          return
        }

        ownsPdfRef.current = true

        pdfRef.current = loadedPdf

        setNumPages(
          loadedPdf.numPages || 0
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

    return () => {
      cancelled = true

      renderIdRef.current += 1

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          // Ignore.
        }

        renderTaskRef.current = null
      }

      if (
        pdfRef.current &&
        ownsPdfRef.current
      ) {
        try {
          pdfRef.current.destroy()
        } catch {
          // Ignore.
        }
      }

      pdfRef.current = null

      ownsPdfRef.current = false
    }
  }, [source, existingPdfDocument])

  /*
   * =======================================================
   * CONTAINER SIZE
   * =======================================================
   */

  useEffect(() => {
    const updateSize = () => {
      const container =
        containerRef.current

      if (!container) {
        return
      }

      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      })
    }

    updateSize()

    window.addEventListener(
      "resize",
      updateSize
    )

    let observer = null

    if (
      containerRef.current &&
      typeof ResizeObserver !== "undefined"
    ) {
      observer =
        new ResizeObserver(updateSize)

      observer.observe(
        containerRef.current
      )
    }

    return () => {
      window.removeEventListener(
        "resize",
        updateSize
      )

      if (observer) {
        observer.disconnect()
      }
    }
  }, [])

  /*
   * =======================================================
   * FIT PAGE TO VIEWING AREA
   * =======================================================
   *
   * Every page is independently fitted into the SAME
   * available viewing area while keeping its real aspect
   * ratio.
   *
   * No CSS transform is used for zoom.
   * =======================================================
   */

  const availableWidth = Math.max(
    100,
    containerSize.width -
      SIDE_PADDING * 2
  )

  const availableHeight = Math.max(
    100,
    containerSize.height -
      SIDE_PADDING * 2
  )

  const widthScale =
    canvasSize.width > 0
      ? availableWidth /
        canvasSize.width
      : 1

  const heightScale =
    canvasSize.height > 0
      ? availableHeight /
        canvasSize.height
      : 1

  const fitScale =
    canvasSize.width > 0 &&
    canvasSize.height > 0
      ? Math.min(
          widthScale,
          heightScale,
          1
        )
      : 1

  const fittedWidth =
    canvasSize.width * fitScale

  const fittedHeight =
    canvasSize.height * fitScale

  const displayedWidth =
    fittedWidth * zoom

  const displayedHeight =
    fittedHeight * zoom

  /*
   * =======================================================
   * RENDER CURRENT PDF PAGE
   * =======================================================
   */

  const renderPage = useCallback(
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

      const currentRenderId =
        ++renderIdRef.current

      try {
        setRendering(true)

        setError("")

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel()
          } catch {
            // Ignore.
          }

          renderTaskRef.current = null
        }

        const page =
          await pdfDocument.getPage(
            pageNumber
          )

        if (
          currentRenderId !==
          renderIdRef.current
        ) {
          try {
            page.cleanup()
          } catch {
            // Ignore.
          }

          return
        }

        const baseViewport =
          page.getViewport({
            scale: 1,
          })

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

        const viewport =
          page.getViewport({
            scale,
          })

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

        canvas.width =
          Math.floor(
            viewport.width
          )

        canvas.height =
          Math.floor(
            viewport.height
          )

        setCanvasSize({
          width: canvas.width,
          height: canvas.height,
        })

        context.fillStyle =
          "#ffffff"

        context.fillRect(
          0,
          0,
          canvas.width,
          canvas.height
        )

        const renderTask =
          page.render({
            canvasContext: context,
            viewport,
          })

        renderTaskRef.current =
          renderTask

        await renderTask.promise

        if (
          currentRenderId !==
          renderIdRef.current
        ) {
          return
        }

        if (
          renderTaskRef.current ===
          renderTask
        ) {
          renderTaskRef.current =
            null
        }

        try {
          page.cleanup()
        } catch {
          // Ignore.
        }

        cropRef.current = null

        setCrop(null)

        setSelecting(false)

        clearPreview()

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

        if (
          currentRenderId ===
          renderIdRef.current
        ) {
          setRendering(false)

          setError(
            "Unable to display this newspaper page."
          )
        }
      }
    },
    [pageNumber]
  )

  /*
   * =======================================================
   * RENDER WHEN PDF IS READY
   * =======================================================
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
   * =======================================================
   * PREVIEW CLEANUP
   * =======================================================
   */

  useEffect(() => {
    if (!previewUrl) {
      return undefined
    }

    return () => {
      try {
        URL.revokeObjectURL(
          previewUrl
        )
      } catch {
        // Ignore.
      }
    }
  }, [previewUrl])

  /*
   * =======================================================
   * CLEAR PREVIEW
   * =======================================================
   */

  const clearPreview =
    useCallback(() => {
      setPreviewUrl("")
    }, [])

  /*
   * =======================================================
   * RESET SELECTION
   * =======================================================
   */

  const resetSelection =
    useCallback(() => {
      interactionRef.current =
        null

      cropRef.current = null

      setCrop(null)

      setSelecting(false)

      setMessage("")

      clearPreview()
    }, [clearPreview])

  /*
   * =======================================================
   * PAGE NAVIGATION
   * =======================================================
   */

  const goPrevious = () => {
    if (
      pageNumber <= 1 ||
      working ||
      rendering
    ) {
      return
    }

    resetSelection()

    setZoom(1)

    setPageNumber(
      (value) => value - 1
    )

    requestAnimationFrame(() => {
      containerRef.current?.scrollTo(
        {
          top: 0,
          left: 0,
          behavior: "smooth",
        }
      )
    })
  }

  const goNext = () => {
    if (
      pageNumber >= numPages ||
      working ||
      rendering
    ) {
      return
    }

    resetSelection()

    setZoom(1)

    setPageNumber(
      (value) => value + 1
    )

    requestAnimationFrame(() => {
      containerRef.current?.scrollTo(
        {
          top: 0,
          left: 0,
          behavior: "smooth",
        }
      )
    })
  }

  /*
   * =======================================================
   * BUTTON ZOOM
   * =======================================================
   */

  const zoomIn = () => {
    if (
      working ||
      rendering
    ) {
      return
    }

    setZoom((value) =>
      Math.min(
        MAX_ZOOM,
        roundZoom(
          value + ZOOM_STEP
        )
      )
    )
  }

  const zoomOut = () => {
    if (
      working ||
      rendering
    ) {
      return
    }

    setZoom((value) =>
      Math.max(
        MIN_ZOOM,
        roundZoom(
          value - ZOOM_STEP
        )
      )
    )
  }

  /*
   * =======================================================
   * GET REAL CANVAS COORDINATES
   * =======================================================
   */

  const getCanvasPoint =
    useCallback((event) => {
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

      if (
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return {
          x: 0,
          y: 0,
        }
      }

      const scaleX =
        canvas.width /
        rect.width

      const scaleY =
        canvas.height /
        rect.height

      let clientX =
        event.clientX

      let clientY =
        event.clientY

      if (
        event.touches &&
        event.touches.length > 0
      ) {
        clientX =
          event.touches[0].clientX

        clientY =
          event.touches[0].clientY
      }

      return {
        x: clamp(
          (clientX - rect.left) *
            scaleX,
          0,
          canvas.width
        ),

        y: clamp(
          (clientY - rect.top) *
            scaleY,
          0,
          canvas.height
        ),
      }
    }, [])

  /*
   * =======================================================
   * START NEW CROP
   * =======================================================
   */

  const startSelecting =
    useCallback(() => {
      if (
        working ||
        rendering
      ) {
        return
      }

      clearPreview()

      interactionRef.current =
        null

      cropRef.current = null

      setCrop(null)

      setMessage("")

      setSelecting(true)

      /*
       * Reset zoom when starting a fresh crop.
       * This makes the crop coordinate system easy
       * and predictable on mobile.
       */

      setZoom(1)
    }, [clearPreview, rendering, working])

  /*
   * =======================================================
   * START DRAWING
   * =======================================================
   */

  const handleCanvasPointerDown =
    useCallback(
      (event) => {
        if (
          !selecting ||
          working ||
          rendering
        ) {
          return
        }

        if (
          event.pointerType ===
            "touch" &&
          event.isPrimary === false
        ) {
          return
        }

        event.preventDefault()

        const point =
          getCanvasPoint(event)

        interactionRef.current = {
          type: "draw",

          pointerId:
            event.pointerId,

          startPoint: point,
        }

        try {
          event.currentTarget.setPointerCapture(
            event.pointerId
          )
        } catch {
          // Ignore.
        }

        const newCrop = {
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
        }

        cropRef.current =
          newCrop

        setCrop(newCrop)
      },
      [
        getCanvasPoint,
        rendering,
        selecting,
        working,
      ]
    )

  /*
   * =======================================================
   * RESIZE CROP
   * =======================================================
   */

  const resizeCrop =
    useCallback(
      (
        startCrop,
        handle,
        dx,
        dy
      ) => {
        const canvas =
          canvasRef.current

        if (!canvas) {
          return startCrop
        }

        const canvasWidth =
          canvas.width

        const canvasHeight =
          canvas.height

        const minWidth =
          Math.min(
            MIN_CROP_SIZE,
            canvasWidth
          )

        const minHeight =
          Math.min(
            MIN_CROP_SIZE,
            canvasHeight
          )

        const originalLeft =
          startCrop.x

        const originalTop =
          startCrop.y

        const originalRight =
          startCrop.x +
          startCrop.width

        const originalBottom =
          startCrop.y +
          startCrop.height

        let left =
          originalLeft

        let top =
          originalTop

        let right =
          originalRight

        let bottom =
          originalBottom

        if (
          handle.includes("w")
        ) {
          left = clamp(
            originalLeft + dx,
            0,
            originalRight -
              minWidth
          )
        }

        if (
          handle.includes("e")
        ) {
          right = clamp(
            originalRight + dx,
            originalLeft +
              minWidth,
            canvasWidth
          )
        }

        if (
          handle.includes("n")
        ) {
          top = clamp(
            originalTop + dy,
            0,
            originalBottom -
              minHeight
          )
        }

        if (
          handle.includes("s")
        ) {
          bottom = clamp(
            originalBottom + dy,
            originalTop +
              minHeight,
            canvasHeight
          )
        }

        return {
          x: left,
          y: top,
          width: Math.max(
            minWidth,
            right - left
          ),
          height: Math.max(
            minHeight,
            bottom - top
          ),
        }
      },
      []
    )

  /*
   * =======================================================
   * GLOBAL POINTER MOVE
   * =======================================================
   *
   * This is used instead of relying only on the canvas.
   *
   * It makes resizing smooth even if the user's finger
   * or mouse moves outside the crop box.
   * =======================================================
   */

  const handleGlobalPointerMove =
    useCallback(
      (event) => {
        const interaction =
          interactionRef.current

        if (
          !interaction ||
          working ||
          rendering
        ) {
          return
        }

        if (
          interaction.pointerId !==
          event.pointerId
        ) {
          return
        }

        event.preventDefault()

        const point =
          getCanvasPoint(event)

        const startPoint =
          interaction.startPoint

        const dx =
          point.x - startPoint.x

        const dy =
          point.y - startPoint.y

        const canvas =
          canvasRef.current

        if (!canvas) {
          return
        }

        if (
          interaction.type ===
          "draw"
        ) {
          const startX =
            startPoint.x

          const startY =
            startPoint.y

          const x = clamp(
            Math.min(
              startX,
              point.x
            ),
            0,
            canvas.width
          )

          const y = clamp(
            Math.min(
              startY,
              point.y
            ),
            0,
            canvas.height
          )

          const right = clamp(
            Math.max(
              startX,
              point.x
            ),
            0,
            canvas.width
          )

          const bottom = clamp(
            Math.max(
              startY,
              point.y
            ),
            0,
            canvas.height
          )

          const newCrop = {
            x,
            y,
            width:
              right - x,
            height:
              bottom - y,
          }

          cropRef.current =
            newCrop

          setCrop(newCrop)

          return
        }

        if (
          interaction.type ===
          "move"
        ) {
          const startCrop =
            interaction.startCrop

          const maxX =
            canvas.width -
            startCrop.width

          const maxY =
            canvas.height -
            startCrop.height

          const newCrop = {
            x: clamp(
              startCrop.x + dx,
              0,
              Math.max(0, maxX)
            ),

            y: clamp(
              startCrop.y + dy,
              0,
              Math.max(0, maxY)
            ),

            width:
              startCrop.width,

            height:
              startCrop.height,
          }

          cropRef.current =
            newCrop

          setCrop(newCrop)

          return
        }

        if (
          interaction.type ===
          "resize"
        ) {
          const newCrop =
            resizeCrop(
              interaction.startCrop,
              interaction.handle,
              dx,
              dy
            )

          cropRef.current =
            newCrop

          setCrop(newCrop)
        }
      },
      [
        getCanvasPoint,
        rendering,
        resizeCrop,
        working,
      ]
    )

  /*
   * =======================================================
   * GLOBAL POINTER UP
   * =======================================================
   */

  const handleGlobalPointerUp =
    useCallback(
      (event) => {
        const interaction =
          interactionRef.current

        if (!interaction) {
          return
        }

        if (
          interaction.pointerId !==
          event.pointerId
        ) {
          return
        }

        if (
          interaction.type ===
          "draw"
        ) {
          const finalCrop =
            cropRef.current

          if (
            !finalCrop ||
            finalCrop.width <
              MIN_CROP_SIZE ||
            finalCrop.height <
              MIN_CROP_SIZE
          ) {
            cropRef.current =
              null

            setCrop(null)

            setMessage(
              "Please select a larger area."
            )

            setSelecting(true)
          } else {
            setSelecting(false)

            setMessage(
              text.adjust
            )
          }
        }

        interactionRef.current =
          null
      },
      [text.adjust]
    )

  /*
   * =======================================================
   * GLOBAL POINTER LISTENERS
   * =======================================================
   */

  useEffect(() => {
    window.addEventListener(
      "pointermove",
      handleGlobalPointerMove,
      {
        passive: false,
      }
    )

    window.addEventListener(
      "pointerup",
      handleGlobalPointerUp
    )

    window.addEventListener(
      "pointercancel",
      handleGlobalPointerUp
    )

    return () => {
      window.removeEventListener(
        "pointermove",
        handleGlobalPointerMove
      )

      window.removeEventListener(
        "pointerup",
        handleGlobalPointerUp
      )

      window.removeEventListener(
        "pointercancel",
        handleGlobalPointerUp
      )
    }
  }, [
    handleGlobalPointerMove,
    handleGlobalPointerUp,
  ])

  /*
   * =======================================================
   * START MOVING CROP
   * =======================================================
   */

  const startMoveCrop =
    useCallback(
      (event) => {
        if (
          !cropRef.current ||
          selecting ||
          working ||
          rendering
        ) {
          return
        }

        event.preventDefault()

        event.stopPropagation()

        const point =
          getCanvasPoint(event)

        interactionRef.current = {
          type: "move",

          pointerId:
            event.pointerId,

          startPoint: point,

          startCrop: {
            ...cropRef.current,
          },
        }

        try {
          event.currentTarget.setPointerCapture(
            event.pointerId
          )
        } catch {
          // Ignore.
        }
      },
      [
        getCanvasPoint,
        rendering,
        selecting,
        working,
      ]
    )

  /*
   * =======================================================
   * START RESIZE
   * =======================================================
   */

  const startResizeCrop =
    useCallback(
      (event, handle) => {
        if (
          !cropRef.current ||
          working ||
          rendering
        ) {
          return
        }

        event.preventDefault()

        event.stopPropagation()

        const point =
          getCanvasPoint(event)

        interactionRef.current = {
          type: "resize",

          pointerId:
            event.pointerId,

          handle,

          startPoint: point,

          startCrop: {
            ...cropRef.current,
          },
        }

        try {
          event.currentTarget.setPointerCapture(
            event.pointerId
          )
        } catch {
          // Ignore.
        }
      },
      [
        getCanvasPoint,
        rendering,
        working,
      ]
    )

  /*
   * =======================================================
   * HANDLE CROP AGAIN
   * =======================================================
   */

  const handleCropAgain =
    useCallback(() => {
      if (working) {
        return
      }

      clearPreview()

      interactionRef.current =
        null

      cropRef.current = null

      setCrop(null)

      setMessage("")

      setSelecting(true)

      setZoom(1)
    }, [clearPreview, working])

  /*
   * =======================================================
   * PINCH ZOOM
   * =======================================================
   */

  const pinchRef = useRef({
    active: false,
    startDistance: 0,
    startZoom: 1,
  })

  const getTouchDistance =
    (touch1, touch2) => {
      const dx =
        touch2.clientX -
        touch1.clientX

      const dy =
        touch2.clientY -
        touch1.clientY

      return Math.sqrt(
        dx * dx + dy * dy
      )
    }

  const handleTouchStart =
    useCallback(
      (event) => {
        if (
          working ||
          rendering ||
          selecting
        ) {
          return
        }

        if (
          event.touches.length === 2
        ) {
          const distance =
            getTouchDistance(
              event.touches[0],
              event.touches[1]
            )

          pinchRef.current = {
            active: true,

            startDistance:
              distance,

            startZoom: zoom,
          }

          event.preventDefault()
        }
      },
      [
        rendering,
        selecting,
        working,
        zoom,
      ]
    )

  const handleTouchMove =
    useCallback(
      (event) => {
        if (
          !pinchRef.current.active
        ) {
          return
        }

        if (
          event.touches.length !== 2
        ) {
          return
        }

        const distance =
          getTouchDistance(
            event.touches[0],
            event.touches[1]
          )

        const startDistance =
          pinchRef.current
            .startDistance

        if (
          startDistance <= 0
        ) {
          return
        }

        const scale =
          distance /
          startDistance

        const newZoom =
          clamp(
            roundZoom(
              pinchRef.current
                .startZoom *
                scale
            ),
            MIN_ZOOM,
            MAX_ZOOM
          )

        setZoom(newZoom)

        event.preventDefault()
      },
      []
    )

  const handleTouchEnd =
    useCallback(() => {
      if (
        pinchRef.current.active
      ) {
        pinchRef.current = {
          active: false,

          startDistance: 0,

          startZoom: 1,
        }
      }
    }, [])

  /*
   * =======================================================
   * MOUSE WHEEL ZOOM
   * =======================================================
   *
   * Ctrl/Cmd + wheel = zoom.
   *
   * This avoids accidentally zooming while simply scrolling
   * the newspaper.
   * =======================================================
   */

  const handleWheel =
    useCallback(
      (event) => {
        if (
          working ||
          rendering
        ) {
          return
        }

        if (
          event.ctrlKey ||
          event.metaKey
        ) {
          event.preventDefault()

          const direction =
            event.deltaY < 0
              ? 1
              : -1

          setZoom((value) =>
            clamp(
              roundZoom(
                value +
                  direction *
                    0.1
              ),
              MIN_ZOOM,
              MAX_ZOOM
            )
          )
        }
      },
      [rendering, working]
    )

  /*
   * =======================================================
   * CREATE CROPPED IMAGE
   * =======================================================
   */

  const createCroppedImage =
    useCallback(
      async () => {
        const canvas =
          canvasRef.current

        const currentCrop =
          cropRef.current

        if (
          !canvas ||
          !currentCrop
        ) {
          throw new Error(
            "Please select an area first."
          )
        }

        if (
          currentCrop.width <
            MIN_CROP_SIZE ||
          currentCrop.height <
            MIN_CROP_SIZE
        ) {
          throw new Error(
            "Selected area is too small."
          )
        }

        const safeCrop = {
          x: clamp(
            currentCrop.x,
            0,
            canvas.width
          ),

          y: clamp(
            currentCrop.y,
            0,
            canvas.height
          ),

          width: clamp(
            currentCrop.width,
            MIN_CROP_SIZE,
            canvas.width -
              currentCrop.x
          ),

          height: clamp(
            currentCrop.height,
            MIN_CROP_SIZE,
            canvas.height -
              currentCrop.y
          ),
        }

        /*
         * ---------------------------------------------------
         * LOAD LOGO
         * ---------------------------------------------------
         */

        const logo = new Image()

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
                  safeCrop.width *
                    0.16
                )
              )
            : 0

        const logoWidth =
          logoLoaded &&
          logo.naturalWidth > 0 &&
          logo.naturalHeight > 0
            ? logo.naturalWidth *
              (
                logoHeight /
                logo.naturalHeight
              )
            : 0

        const output =
          document.createElement(
            "canvas"
          )

        output.width =
          Math.ceil(
            safeCrop.width +
              padding * 2
          )

        output.height =
          Math.ceil(
            safeCrop.height +
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
         * LOGO
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

        ctx.drawImage(
          canvas,

          safeCrop.x,
          safeCrop.y,

          safeCrop.width,
          safeCrop.height,

          padding,
          newspaperY,

          safeCrop.width,
          safeCrop.height
        )

        /*
         * ---------------------------------------------------
         * PNG
         * ---------------------------------------------------
         */

        return await new Promise(
          (resolve, reject) => {
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
      []
    )

  /*
   * =======================================================
   * PREVIEW
   * =======================================================
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
          objectUrl
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
   * =======================================================
   * DOWNLOAD
   * =======================================================
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
            try {
              URL.revokeObjectURL(
                blobUrl
              )
            } catch {
              // Ignore.
            }
          }, 60000)

          return
        }

        const link =
          document.createElement(
            "a"
          )

        link.href = blobUrl

        link.download =
          fileName

        link.rel = "noopener"

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
          try {
            URL.revokeObjectURL(
              blobUrl
            )
          } catch {
            // Ignore.
          }
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
   * =======================================================
   * SHARE
   * =======================================================
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
            shareError
          ) {
            console.warn(
              "CAN SHARE CHECK ERROR:",
              shareError
            )
          }

          if (
            !canShareFiles
          ) {
            setWorking(false)

            setMessage(
              "This browser cannot share the cropped image. Please open the website directly in Chrome on Android or Safari on iPhone."
            )

            return
          }
        }

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
   * =======================================================
   * CROP DISPLAY RECTANGLE
   * =======================================================
   */

  const cropDisplay =
    crop && canvasRef.current
      ? (() => {
          const canvas =
            canvasRef.current

          const rect =
            canvas.getBoundingClientRect()

          if (
            rect.width <= 0 ||
            rect.height <= 0 ||
            canvas.width <= 0 ||
            canvas.height <= 0
          ) {
            return null
          }

          const scaleX =
            rect.width /
            canvas.width

          const scaleY =
            rect.height /
            canvas.height

          return {
            left:
              crop.x * scaleX,

            top:
              crop.y * scaleY,

            width:
              crop.width * scaleX,

            height:
              crop.height * scaleY,
          }
        })()
      : null

  /*
   * =======================================================
   * CROP HANDLE DEFINITIONS
   * =======================================================
   */

  const handles = [
    {
      key: "nw",
      cursor: "nwse-resize",
      style: {
        left:
          -HANDLE_SIZE / 2,
        top:
          -HANDLE_SIZE / 2,
      },
    },

    {
      key: "n",
      cursor: "ns-resize",
      style: {
        left:
          "50%",
        top:
          -HANDLE_SIZE / 2,
        marginLeft:
          -HANDLE_SIZE / 2,
      },
    },

    {
      key: "ne",
      cursor: "nesw-resize",
      style: {
        right:
          -HANDLE_SIZE / 2,
        top:
          -HANDLE_SIZE / 2,
      },
    },

    {
      key: "e",
      cursor: "ew-resize",
      style: {
        right:
          -HANDLE_SIZE / 2,
        top:
          "50%",
        marginTop:
          -HANDLE_SIZE / 2,
      },
    },

    {
      key: "se",
      cursor: "nwse-resize",
      style: {
        right:
          -HANDLE_SIZE / 2,
        bottom:
          -HANDLE_SIZE / 2,
      },
    },

    {
      key: "s",
      cursor: "ns-resize",
      style: {
        left:
          "50%",
        bottom:
          -HANDLE_SIZE / 2,
        marginLeft:
          -HANDLE_SIZE / 2,
      },
    },

    {
      key: "sw",
      cursor: "nesw-resize",
      style: {
        left:
          -HANDLE_SIZE / 2,
        bottom:
          -HANDLE_SIZE / 2,
      },
    },

    {
      key: "w",
      cursor: "ew-resize",
      style: {
        left:
          -HANDLE_SIZE / 2,
        top:
          "50%",
        marginTop:
          -HANDLE_SIZE / 2,
      },
    },
  ]

  /*
   * =======================================================
   * LOADING SCREEN
   * =======================================================
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
   * =======================================================
   * ERROR SCREEN
   * =======================================================
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
              ...buttonStyle,
              background: "#fff",
              color: "#111",
            }}
          >
            {text.close}
          </button>
        </div>
      </div>
    )
  }

  /*
   * =======================================================
   * MAIN UI
   * =======================================================
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
        height: "100dvh",
        minHeight: 0,
      }}
    >
      {/* =================================================
          HEADER
          ================================================= */}

      <div
        style={{
          flexShrink: 0,
          minHeight: 58,
          background: "#181818",
          borderBottom:
            "1px solid #333",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          padding: "8px 12px",
          gap: 8,
        }}
      >
        <button
          onClick={onClose}
          style={{
            ...buttonStyle,
            background: "#333",
            color: "#fff",
          }}
        >
          ← {text.close}
        </button>

        <div
          style={{
            fontWeight: 700,
            fontSize: 16,
            textAlign: "center",
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

      {/* =================================================
          NEWSPAPER VIEWING AREA
          ================================================= */}

      <div
        ref={containerRef}
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
        onWheel={handleWheel}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          WebkitOverflowScrolling:
            "touch",
          overscrollBehavior:
            "contain",
          background: "#2a2a2a",
          padding:
            `${SIDE_PADDING}px`,
          boxSizing:
            "border-box",
          touchAction:
            selecting
              ? "none"
              : "pan-x pan-y",
        }}
      >
        {/* =================================================
            PAGE WRAPPER
            ================================================= */}

        <div
          style={{
            minWidth: "100%",
            minHeight: "100%",
            display: "flex",
            justifyContent:
              "center",
            alignItems:
              "flex-start",
          }}
        >
          {/* =================================================
              PAGE STAGE
              ================================================= */}

          <div
            style={{
              position: "relative",

              width:
                displayedWidth ||
                fittedWidth ||
                1,

              height:
                displayedHeight ||
                fittedHeight ||
                1,

              flex:
                "0 0 auto",

              margin:
                "0 auto",

              lineHeight: 0,

              background:
                "#fff",

              boxShadow:
                "0 2px 18px rgba(0,0,0,0.35)",
            }}
          >
            {/* =============================================
                PDF CANVAS
                ============================================= */}

            <canvas
              ref={canvasRef}
              onPointerDown={
                handleCanvasPointerDown
              }
              style={{
                display: "block",

                width:
                  displayedWidth
                    ? `${displayedWidth}px`
                    : "1px",

                height:
                  displayedHeight
                    ? `${displayedHeight}px`
                    : "1px",

                maxWidth: "none",

                background:
                  "#fff",

                cursor:
                  selecting
                    ? "crosshair"
                    : crop
                      ? "default"
                      : "default",

                touchAction:
                  selecting
                    ? "none"
                    : "auto",

                userSelect:
                  "none",

                WebkitUserSelect:
                  "none",

                WebkitTouchCallout:
                  "none",
              }}
            />

            {/* =============================================
                CROP SELECTION
                ============================================= */}

            {crop &&
              cropDisplay && (
                <div
                  onPointerDown={
                    startMoveCrop
                  }
                  style={{
                    position:
                      "absolute",

                    left:
                      cropDisplay.left,

                    top:
                      cropDisplay.top,

                    width:
                      cropDisplay.width,

                    height:
                      cropDisplay.height,

                    boxSizing:
                      "border-box",

                    border:
                      "2px solid #ffffff",

                    boxShadow:
                      "0 0 0 99999px rgba(0,0,0,0.58)",

                    pointerEvents:
                      "auto",

                    touchAction:
                      "none",

                    cursor:
                      "move",

                    zIndex: 30,
                  }}
                >
                  {/* =====================================
                      INNER MOVE AREA
                      ===================================== */}

                  <div
                    style={{
                      position:
                        "absolute",

                      inset: 0,

                      background:
                        "rgba(255,255,255,0.03)",

                      pointerEvents:
                        "none",
                    }}
                  />

                  {/* =====================================
                      EDGE RESIZE AREAS
                      ===================================== */}

                  <div
                    onPointerDown={(
                      event
                    ) =>
                      startResizeCrop(
                        event,
                        "n"
                      )
                    }
                    style={{
                      position:
                        "absolute",
                      left: 10,
                      right: 10,
                      top: -8,
                      height: 16,
                      cursor:
                        "ns-resize",
                      touchAction:
                        "none",
                      zIndex: 2,
                    }}
                  />

                  <div
                    onPointerDown={(
                      event
                    ) =>
                      startResizeCrop(
                        event,
                        "e"
                      )
                    }
                    style={{
                      position:
                        "absolute",
                      top: 10,
                      bottom: 10,
                      right: -8,
                      width: 16,
                      cursor:
                        "ew-resize",
                      touchAction:
                        "none",
                      zIndex: 2,
                    }}
                  />

                  <div
                    onPointerDown={(
                      event
                    ) =>
                      startResizeCrop(
                        event,
                        "s"
                      )
                    }
                    style={{
                      position:
                        "absolute",
                      left: 10,
                      right: 10,
                      bottom: -8,
                      height: 16,
                      cursor:
                        "ns-resize",
                      touchAction:
                        "none",
                      zIndex: 2,
                    }}
                  />

                  <div
                    onPointerDown={(
                      event
                    ) =>
                      startResizeCrop(
                        event,
                        "w"
                      )
                    }
                    style={{
                      position:
                        "absolute",
                      top: 10,
                      bottom: 10,
                      left: -8,
                      width: 16,
                      cursor:
                        "ew-resize",
                      touchAction:
                        "none",
                      zIndex: 2,
                    }}
                  />

                  {/* =====================================
                      8 VISIBLE HANDLES
                      ===================================== */}

                  {handles.map(
                    (handle) => (
                      <div
                        key={
                          handle.key
                        }
                        onPointerDown={(
                          event
                        ) =>
                          startResizeCrop(
                            event,
                            handle.key
                          )
                        }
                        style={{
                          position:
                            "absolute",

                          width:
                            HANDLE_SIZE,

                          height:
                            HANDLE_SIZE,

                          boxSizing:
                            "border-box",

                          background:
                            "#ffffff",

                          border:
                            "2px solid #111",

                          borderRadius:
                            3,

                          boxShadow:
                            "0 1px 4px rgba(0,0,0,0.45)",

                          cursor:
                            handle.cursor,

                          touchAction:
                            "none",

                          zIndex: 5,

                          ...handle.style,
                        }}
                      />
                    )
                  )}
                </div>
              )}

            {/* =============================================
                ADJUSTMENT LABEL
                ============================================= */}

            {crop &&
              !selecting &&
              !working &&
              !rendering && (
                <div
                  style={{
                    position:
                      "absolute",

                    left: "50%",

                    top: 10,

                    transform:
                      "translateX(-50%)",

                    background:
                      "rgba(0,0,0,0.78)",

                    color: "#fff",

                    padding:
                      "7px 12px",

                    borderRadius: 999,

                    fontSize: 12,

                    fontWeight: 600,

                    whiteSpace:
                      "nowrap",

                    pointerEvents:
                      "none",

                    zIndex: 40,

                    boxShadow:
                      "0 2px 8px rgba(0,0,0,0.3)",
                  }}
                >
                  ↔ {text.adjust}
                </div>
              )}

            {/* =============================================
                RENDERING INDICATOR
                ============================================= */}

            {rendering && (
              <div
                style={{
                  position:
                    "absolute",

                  inset: 0,

                  display: "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "center",

                  pointerEvents:
                    "none",

                  zIndex: 50,
                }}
              >
                <div
                  style={{
                    background:
                      "rgba(0,0,0,0.72)",

                    padding:
                      "10px 15px",

                    borderRadius: 8,

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

      {/* =================================================
          MESSAGE
          ================================================= */}

      {message && (
        <div
          style={{
            flexShrink: 0,
            background: "#222",
            padding:
              "7px 12px",
            textAlign: "center",
            fontSize: 13,
            color: "#ddd",
          }}
        >
          {message}
        </div>
      )}

      {/* =================================================
          CONTROLS
          ================================================= */}

      <div
        style={{
          flexShrink: 0,
          background: "#181818",
          borderTop:
            "1px solid #333",
          padding:
            "8px 10px",
          paddingBottom:
            "calc(8px + env(safe-area-inset-bottom))",
          boxSizing:
            "border-box",
        }}
      >
        {/* ===============================================
            PAGE + ZOOM CONTROLS
            =============================================== */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "center",
            alignItems:
              "center",
            gap: 7,
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          {/* PREVIOUS */}

          <button
            onClick={
              goPrevious
            }
            disabled={
              pageNumber <= 1 ||
              working ||
              rendering
            }
            style={{
              ...buttonStyle,
              opacity:
                pageNumber <= 1
                  ? 0.4
                  : 1,
            }}
          >
            ← {text.previous}
          </button>

          {/* ZOOM OUT */}

          <button
            onClick={
              zoomOut
            }
            disabled={
              working ||
              rendering ||
              zoom <= MIN_ZOOM
            }
            style={{
              ...buttonStyle,
              fontSize: 20,
              minWidth: 44,
              minHeight: 42,
              opacity:
                zoom <= MIN_ZOOM
                  ? 0.4
                  : 1,
            }}
          >
            −
          </button>

          {/* ZOOM VALUE */}

          <div
            style={{
              minWidth: 60,
              textAlign:
                "center",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {Math.round(
              zoom * 100
            )}
            %
          </div>

          {/* ZOOM IN */}

          <button
            onClick={
              zoomIn
            }
            disabled={
              working ||
              rendering ||
              zoom >= MAX_ZOOM
            }
            style={{
              ...buttonStyle,
              fontSize: 20,
              minWidth: 44,
              minHeight: 42,
              opacity:
                zoom >= MAX_ZOOM
                  ? 0.4
                  : 1,
            }}
          >
            +
          </button>

          {/* NEXT */}

          <button
            onClick={
              goNext
            }
            disabled={
              pageNumber >=
                numPages ||
              working ||
              rendering
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

        {/* ===============================================
            CROP ACTIONS
            =============================================== */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {/* SELECT AREA */}

          {!crop &&
            !selecting && (
              <button
                onClick={
                  startSelecting
                }
                disabled={
                  working ||
                  rendering
                }
                style={{
                  ...buttonStyle,
                  background:
                    "#fff",
                  color:
                    "#111",
                  fontWeight:
                    700,
                  minWidth:
                    150,
                }}
              >
                ✂️ {text.select}
              </button>
            )}

          {/* SELECTING */}

          {selecting && (
            <div
              style={{
                background:
                  "#d97706",
                color: "#fff",
                borderRadius:
                  8,
                padding:
                  "10px 16px",
                fontSize: 14,
                fontWeight:
                  600,
              }}
            >
              ✂️ {text.selecting}
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
                      "#fff",
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

      {/* =================================================
          PREVIEW MODAL
          ================================================= */}

      {previewUrl && (
        <div
          onClick={
            clearPreview
          }
          style={{
            position:
              "fixed",
            inset: 0,
            zIndex: 10000,
            background:
              "rgba(0,0,0,0.88)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: 20,
            boxSizing:
              "border-box",
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
              boxSizing:
                "border-box",
            }}
          >
            <img
              src={previewUrl}
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
                marginTop: 10,
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
                onClick={
                  clearPreview
                }
                style={{
                  ...buttonStyle,
                  background:
                    "#ddd",
                  color:
                    "#111",
                }}
              >
                {text.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          PROCESSING
          ================================================= */}

      {working && (
        <div
          style={{
            position:
              "fixed",
            inset: 0,
            zIndex: 11000,
            background:
              "rgba(0,0,0,0.35)",
            display: "flex",
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
              color: "#fff",
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

  borderRadius:
    8,

  padding:
    "9px 12px",

  cursor:
    "pointer",

  fontSize:
    13,

  fontWeight:
    500,

  WebkitTapHighlightColor:
    "transparent",

  minHeight:
    42,

  boxSizing:
    "border-box",
}