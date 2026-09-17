import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ==========================================================
// CLOUDFLARE R2 CONFIGURATION
// ==========================================================

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

const BUCKET_NAME = "shubhodayam-pdfs";

const R2_ENDPOINT =
  `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

// ==========================================================
// R2 CLIENT
// ==========================================================

const r2 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

// ==========================================================
// VERCEL API HANDLER
// ==========================================================

export default async function handler(req, res) {
  // --------------------------------------------------------
  // CORS
  // --------------------------------------------------------

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // --------------------------------------------------------
  // OPTIONS
  // --------------------------------------------------------

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --------------------------------------------------------
  // METHOD
  // --------------------------------------------------------

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    // ------------------------------------------------------
    // CHECK ENVIRONMENT VARIABLES
    // ------------------------------------------------------

    if (
      !ACCOUNT_ID ||
      !ACCESS_KEY_ID ||
      !SECRET_ACCESS_KEY
    ) {
      console.error(
        "R2 environment variables are missing."
      );

      return res.status(500).json({
        error:
          "R2 server configuration is missing.",
      });
    }

    // ------------------------------------------------------
    // REQUEST BODY
    // ------------------------------------------------------

    const {
      fileName,
      contentType,
    } = req.body || {};

    if (!fileName) {
      return res.status(400).json({
        error: "fileName is required.",
      });
    }

    // ------------------------------------------------------
    // PDF ONLY
    // ------------------------------------------------------

    const safeContentType =
      contentType === "application/pdf"
        ? "application/pdf"
        : null;

    if (!safeContentType) {
      return res.status(400).json({
        error:
          "Only PDF files are allowed.",
      });
    }

    // ------------------------------------------------------
    // SANITIZE FILE NAME
    // ------------------------------------------------------

    const cleanFileName =
      String(fileName)
        .replace(/\\/g, "/")
        .split("/")
        .pop()
        .replace(/[^a-zA-Z0-9._-]/g, "-");

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

    // ------------------------------------------------------
    // R2 OBJECT KEY
    // ------------------------------------------------------

    const key = cleanFileName;

    console.log(
      "Generating R2 upload URL:",
      key
    );

    // ------------------------------------------------------
    // PRESIGNED PUT URL
    // ------------------------------------------------------

    const command =
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: "application/pdf",
      });

    const uploadUrl =
      await getSignedUrl(
        r2,
        command,
        {
          expiresIn: 900,
        }
      );

    // ------------------------------------------------------
    // PUBLIC R2 URL
    // ------------------------------------------------------

    const publicUrl =
      `https://pub-f9f048e0bee74489bafcef7bcbf0bec1.r2.dev/${encodeURIComponent(
        key
      )}`;

    // ------------------------------------------------------
    // RESPONSE
    // ------------------------------------------------------

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