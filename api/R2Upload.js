import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = "shubhodayam-pdfs";
const R2_ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_PUBLIC_BASE_URL =
  "https://pub-f9f048e0bee74489bafcef7bcbf0bec1.r2.dev";

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

  if (req.method === "OPTIONS") return res.status(200).end();

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
      return res.status(500).json({
        error: "Unable to verify admin access.",
      });
    }

    if (!adminRow) {
      return res.status(403).json({
        error: "Admin access required.",
      });
    }

    const { fileName, contentType } = req.body || {};

    if (!fileName) {
      return res.status(400).json({ error: "fileName is required." });
    }

    if (!contentType) {
      return res.status(400).json({ error: "contentType is required." });
    }

    const allowedContentTypes = [
      "application/pdf",
      "image/jpeg",
    ];

    if (!allowedContentTypes.includes(contentType)) {
      return res.status(400).json({
        error: "Only PDF and JPEG files are allowed.",
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
      return res.status(400).json({ error: "Invalid file path." });
    }

    const parts = key.split("/").filter(Boolean);

    if (!parts.length) {
      return res.status(400).json({ error: "Invalid file name." });
    }

    key = parts
      .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "-"))
      .join("/");

    const pdfPattern = /^\d{4}-\d{2}-\d{2}\.pdf$/i;
    const thumbnailPattern =
      /^thumbnails\/\d{4}-\d{2}-\d{2}\.(jpg|jpeg)$/i;

    if (contentType === "application/pdf" && !pdfPattern.test(key)) {
      return res.status(400).json({
        error: "Invalid newspaper PDF path.",
      });
    }

    if (contentType === "image/jpeg" && !thumbnailPattern.test(key)) {
      return res.status(400).json({
        error: "Invalid thumbnail path.",
      });
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2, command, {
      expiresIn: 900,
    });

    const publicKey = key
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");

    const publicUrl = `${R2_PUBLIC_BASE_URL}/${publicKey}`;

    return res.status(200).json({
      success: true,
      uploadUrl,
      key,
      publicUrl,
      contentType,
    });
  } catch (error) {
    console.error("R2 upload URL error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Unable to generate R2 upload URL.",
    });
  }
}
