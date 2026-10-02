// =========================================================
// SHUBHODAYAM BHARATH
// HOMEPAGE SOCIAL SHARE PREVIEW
// =========================================================

export default async function handler(req, res) {
  try {
    // -------------------------------------------------------
    // Supabase project URL
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
    // Server-side Supabase key
    //
    // Use the existing Service Role Key on Vercel.
    // This key is NEVER sent to the browser.
    // -------------------------------------------------------

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY

    if (!supabaseKey) {
      res.status(500).send(
        "Supabase server key is missing."
      )
      return
    }

    // -------------------------------------------------------
    // Get latest newspaper edition
    // -------------------------------------------------------

    const apiUrl =
      `${cleanSupabaseUrl}/rest/v1/editions` +
      `?select=date,title` +
      `&order=date.desc` +
      `&limit=1`

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()

      console.error(
        "SUPABASE LATEST EDITION ERROR:",
        response.status,
        errorText
      )

      res.status(500).send(
        "Unable to find the latest newspaper edition."
      )

      return
    }

    const editions = await response.json()

    if (
      !Array.isArray(editions) ||
      editions.length === 0 ||
      !editions[0]?.date
    ) {
      res.status(404).send(
        "No newspaper editions found."
      )

      return
    }

    const latestDate =
      String(editions[0].date).trim()

    // -------------------------------------------------------
    // Existing thumbnail location
    //
    // PDFs are in R2.
    // Thumbnails are in Supabase Storage.
    // -------------------------------------------------------

    const thumbnailUrl =
      `${cleanSupabaseUrl}` +
      `/storage/v1/object/public/newspapers/thumbnails/${latestDate}.jpg`

    // -------------------------------------------------------
    // Real website URL
    // -------------------------------------------------------

    const websiteUrl =
      "https://shubhodayam-bharath.vercel.app/"

    const title =
      "Shubhodayam Bharath – Daily Telugu & English Newspaper"

    const description =
      `Read the latest Shubhodayam Bharath newspaper online. Latest edition: ${latestDate}.`

    // -------------------------------------------------------
    // Social preview HTML
    // -------------------------------------------------------

    const html = `<!doctype html>
<html lang="en">

<head>

  <meta charset="UTF-8" />

  <title>${escapeHtml(title)}</title>

  <meta
    name="description"
    content="${escapeHtml(description)}"
  />

  <!-- OPEN GRAPH -->

  <meta
    property="og:type"
    content="website"
  />

  <meta
    property="og:site_name"
    content="Shubhodayam Bharath"
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
    content="${escapeHtml(websiteUrl)}"
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
    property="og:image:alt"
    content="Latest Shubhodayam Bharath newspaper edition"
  />

  <!-- TWITTER / X -->

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

  <!-- CANONICAL -->

  <link
    rel="canonical"
    href="${escapeHtml(websiteUrl)}"
  />

  <!-- REDIRECT TO REAL WEBSITE -->

  <meta
    http-equiv="refresh"
    content="0;url=${escapeHtml(websiteUrl)}"
  />

  <script>
    window.location.replace(
      ${JSON.stringify(websiteUrl)}
    )
  </script>

</head>

<body>

  <p>
    Opening Shubhodayam Bharath...
  </p>

  <p>
    <a href="${escapeHtml(websiteUrl)}">
      Open Shubhodayam Bharath
    </a>
  </p>

</body>

</html>`

    // -------------------------------------------------------
    // Response
    // -------------------------------------------------------

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
  } catch (error) {
    console.error(
      "HOME SHARE ERROR:",
      error
    )

    res.status(500).send(
      "Unable to create the homepage share preview."
    )
  }
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