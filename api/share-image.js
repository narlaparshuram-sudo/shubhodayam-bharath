// =========================================================
// SHUBHODAYAM BHARATH
// SOCIAL SHARE IMAGE - CLOUDFLARE R2 THUMBNAIL
// =========================================================

const R2_PUBLIC_BASE_URL =
  "https://pub-f9f048e0bee74489bafcef7bcbf0bec1.r2.dev";

export default async function handler(req, res) {
  try {
    const date = String(req.query?.date || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).send("Invalid newspaper date.");
    }

    const thumbnailUrl =
      `${R2_PUBLIC_BASE_URL}/thumbnails/${date}.jpg`;

    console.log("Fetching R2 newspaper thumbnail:", thumbnailUrl);

    const imageResponse = await fetch(thumbnailUrl);

    if (!imageResponse.ok) {
      console.error(
        "R2 THUMBNAIL FETCH ERROR:",
        imageResponse.status,
        thumbnailUrl
      );

      return res.status(404).send("Newspaper thumbnail not found.");
    }

    const imageBuffer = Buffer.from(
      await imageResponse.arrayBuffer()
    );

    res.status(200);
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Length", String(imageBuffer.length));
    res.setHeader(
      "Cache-Control",
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
    );

    return res.end(imageBuffer);
  } catch (error) {
    console.error("SHARE IMAGE ERROR:", error);

    return res.status(500).send(
      "Unable to load newspaper thumbnail."
    );
  }
}
