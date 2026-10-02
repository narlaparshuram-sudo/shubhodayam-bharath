// =========================================================
// SHUBHODAYAM BHARATH
// HOMEPAGE SOCIAL PREVIEW - DIAGNOSTIC
// =========================================================

export default async function handler(req, res) {
  try {
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL

    if (!supabaseUrl) {
      res.status(500).send(
        "ERROR: SUPABASE_URL is missing."
      )
      return
    }

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY

    if (!supabaseKey) {
      res.status(500).send(
        "ERROR: Supabase server key is missing."
      )
      return
    }

    const cleanSupabaseUrl =
      supabaseUrl.replace(/\/+$/, "")

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

    const responseText =
      await response.text()

    if (!response.ok) {
      res.status(500).send(
        `SUPABASE ERROR ${response.status}: ${responseText}`
      )
      return
    }

    let editions

    try {
      editions = JSON.parse(responseText)
    } catch {
      res.status(500).send(
        `SUPABASE RETURNED INVALID JSON: ${responseText}`
      )
      return
    }

    if (
      !Array.isArray(editions) ||
      editions.length === 0
    ) {
      res.status(404).send(
        "SUPABASE CONNECTED SUCCESSFULLY, BUT NO EDITIONS WERE FOUND."
      )
      return
    }

    const latestDate =
      String(editions[0]?.date || "").trim()

    if (!latestDate) {
      res.status(500).send(
        "EDITION WAS FOUND, BUT DATE IS EMPTY."
      )
      return
    }

    const thumbnailUrl =
      `${cleanSupabaseUrl}` +
      `/storage/v1/object/public/newspapers/thumbnails/${latestDate}.jpg`

    res.status(200).send(
      `SUCCESS

Latest edition:
${latestDate}

Thumbnail URL:
${thumbnailUrl}

Supabase connection:
OK`
    )
  } catch (error) {
    console.error(
      "HOME SHARE DIAGNOSTIC ERROR:",
      error
    )

    res.status(500).send(
      `SERVER ERROR: ${error?.message || String(error)}`
    )
  }
}