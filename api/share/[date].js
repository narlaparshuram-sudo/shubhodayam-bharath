// =========================================================
// SHUBHODAYAM BHARATH
// NEWSPAPER SOCIAL SHARE PREVIEW
// DYNAMIC DATE ROUTE
// =========================================================

const SITE_URL =
  "https://shubhodayam-bharath.vercel.app";

const R2_PUBLIC_BASE_URL =
  "https://pub-f9f048e0bee74489bafcef7bcbf0bec1.r2.dev";

export default async function handler(req, res) {
  try {
    const date = String(req.query?.date || "").trim();

    // -----------------------------------------------------
    // Validate newspaper date
    // -----------------------------------------------------
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).send("Invalid newspaper date.");
    }

    // -----------------------------------------------------
    // Actual newspaper page
    // -----------------------------------------------------
    const newspaperUrl =
      `${SITE_URL}/newspaper/${date}`;

    // -----------------------------------------------------
    // Newspaper thumbnail directly from Cloudflare R2
    // -----------------------------------------------------
    const shareImageUrl =
      `${R2_PUBLIC_BASE_URL}/thumbnails/${date}.jpg`;

    // -----------------------------------------------------
    // Share title and description
    // -----------------------------------------------------
    const title =
      `Shubhodayam Bharath – Newspaper Edition ${date}`;

    const description =
      "Shubhodayam Bharath – Daily Telugu & English Newspaper";

    // -----------------------------------------------------
    // Social sharing HTML
    // -----------------------------------------------------
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>${escapeHtml(title)}</title>

  <meta
    name="description"
    content="${escapeHtml(description)}"
  >

  <!-- ===================================================
       OPEN GRAPH
       =================================================== -->

  <meta
    property="og:type"
    content="website"
  >

  <meta
    property="og:site_name"
    content="Shubhodayam Bharath"
  >

  <meta
    property="og:title"
    content="${escapeHtml(title)}"
  >

  <meta
    property="og:description"
    content="${escapeHtml(description)}"
  >

  <meta
    property="og:url"
    content="${escapeHtml(`${SITE_URL}/share/${date}`)}"
  >

  <meta
    property="og:image"
    content="${escapeHtml(shareImageUrl)}"
  >

  <meta
    property="og:image:secure_url"
    content="${escapeHtml(shareImageUrl)}"
  >

  <meta
    property="og:image:type"
    content="image/jpeg"
  >

  <meta
    property="og:image:width"
    content="1200"
  >

  <meta
    property="og:image:height"
    content="630"
  >

  <meta
    property="og:image:alt"
    content="Shubhodayam Bharath newspaper ${escapeHtml(date)}"
  >

  <!-- ===================================================
       TWITTER / X
       =================================================== -->

  <meta
    name="twitter:card"
    content="summary_large_image"
  >

  <meta
    name="twitter:title"
    content="${escapeHtml(title)}"
  >

  <meta
    name="twitter:description"
    content="${escapeHtml(description)}"
  >

  <meta
    name="twitter:image"
    content="${escapeHtml(shareImageUrl)}"
  >

  <!-- ===================================================
       CANONICAL
       =================================================== -->

  <link
    rel="canonical"
    href="${escapeHtml(newspaperUrl)}"
  >
</head>

<body>

  <p>
    Opening Shubhodayam Bharath newspaper...
  </p>

  <p>
    <a href="${escapeHtml(newspaperUrl)}">
      Open newspaper
    </a>
  </p>

  <script>
    window.location.replace(
      ${JSON.stringify(newspaperUrl)}
    );
  </script>

</body>
</html>`;

    // -----------------------------------------------------
    // Response
    // -----------------------------------------------------

    res.status(200);

    res.setHeader(
      "Content-Type",
      "text/html; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=60, s-maxage=300, stale-while-revalidate=3600"
    );

    return res.end(html);

  } catch (error) {
    console.error(
      "SHARE PAGE ERROR:",
      error
    );

    return res
      .status(500)
      .send("Unable to create share page.");
  }
}

// =========================================================
// HTML ESCAPE
// =========================================================

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}