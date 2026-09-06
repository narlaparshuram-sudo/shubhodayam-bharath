import { useCallback, useEffect, useRef, useState } from "react"
import * as pdfjsLib from "pdfjs-dist"

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

const PDFJS_VERSION = "6.2.108"

const PDFJS_WASM_URL =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/wasm/`

const LOGO_URL = "/logo.png"

const MAX_RENDER_PIXELS = 12000000
const MAX_RENDER_WIDTH = 3600
const MAX_RENDER_HEIGHT = 7200

const MIN_CROP_SIZE = 20

export default function CropEditor({
  pdfUrl,
  source: sourceProp,
  pdf,
  url,
  edition,
  isTelugu = false,
  onClose,
}) {
  const source =
    pdfUrl ||
    sourceProp ||
    pdf ||
    url ||
    ""

  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const pdfRef = useRef(null)
  const renderTaskRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState("")

  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState(0)

  /*
   * Zoom is visual/CSS zoom.
   * This keeps Android zoom fast and reliable.
   */
  const [zoom, setZoom] = useState(1)

  const [selecting, setSelecting] = useState(false)
  const [crop, setCrop] = useState(null)
  const [dragStart, setDragStart] = useState(null)

  const [previewUrl, setPreviewUrl] = useState("")
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState("")

  const [canvasSize, setCanvasSize] = useState({
    width: 0,
    height: 0,
  })

  const date =
    edition?.date ||
    edition?.Date ||
    new Date().toISOString().slice(0, 10)

  const text = isTelugu
    ? {
        crop: "క్రాప్",
        select: "ప్రాంతాన్ని ఎంచుకోండి",
        selecting: "వార్త చుట్టూ డ్రాగ్ చేయండి",
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
   * ---------------------------------------------------------
   * LOAD PDF
   * ---------------------------------------------------------
   */

  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      if (!source) {
        setError("PDF source is missing.")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError("")
        setMessage("")

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

        if (cancelled) return

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
              32 * 1024 * 1024,
          })

        const loadedPdf =
          await loadingTask.promise

        if (cancelled) {
          await loadedPdf.destroy()
          return
        }

        pdfRef.current = loadedPdf

        setNumPages(loadedPdf.numPages)
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

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          // ignore
        }
      }

      if (pdfRef.current) {
        try {
          pdfRef.current.destroy()
        } catch {
          // ignore
        }

        pdfRef.current = null
      }
    }
  }, [source])

  /*
   * ---------------------------------------------------------
   * RENDER CURRENT PAGE
   * ---------------------------------------------------------
   */

  const renderPage = useCallback(async () => {
    const pdfDocument = pdfRef.current
    const canvas = canvasRef.current

    if (!pdfDocument || !canvas) {
      return
    }

    try {
      setRendering(true)
      setError("")

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          // ignore
        }
      }

      const page =
        await pdfDocument.getPage(pageNumber)

      const baseViewport =
        page.getViewport({
          scale: 1,
        })

      /*
       * Fixed render scale.
       * Zoom is handled visually.
       */
      let scale = 1.35

      let width =
        baseViewport.width * scale

      let height =
        baseViewport.height * scale

      const pixels =
        width * height

      if (pixels > MAX_RENDER_PIXELS) {
        const factor =
          Math.sqrt(
            MAX_RENDER_PIXELS / pixels
          )

        scale *= factor

        width =
          baseViewport.width * scale

        height =
          baseViewport.height * scale
      }

      if (width > MAX_RENDER_WIDTH) {
        const factor =
          MAX_RENDER_WIDTH / width

        scale *= factor

        width =
          baseViewport.width * scale

        height =
          baseViewport.height * scale
      }

      if (height > MAX_RENDER_HEIGHT) {
        const factor =
          MAX_RENDER_HEIGHT / height

        scale *= factor

        width =
          baseViewport.width * scale

        height =
          baseViewport.height * scale
      }

      const viewport =
        page.getViewport({
          scale,
        })

      const context =
        canvas.getContext("2d", {
          alpha: false,
        })

      if (!context) {
        throw new Error(
          "Canvas is not supported."
        )
      }

      canvas.width =
        Math.floor(viewport.width)

      canvas.height =
        Math.floor(viewport.height)

      canvas.style.width =
        `${Math.floor(viewport.width)}px`

      canvas.style.height =
        `${Math.floor(viewport.height)}px`

      setCanvasSize({
        width: viewport.width,
        height: viewport.height,
      })

      context.fillStyle = "#ffffff"

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

      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null
      }

      if (page.cleanup) {
        page.cleanup()
      }

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
  }, [pageNumber])

  useEffect(() => {
    if (!loading && pdfRef.current) {
      renderPage()
    }
  }, [loading, renderPage])

  /*
   * ---------------------------------------------------------
   * PAGE CONTROLS
   * ---------------------------------------------------------
   */

  const goPrevious = () => {
    if (pageNumber <= 1 || working) return

    setCrop(null)
    setPreviewUrl("")
    setMessage("")
    setPageNumber((value) => value - 1)

    setZoom(1)

    containerRef.current?.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    })
  }

  const goNext = () => {
    if (
      pageNumber >= numPages ||
      working
    ) {
      return
    }

    setCrop(null)
    setPreviewUrl("")
    setMessage("")
    setPageNumber((value) => value + 1)

    setZoom(1)

    containerRef.current?.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    })
  }

  /*
   * ---------------------------------------------------------
   * ZOOM
   * ---------------------------------------------------------
   */

  const zoomIn = () => {
    setZoom((value) => {
      const next =
        Math.min(
          2.5,
          Math.round(
            (value + 0.25) * 100
          ) / 100
        )

      return next
    })
  }

  const zoomOut = () => {
    setZoom((value) => {
      const next =
        Math.max(
          0.6,
          Math.round(
            (value - 0.25) * 100
          ) / 100
        )

      return next
    })
  }

  /*
   * ---------------------------------------------------------
   * CANVAS POINT
   * ---------------------------------------------------------
   */

  const getCanvasPoint = (event) => {
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

    const scaleX =
      canvas.width / rect.width

    const scaleY =
      canvas.height / rect.height

    let clientX
    let clientY

    if (
      event.touches &&
      event.touches.length > 0
    ) {
      clientX =
        event.touches[0].clientX

      clientY =
        event.touches[0].clientY
    } else {
      clientX = event.clientX
      clientY = event.clientY
    }

    const x =
      (clientX - rect.left) *
      scaleX

    const y =
      (clientY - rect.top) *
      scaleY

    return {
      x: Math.max(
        0,
        Math.min(canvas.width, x)
      ),
      y: Math.max(
        0,
        Math.min(canvas.height, y)
      ),
    }
  }

  /*
   * ---------------------------------------------------------
   * CROP SELECTION
   * ---------------------------------------------------------
   */

  const startSelecting = () => {
    setCrop(null)
    setPreviewUrl("")
    setMessage("")
    setSelecting(true)
    setDragStart(null)
  }

  const handlePointerDown = (event) => {
    if (!selecting) return

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

  const handlePointerMove = (event) => {
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

  const finishSelecting = () => {
    if (
      !selecting ||
      !crop
    ) {
      return
    }

    setSelecting(false)
    setDragStart(null)

    if (
      crop.width < MIN_CROP_SIZE ||
      crop.height < MIN_CROP_SIZE
    ) {
      setCrop(null)

      setMessage(
        "Please select a larger area."
      )
    }
  }

  /*
   * ---------------------------------------------------------
   * CREATE CROPPED IMAGE
   * ---------------------------------------------------------
   */

  const createCroppedImage =
    useCallback(
      async () => {
        const canvas =
          canvasRef.current

        if (!canvas || !crop) {
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
            0
            ? logo.naturalWidth *
              (logoHeight /
                logo.naturalHeight)
            : 0

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
              (logoLoaded
                ? 20
                : 0)
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

        ctx.fillStyle =
          "#ffffff"

        ctx.fillRect(
          0,
          0,
          output.width,
          output.height
        )

        /*
         * Logo
         */
        if (
          logoLoaded &&
          logoWidth > 0
        ) {
          const logoX =
            (output.width -
              logoWidth) /
            2

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
         * Newspaper
         */
        const newspaperY =
          padding +
          logoHeight +
          (logoLoaded
            ? 20
            : 0)

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
              "image/png",
              1
            )
          }
        )
      },
      [crop]
    )

  /*
   * ---------------------------------------------------------
   * PREVIEW
   * ---------------------------------------------------------
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
   * ---------------------------------------------------------
   * DOWNLOAD
   * ---------------------------------------------------------
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
            URL.revokeObjectURL(
              blobUrl
            )
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
   * ---------------------------------------------------------
   * SHARE
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   *
   * We ONLY use the native Web Share API.
   *
   * We DO NOT:
   * - open the image
   * - open a preview
   * - use window.open()
   * - use blob URL fallback
   * - use text-only sharing
   *
   * If the browser supports image sharing,
   * the device's native share sheet opens.
   */

  const handleShare =
    async () => {
      try {
        if (working) return

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
         * Check file-sharing capability
         * when the browser provides canShare.
         */
        if (
          typeof navigator.canShare ===
          "function"
        ) {
          let canShareFiles = false

          try {
            canShareFiles =
              navigator.canShare({
                files: [file],
              })
          } catch (canShareError) {
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
         * Native device share sheet.
         *
         * Android:
         * WhatsApp / Telegram / Facebook /
         * Instagram / Messages / etc.
         *
         * iPhone:
         * WhatsApp / Telegram / Messages /
         * AirDrop / Save Image / etc.
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
         * User cancelled the native
         * share sheet.
         */
        if (
          err?.name ===
          "AbortError"
        ) {
          setMessage("")
          return
        }

        /*
         * No preview fallback here.
         */
        setMessage(
          "Unable to open the device share menu. Please open the website directly in Chrome on Android or Safari on iPhone."
        )
      }
    }

  /*
   * ---------------------------------------------------------
   * CROP AGAIN
   * ---------------------------------------------------------
   */

  const handleCropAgain =
    () => {
      setCrop(null)
      setPreviewUrl("")
      setMessage("")
      setSelecting(true)
      setDragStart(null)
    }

  /*
   * ---------------------------------------------------------
   * CLEAN PREVIEW
   * ---------------------------------------------------------
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
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
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
          alignItems:
            "center",
          justifyContent:
            "center",
          flexDirection:
            "column",
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
   * ---------------------------------------------------------
   * ERROR
   * ---------------------------------------------------------
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
          alignItems:
            "center",
          justifyContent:
            "center",
          padding: 20,
        }}
      >
        <div
          style={{
            maxWidth: 500,
            width: "100%",
            textAlign:
              "center",
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
   * Crop overlay.
   */

  const cropStyle =
    crop
      ? {
          position:
            "absolute",
          left: crop.x,
          top: crop.y,
          width: crop.width,
          height: crop.height,
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
   * Outer wrapper reserves zoomed size.
   */

  const zoomedWidth =
    canvasSize.width *
    zoom

  const zoomedHeight =
    canvasSize.height *
    zoom

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#111",
        color: "#fff",
        display: "flex",
        flexDirection:
          "column",
        overflow: "hidden",
      }}
    >
      {/* HEADER */}

      <div
        style={{
          flexShrink: 0,
          minHeight: 58,
          background:
            "#181818",
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
            background:
              "#333",
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

      {/* NEWSPAPER */}

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
          padding: 18,
          touchAction:
            selecting
              ? "none"
              : "auto",
        }}
      >
        <div
          style={{
            position:
              "relative",
            width:
              zoomedWidth ||
              "max-content",
            height:
              zoomedHeight ||
              "max-content",
            margin:
              "0 auto",
            lineHeight: 0,
          }}
        >
          {/* ZOOMED PAGE */}

          <div
            style={{
              position:
                "absolute",
              left: 0,
              top: 0,
              width:
                canvasSize.width ||
                0,
              height:
                canvasSize.height ||
                0,
              transform:
                `scale(${zoom})`,
              transformOrigin:
                "top left",
            }}
          >
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
                display:
                  "block",
                background:
                  "#fff",
                maxWidth:
                  "none",
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

            {crop && (
              <div
                style={
                  cropStyle
                }
              />
            )}

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
                    fontSize:
                      13,
                  }}
                >
                  Loading page...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MESSAGE */}

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

      {/* CONTROLS */}

      <div
        style={{
          flexShrink: 0,
          background:
            "#181818",
          borderTop:
            "1px solid #333",
          padding:
            "8px 10px",
        }}
      >
        {/* PAGE + ZOOM */}

        <div
          style={{
            display:
              "flex",
            justifyContent:
              "center",
            alignItems:
              "center",
            gap: 7,
            marginBottom: 8,
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
            ← {text.previous}
          </button>

          <button
            onClick={
              zoomOut
            }
            disabled={
              working ||
              zoom <= 0.6
            }
            style={{
              ...buttonStyle,
              fontSize: 20,
              minWidth: 44,
              minHeight: 42,
              opacity:
                zoom <= 0.6
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
              fontWeight: 600,
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
              zoom >= 2.5
            }
            style={{
              ...buttonStyle,
              fontSize: 20,
              minWidth: 44,
              minHeight: 42,
              opacity:
                zoom >= 2.5
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

        {/* CROP ACTIONS */}

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
                ✂️ {text.select}
              </button>
            )}

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
              ✂️ {text.selecting}
            </div>
          )}

          {crop &&
            !selecting && (
              <>
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
                  {text.share}
                </button>
              </>
            )}
        </div>
      </div>

      {/* PREVIEW */}

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
                {text.share}
              </button>

              <button
                onClick={() =>
                  setPreviewUrl(
                    ""
                  )
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

      {/* PROCESSING */}

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
              fontSize:
                14,
            }}
          >
            Processing...
          </div>
        </div>
      )}
    </div>
  )
}

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