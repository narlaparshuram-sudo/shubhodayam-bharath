export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).send("Supabase environment variables are missing.");
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/editions?select=date,pdf_path&pdf_path=not.is.null&order=date.desc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Supabase error:", errorText);

      return res.status(500).send("Unable to load newspaper editions.");
    }

    const editions = await response.json();

    const baseUrl = "https://shubhodayam-bharath.vercel.app";

    const urls = [
      `${baseUrl}/`,
      `${baseUrl}/calendar`,
      ...editions.map(
        (edition) => `${baseUrl}/newspaper/${edition.date}`
      ),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url}</loc>
  </url>`
  )
  .join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );

    return res.status(200).send(xml);
  } catch (error) {
    console.error("Sitemap error:", error);

    return res.status(500).send("Sitemap generation failed.");
  }
}