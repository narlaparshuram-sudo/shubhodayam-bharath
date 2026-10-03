// =========================================================
// SHUBHODAYAM BHARATH
// SOCIAL SHARE IMAGE
// =========================================================

export default async function handler(req, res) {
  try {
    const date = String(
      req.query?.date || ""
    ).trim()

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).send(
        "Invalid newspaper date."
      )
      return
    }

    const possibleUrls = [
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_URL,
    ]

    const supabaseUrlValue =
      possibleUrls.find(isValidUrl)

    if (!supabaseUrlValue) {
      console.error(
        "Supabase URL is missing or invalid."
      )

      res.status(500).send(
        "Supabase URL is missing or invalid."
      )

      return
    }

    const supabaseUrl =
      supabaseUrlValue.replace(/\/+$/, "")

    const thumbnailUrl =
      `${supabaseUrl}` +
      `/storage/v1/object/public/newspapers/thumbnails/${date}.jpg`

    console.log(
      "Fetching newspaper thumbnail:",
      thumbnailUrl
    )

    const imageResponse =
      await fetch(thumbnailUrl)

    if (!imageResponse.ok) {
      console.error(
        "THUMBNAIL FETCH ERROR:",
        imageResponse.status,
        thumbnailUrl
      )

      res.status(404).send(
        "Newspaper thumbnail not found."
      )

      return
    }

    const imageBuffer =
      Buffer.from(
        await imageResponse.arrayBuffer()
      )

    res.status(200)

    res.setHeader(
      "Content-Type",
      "image/jpeg"
    )

    res.setHeader(
      "Content-Length",
      String(imageBuffer.length)
    )

    res.setHeader(
      "Cache-Control",
      "public, max-age=300, s-maxage=3600"
    )

    res.end(imageBuffer)

  } catch (error) {

    console.error(
      "SHARE IMAGE ERROR:",
      error
    )

    res.status(500).send(
      "Unable to load newspaper thumbnail."
    )
  }
}

function isValidUrl(value) {
  if (!value) return false

  try {
    const url = new URL(value)

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    )
  } catch {
    return false
  }
}