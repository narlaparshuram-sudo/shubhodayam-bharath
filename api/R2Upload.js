import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

// ==========================================================
// CLOUDFLARE R2 CONFIGURATION
// ==========================================================

const ACCOUNT_ID =
  process.env.R2_ACCOUNT_ID;

const ACCESS_KEY_ID =
  process.env.R2_ACCESS_KEY_ID;

const SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY;

const BUCKET_NAME =
  "shubhodayam-pdfs";

const R2_ENDPOINT =
  `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

// ==========================================================
// SUPABASE CONFIGURATION
// ==========================================================

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL;

const SUPABASE_PUBLISHABLE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// IMPORTANT:
// This key is used ONLY on the Vercel server.
// Never put this key in React/frontend code.
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

// ==========================================================
// R2 CLIENT
// ==========================================================

const r2 = new S3Client({
  region: "auto",

  endpoint:
    R2_ENDPOINT,

  credentials: {
    accessKeyId:
      ACCESS_KEY_ID,

    secretAccessKey:
      SECRET_ACCESS_KEY,
  },
});

// ==========================================================
// VERCEL API HANDLER
// ==========================================================

export default async function handler(
  req,
  res
) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://shubhodayam-bharath.vercel.app"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (
    req.method === "OPTIONS"
  ) {
    return res
      .status(200)
      .end();
  }

  if (
    req.method !== "POST"
  ) {
    return res.status(405).json({
      error:
        "Method not allowed",
    });
  }

  try {
    // ========================================================
    // CHECK SERVER ENVIRONMENT VARIABLES
    // ========================================================

    if (
      !ACCOUNT_ID ||
      !ACCESS_KEY_ID ||
      !SECRET_ACCESS_KEY ||
      !SUPABASE_URL ||
      !SUPABASE_PUBLISHABLE_KEY ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error(
        "Required server environment variables are missing."
      );

      return res.status(500).json({
        error:
          "Server configuration is missing.",
      });
    }

    // ========================================================
    // READ LOGIN TOKEN
    // ========================================================

    const authHeader =
      req.headers.authorization ||
      "";

    if (
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        error:
          "Authentication required.",
      });
    }

    const accessToken =
      authHeader
        .slice(7)
        .trim();

    if (!accessToken) {
      return res.status(401).json({
        error:
          "Authentication required.",
      });
    }

    // ========================================================
    // VERIFY THE USER'S LOGIN SESSION
    // ========================================================

    const supabaseAuth =
      createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,
          },
        }
      );

    const {
      data: {
        user,
      },
      error: authError,
    } =
      await supabaseAuth.auth.getUser(
        accessToken
      );

    if (
      authError ||
      !user
    ) {
      console.error(
        "R2 upload authentication failed:",
        authError?.message
      );

      return res.status(401).json({
        error:
          "Invalid or expired login session.",
      });
    }

    console.log(
      "Authenticated user:",
      user.id
    );

    // ========================================================
    // VERIFY ADMIN USING SERVICE ROLE
    // ========================================================
    //
    // This is the important fix.
    //
    // The service-role key is used ONLY on the Vercel server
    // so RLS cannot prevent the admin_users lookup.
    //

    const supabaseAdmin =
      createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,
          },
        }
      );

    const {
      data: adminRow,
      error: adminError,
    } =
      await supabaseAdmin
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (adminError) {
      console.error(
        "Admin verification error:",
        adminError
      );

      return res.status(500).json({
        error:
          "Unable to verify admin access.",
      });
    }

    if (!adminRow) {
      console.warn(
        "Non-admin upload attempt:",
        user.id
      );

      return res.status(403).json({
        error:
          "Admin access required.",
      });
    }

    console.log(
      "Admin verification successful:",
      user.id
    );

    // ========================================================
    // READ FILE INFORMATION
    // ========================================================

    const {
      fileName,
      contentType,
    } = req.body || {};

    if (!fileName) {
      return res.status(400).json({
        error:
          "fileName is required.",
      });
    }

    // ========================================================
    // ONLY PDF FILES
    // ========================================================

    if (
      contentType !==
      "application/pdf"
    ) {
      return res.status(400).json({
        error:
          "Only PDF files are allowed.",
      });
    }

    // ========================================================
    // SANITIZE FILE NAME
    // ========================================================

    const cleanFileName =
      String(fileName)
        .replace(
          /\\/g,
          "/"
        )
        .split("/")
        .pop()
        .replace(
          /[^a-zA-Z0-9._-]/g,
          "-"
        );

    if (!cleanFileName) {
      return res.status(400).json({
        error:
          "Invalid file name.",
      });
    }

    if (
      !cleanFileName
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      return res.status(400).json({
        error:
          "Only PDF files are allowed.",
      });
    }

    // ========================================================
    // R2 OBJECT KEY
    // ========================================================

    const key =
      cleanFileName;

    console.log(
      "Generating R2 upload URL:",
      key,
      "for admin:",
      user.id
    );

    // ========================================================
    // CREATE R2 UPLOAD COMMAND
    // ========================================================

    const command =
      new PutObjectCommand({
        Bucket:
          BUCKET_NAME,

        Key:
          key,

        ContentType:
          "application/pdf",
      });

    // ========================================================
    // CREATE SIGNED UPLOAD URL
    // ========================================================

    const uploadUrl =
      await getSignedUrl(
        r2,
        command,
        {
          expiresIn: 900,
        }
      );

    // ========================================================
    // PUBLIC R2 URL
    // ========================================================

    const publicUrl =
      `https://pub-f9f048e0bee74489bafcef7bcbf0bec1.r2.dev/${encodeURIComponent(
        key
      )}`;

    // ========================================================
    // RETURN RESULT
    // ========================================================

    return res.status(200).json({
      success: true,

      uploadUrl,

      key,

      publicUrl,
    });

  } catch (error) {
    console.error(
      "R2 upload URL error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Unable to generate R2 upload URL.",
    });
  }
}