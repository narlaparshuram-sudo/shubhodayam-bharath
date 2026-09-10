// =========================================================
// SHUBHODAYAM BHARATH
// SOCIAL SHARE PREVIEW
// =========================================================

export default function handler(req, res) {
  const date = String(req.query?.date || "").trim()

  // -------------------------------------------------------
  // Validate date
  // -------------------------------------------------------

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).send("Invalid newspaper date.")
    return
  }

  // -------------------------------------------------------
  // Supabase project URL
  //
  // IMPORTANT:
  // Set SUPABASE_URL in Vercel Environment Variables.
  // -------------------------------------------------------

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL

  if (!supabaseUrl) {
    res.status(500).send(
      "SUPABASE_URL environment variable is missing."
    )
    return
  }

  const cleanSupabaseUrl =
    supabaseUrl.replace(/\/+$/, "")

  // -------------------------------------------------------
  // Thumbnail
  // -------------------------------------------------------

  const thumbnailUrl =
    `${cleanSupabaseUrl}/storage/v1/object/public/newspapers/thumbnails/${date}.jpg`

  // -------------------------------------------------------
  // Newspaper page
  // -------------------------------------------------------

  const newspaperUrl =
    `https://shubhodayam-bharath.vercel.app/newspaper/${date}`

  const title =
    `Shubhodayam Bharath – Newspaper Edition ${date}`

  const description =
    `Read the Shubhodayam Bharath Telugu and English daily newspaper edition for ${date} online.`

  // -------------------------------------------------------
  // HTML
  // -------------------------------------------------------

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <title>${escapeHtml(title)}</title>

  <meta
    name="description"
    content="${escapeHtml(description)}"
  />

  <!-- =====================================================
       OPEN GRAPH
       ===================================================== -->

  <meta
    property="og:type"
    content="article"
  />

  <meta
    property="og:title"
    content="${escapeHtml(title)}"
  />

  <meta
    property="og:description"
    content="${escapeHtml(description)}"
  />

  <meta
    property="og:url"
    content="${escapeHtml(newspaperUrl)}"
  />

  <meta
    property="og:site_name"
    content="Shubhodayam Bharath"
  />

  <meta
    property="og:image"
    content="${escapeHtml(thumbnailUrl)}"
  />

  <meta
    property="og:image:secure_url"
    content="${escapeHtml(thumbnailUrl)}"
  />

  <meta
    property="og:image:type"
    content="image/jpeg"
  />

  <meta
    property="og:image:width"
    content="1200"
  />

  <meta
    property="og:image:height"
    content="630"
  />

  <!-- =====================================================
       TWITTER / X
       ===================================================== -->

  <meta
    name="twitter:card"
    content="summary_large_image"
  />

  <meta
    name="twitter:title"
    content="${escapeHtml(title)}"
  />

  <meta
    name="twitter:description"
    content="${escapeHtml(description)}"
  />

  <meta
    name="twitter:image"
    content="${escapeHtml(thumbnailUrl)}"
  />

  <!-- =====================================================
       CANONICAL
       ===================================================== -->

  <link
    rel="canonical"
    href="${escapeHtml(newspaperUrl)}"
  />

  <!-- =====================================================
       AUTOMATIC REDIRECT
       ===================================================== -->

  <meta
    http-equiv="refresh"
    content="0;url=${escapeHtml(newspaperUrl)}"
  />

  <script>
    window.location.replace(
      ${JSON.stringify(newspaperUrl)}
    )
  </script>
</head>

<body>

  <p>
    Opening Shubhodayam Bharath newspaper...
  </p>

  <p>
    <a href="${escapeHtml(newspaperUrl)}">
      Open Newspaper
    </a>
  </p>

</body>
</html>`

  res.status(200)

  res.setHeader(
    "Content-Type",
    "text/html; charset=utf-8"
  )

  res.setHeader(
    "Cache-Control",
    "public, max-age=300, s-maxage=3600"
  )

  res.send(html)
}

// =========================================================
// HTML ESCAPE
// =========================================================

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}