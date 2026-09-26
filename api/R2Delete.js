import {
  S3Client,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

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

// ==========================================================
// R2 CLIENT
// ==========================================================

const r2 = new S3Client({
  region: "auto",

  endpoint: R2_ENDPOINT,

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

  // --------------------------------------------------------
  // CORS
  // --------------------------------------------------------

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

  // --------------------------------------------------------
  // OPTIONS
  // --------------------------------------------------------

  if (
    req.method === "OPTIONS"
  ) {
    return res
      .status(200)
      .end();
  }

  // --------------------------------------------------------
  // METHOD
  // --------------------------------------------------------

  if (
    req.method !== "POST"
  ) {
    return res.status(405).json({
      error:
        "Method not allowed",
    });
  }

  try {

    // ------------------------------------------------------
    // CHECK ENVIRONMENT VARIABLES
    // ------------------------------------------------------

    if (
      !ACCOUNT_ID ||
      !ACCESS_KEY_ID ||
      !SECRET_ACCESS_KEY ||
      !SUPABASE_URL ||
      !SUPABASE_PUBLISHABLE_KEY
    ) {

      console.error(
        "Required server environment variables are missing."
      );

      return res.status(500).json({
        error:
          "Server configuration is missing.",
      });
    }

    // ------------------------------------------------------
    // AUTHORIZATION HEADER
    // ------------------------------------------------------

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

    // ------------------------------------------------------
    // SUPABASE AUTH CLIENT
    // ------------------------------------------------------

    const supabase =
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

    // ------------------------------------------------------
    // VERIFY SUPABASE USER
    // ------------------------------------------------------

    const {
      data: {
        user,
      },
      error: authError,
    } =
      await supabase.auth.getUser(
        accessToken
      );

    if (
      authError ||
      !user
    ) {

      console.error(
        "R2 delete authentication failed:",
        authError?.message
      );

      return res.status(401).json({
        error:
          "Invalid or expired login session.",
      });
    }

    // ------------------------------------------------------
    // VERIFY ADMIN USER
    // ------------------------------------------------------

    const {
      data: adminRow,
      error: adminError,
    } =
      await supabase
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
        adminError.message
      );

      return res.status(500).json({
        error:
          "Unable to verify admin access.",
      });
    }

    if (!adminRow) {

      console.warn(
        "Non-admin delete attempt:",
        user.id
      );

      return res.status(403).json({
        error:
          "Admin access required.",
      });
    }

    // ------------------------------------------------------
    // REQUEST BODY
    // ------------------------------------------------------

    const {
      fileName,
    } = req.body || {};

    if (!fileName) {

      return res.status(400).json({
        error:
          "fileName is required.",
      });
    }

    // ------------------------------------------------------
    // SANITIZE FILE NAME
    // ------------------------------------------------------

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
          "Only PDF files can be deleted.",
      });
    }

    // ------------------------------------------------------
    // DELETE FROM R2
    // ------------------------------------------------------

    console.log(
      "Deleting R2 PDF:",
      cleanFileName,
      "by admin:",
      user.id
    );

    const command =
      new DeleteObjectCommand({
        Bucket:
          BUCKET_NAME,

        Key:
          cleanFileName,
      });

    await r2.send(
      command
    );

    // ------------------------------------------------------
    // SUCCESS
    // ------------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "R2 PDF deleted successfully.",

      key:
        cleanFileName,
    });

  } catch (error) {

    console.error(
      "R2 delete error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Unable to delete R2 PDF.",
    });
  }
}