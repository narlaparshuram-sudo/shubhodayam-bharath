import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

// ==========================================================
// CLOUDFLARE R2 CONFIGURATION
// ==========================================================

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = "shubhodayam-pdfs";
const R2_ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

// ==========================================================
// SUPABASE CONFIGURATION
// ==========================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const r2 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://shubhodayam-bharath.vercel.app"
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (
      !ACCOUNT_ID ||
      !ACCESS_KEY_ID ||
      !SECRET_ACCESS_KEY ||
      !SUPABASE_URL ||
      !SUPABASE_PUBLISHABLE_KEY ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(500).json({
        error: "Server configuration is missing.",
      });
    }

    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    const accessToken = authHeader.slice(7).trim();

    if (!accessToken) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    const supabaseAuth = createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(accessToken);

    if (authError || !user) {
      return res.status(401).json({
        error: "Invalid or expired login session.",
      });
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: adminRow,
      error: adminError,
    } = await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error("Admin verification error:", adminError);
      return res.status(500).json({
        error: "Unable to verify admin access.",
      });
    }

    if (!adminRow) {
      return res.status(403).json({
        error: "Admin access required.",
      });
    }

    const { fileName } = req.body || {};

    if (!fileName) {
      return res.status(400).json({
        error: "fileName is required.",
      });
    }

    let key = String(fileName).trim().replace(/\\/g, "/");
    key = key.replace(/^\/+/, "");

    if (
      !key ||
      key.includes("../") ||
      key.includes("/..") ||
      key.includes("\\..")
    ) {
      return res.status(400).json({
        error: "Invalid file path.",
      });
    }

    const parts = key.split("/").filter(Boolean);

    if (!parts.length) {
      return res.status(400).json({
        error: "Invalid file path.",
      });
    }

    key = parts
      .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "-"))
      .join("/");

    const allowedPdf = /^\d{4}-\d{2}-\d{2}\.pdf$/i;
    const allowedThumbnail =
      /^thumbnails\/\d{4}-\d{2}-\d{2}\.(jpg|jpeg)$/i;

    if (!allowedPdf.test(key) && !allowedThumbnail.test(key)) {
      return res.status(400).json({
        error: "Invalid R2 file path.",
      });
    }

    console.log("Deleting R2 object:", key, "for admin:", user.id);

    await r2.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    return res.status(200).json({
      success: true,
      key,
    });
  } catch (error) {
    console.error("R2 delete error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Unable to delete R2 object.",
    });
  }
}
