import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist";
import { supabase } from "../../lib/supabase";

// ==========================================================
// PDF.JS WORKER
// ==========================================================

GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.worker.min.mjs";

const PDF_WASM_URL =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/wasm/";

// ==========================================================
// ADMIN PAGE
// ==========================================================

export default function Admin() {
  // ========================================================
  // AUTH
  // ========================================================

  const [session, setSession] = useState(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // ========================================================
  // FORM
  // ========================================================

  const [date, setDate] = useState("");
  const [file, setFile] = useState(null);

  // IMPORTANT:
  // Using a ref makes file input handling more reliable on
  // Android and iOS browsers.
  const fileInputRef = useRef(null);

  // ========================================================
  // EDITION
  // ========================================================

  const [existingEdition, setExistingEdition] = useState(null);
  const [checkingEdition, setCheckingEdition] = useState(false);

  // ========================================================
  // STATUS
  // ========================================================

  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // ========================================================
  // AUTH CHECK
  // ========================================================

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        setCheckingAdmin(true);

        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Session error:", error);

          if (mounted) {
            setSession(null);
            setIsAdmin(false);
            setCheckingAdmin(false);
          }

          return;
        }

        if (!mounted) return;

        setSession(currentSession);

        if (currentSession?.user) {
          await verifyAdmin(currentSession.user.id);
        } else {
          setIsAdmin(false);
          setCheckingAdmin(false);
        }
      } catch (error) {
        console.error("Auth check error:", error);

        if (mounted) {
          setSession(null);
          setIsAdmin(false);
          setCheckingAdmin(false);
        }
      }
    }

    async function verifyAdmin(userId) {
      try {
        const { data, error } = await supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          console.error("Admin verification error:", error);

          if (mounted) {
            setIsAdmin(false);
            setCheckingAdmin(false);
          }

          return;
        }

        if (!mounted) return;

        setIsAdmin(!!data);
        setCheckingAdmin(false);
      } catch (error) {
        console.error("Admin verification exception:", error);

        if (mounted) {
          setIsAdmin(false);
          setCheckingAdmin(false);
        }
      }
    }

    loadSession();

    // Listen for login/logout changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;

      setSession(newSession);

      if (newSession?.user) {
        await verifyAdmin(newSession.user.id);
      } else {
        setIsAdmin(false);
        setCheckingAdmin(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ========================================================
  // CHECK EXISTING EDITION
  // ========================================================

  useEffect(() => {
    if (!isAdmin || !date) {
      setExistingEdition(null);
      return;
    }

    checkEdition(date);
  }, [date, isAdmin]);

  async function checkEdition(selectedDate) {
    if (!selectedDate) {
      setExistingEdition(null);
      return;
    }

    try {
      setCheckingEdition(true);

      const { data, error } = await supabase
        .from("editions")
        .select(
          "id, created_at, date, title, pdf_path"
        )
        .eq("date", selectedDate)
        .maybeSingle();

      if (error) {
        console.error("Edition check error:", error);

        setExistingEdition(null);

        setMessage(
          "Unable to check whether this date already exists."
        );
        setMessageType("error");

        return;
      }

      if (data) {
        setExistingEdition(data);

        setMessage(
          `A newspaper for ${selectedDate} already exists. You can replace or delete it.`
        );
        setMessageType("info");
      } else {
        setExistingEdition(null);

        setMessage(
          `No newspaper exists for ${selectedDate}. You can upload a new edition.`
        );
        setMessageType("success");
      }
    } catch (error) {
      console.error("Check edition exception:", error);

      setExistingEdition(null);

      setMessage(
        "Unable to check the selected newspaper date."
      );
      setMessageType("error");
    } finally {
      setCheckingEdition(false);
    }
  }

  // ========================================================
  // FILE SELECTION
  // ANDROID / IOS FRIENDLY
  // ========================================================

  function handleFileChange(event) {
    const input = event.currentTarget;

    const selectedFile =
      input.files && input.files.length > 0
        ? input.files[0]
        : null;

    setMessage("");
    setMessageType("");

    // User cancelled the Android/iOS file picker
    if (!selectedFile) {
      setFile(null);
      return;
    }

    const fileName = String(
      selectedFile.name || ""
    ).toLowerCase();

    const fileType = String(
      selectedFile.type || ""
    ).toLowerCase();

    // Some mobile file pickers don't always provide
    // the MIME type correctly.
    const isPdf =
      fileType === "application/pdf" ||
      fileName.endsWith(".pdf");

    if (!isPdf) {
      setFile(null);

      setMessage(
        "Please select a PDF file only."
      );

      setMessageType("error");

      input.value = "";

      return;
    }

    // Make sure the selected file is valid
    if (selectedFile.size <= 0) {
      setFile(null);

      setMessage(
        "The selected PDF appears to be empty. Please choose another PDF."
      );

      setMessageType("error");

      input.value = "";

      return;
    }

    setFile(selectedFile);

    console.log(
      "================================="
    );
    console.log("PDF SELECTED");
    console.log(
      "Name:",
      selectedFile.name
    );
    console.log(
      "Type:",
      selectedFile.type
    );
    console.log(
      "Size:",
      selectedFile.size
    );
    console.log(
      "Last modified:",
      selectedFile.lastModified
    );
    console.log(
      "================================="
    );

    setMessage(
      `PDF selected successfully: ${selectedFile.name}`
    );

    setMessageType("success");
  }

  // ========================================================
  // GENERATE THUMBNAIL
  // ========================================================

  async function generateAndUploadThumbnail(
    selectedFile,
    selectedDate
  ) {
    let pdf = null;

    try {
      const arrayBuffer =
        await selectedFile.arrayBuffer();

      const loadingTask = getDocument({
        data: new Uint8Array(arrayBuffer),
        wasmUrl: PDF_WASM_URL,
      });

      pdf = await loadingTask.promise;

      const page = await pdf.getPage(1);

      // ----------------------------------------------------
      // Thumbnail size
      // ----------------------------------------------------

      const baseViewport =
        page.getViewport({
          scale: 1,
        });

      const targetWidth = 700;

      const scale =
        targetWidth /
        baseViewport.width;

      const viewport =
        page.getViewport({
          scale,
        });

      const canvas =
        document.createElement("canvas");

      canvas.width =
        Math.ceil(viewport.width);

      canvas.height =
        Math.ceil(viewport.height);

      const context =
        canvas.getContext("2d", {
          alpha: false,
        });

      if (!context) {
        throw new Error(
          "Could not create thumbnail canvas."
        );
      }

      // White background
      context.fillStyle = "#ffffff";

      context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      await page.render({
        canvasContext: context,
        viewport,
        intent: "display",
      }).promise;

      const blob =
        await new Promise(
          (resolve, reject) => {
            canvas.toBlob(
              (result) => {
                if (result) {
                  resolve(result);
                } else {
                  reject(
                    new Error(
                      "Could not create thumbnail image."
                    )
                  );
                }
              },
              "image/jpeg",
              0.82
            );
          }
        );

      // ----------------------------------------------------
      // Thumbnail path
      // ----------------------------------------------------

      const thumbnailPath =
        `thumbnails/${selectedDate}.jpg`;

      const {
        error: thumbnailUploadError,
      } = await supabase.storage
        .from("newspapers")
        .upload(
          thumbnailPath,
          blob,
          {
            cacheControl: "3600",
            contentType: "image/jpeg",
            upsert: true,
          }
        );

      if (thumbnailUploadError) {
        throw thumbnailUploadError;
      }

      console.log(
        "Thumbnail uploaded:",
        thumbnailPath
      );

      return true;
    } catch (error) {
      console.error(
        "Thumbnail generation/upload error:",
        error
      );

      return false;
    } finally {
      if (pdf) {
        try {
          await pdf.destroy();
        } catch (destroyError) {
          console.warn(
            "PDF destroy warning:",
            destroyError
          );
        }
      }
    }
  }

  // ========================================================
  // UPLOAD / REPLACE
  // ========================================================

  async function handleUpload(event) {
    event.preventDefault();

    setMessage("");
    setMessageType("");

    // ------------------------------------------------------
    // Validation
    // ------------------------------------------------------

    if (!session?.user) {
      setMessage(
        "Your admin session has expired. Please sign in again."
      );
      setMessageType("error");
      return;
    }

    if (!isAdmin) {
      setMessage(
        "You do not have administrator access."
      );
      setMessageType("error");
      return;
    }

    if (!date) {
      setMessage(
        "Please select a newspaper date."
      );
      setMessageType("error");
      return;
    }

    if (!file) {
      setMessage(
        "Please select a PDF file."
      );
      setMessageType("error");
      return;
    }

    // ------------------------------------------------------
    // Double-check PDF
    // ------------------------------------------------------

    const fileName = String(
      file.name || ""
    ).toLowerCase();

    const fileType = String(
      file.type || ""
    ).toLowerCase();

    const isPdf =
      fileType === "application/pdf" ||
      fileName.endsWith(".pdf");

    if (!isPdf) {
      setMessage(
        "Please select a PDF file only."
      );
      setMessageType("error");
      return;
    }

    try {
      setUploading(true);

      const filePath = `${date}.pdf`;

      console.log(
        "================================="
      );
      console.log("STARTING NEWSPAPER UPLOAD");
      console.log("Date:", date);
      console.log("File:", file.name);
      console.log("Size:", file.size);
      console.log(
        "Existing edition:",
        !!existingEdition
      );
      console.log(
        "File path:",
        filePath
      );
      console.log(
        "================================="
      );

      // ====================================================
      // REPLACE EXISTING EDITION
      // ====================================================

      if (existingEdition) {
        setMessage(
          "Replacing existing newspaper..."
        );
        setMessageType("info");

        const {
          error: storageError,
        } = await supabase.storage
          .from("newspapers")
          .update(
            filePath,
            file,
            {
              cacheControl: "3600",
              contentType: "application/pdf",
              upsert: true,
            }
          );

        if (storageError) {
          console.error(
            "Storage replacement error:",
            storageError
          );

          throw storageError;
        }

        console.log(
          "PDF replaced successfully."
        );

        // --------------------------------------------------
        // Update database record
        // --------------------------------------------------

        const {
          error: updateEditionError,
        } = await supabase
          .from("editions")
          .update({
            pdf_path: filePath,
          })
          .eq(
            "id",
            existingEdition.id
          );

        if (updateEditionError) {
          console.error(
            "Edition update error:",
            updateEditionError
          );

          throw updateEditionError;
        }

        console.log(
          "Edition database record updated."
        );

        // --------------------------------------------------
        // Thumbnail
        // --------------------------------------------------

        const thumbnailCreated =
          await generateAndUploadThumbnail(
            file,
            date
          );

        if (!thumbnailCreated) {
          setMessage(
            `${date} replaced successfully, but the thumbnail could not be generated.`
          );
          setMessageType("info");
        } else {
          setMessage(
            `${date} newspaper replaced successfully.`
          );
          setMessageType("success");
        }

        // --------------------------------------------------
        // Refresh edition
        // --------------------------------------------------

        await checkEdition(date);

        // Keep successful replacement message
        if (thumbnailCreated) {
          setMessage(
            `${date} newspaper replaced successfully.`
          );
          setMessageType("success");
        }

        // --------------------------------------------------
        // Clear selected file
        // --------------------------------------------------

        setFile(null);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        return;
      }

      // ====================================================
      // NEW EDITION
      // ====================================================

      setMessage(
        "Uploading newspaper PDF..."
      );
      setMessageType("info");

      const {
        error: uploadError,
      } = await supabase.storage
        .from("newspapers")
        .upload(
          filePath,
          file,
          {
            cacheControl: "3600",
            contentType: "application/pdf",
            upsert: false,
          }
        );

      if (uploadError) {
        console.error(
          "PDF upload error:",
          uploadError
        );

        throw uploadError;
      }

      console.log(
        "PDF uploaded successfully."
      );

      // ====================================================
      // SAVE EDITION IN DATABASE
      // ====================================================

      const {
        data: insertedEdition,
        error: insertError,
      } = await supabase
        .from("editions")
        .insert({
          date,
          title: "SHUBHODAYAM BHARATH",
          pdf_path: filePath,
        })
        .select()
        .single();

      if (insertError) {
        console.error(
          "Edition insert error:",
          insertError
        );

        // If DB insert fails, remove uploaded PDF
        try {
          await supabase.storage
            .from("newspapers")
            .remove([filePath]);
        } catch (removeError) {
          console.error(
            "Failed to remove uploaded PDF after DB error:",
            removeError
          );
        }

        throw insertError;
      }

      console.log(
        "Edition saved successfully:",
        insertedEdition
      );

      // ====================================================
      // GENERATE THUMBNAIL
      // ====================================================

      setMessage(
        "Generating newspaper thumbnail..."
      );
      setMessageType("info");

      const thumbnailCreated =
        await generateAndUploadThumbnail(
          file,
          date
        );

      // ====================================================
      // SUCCESS
      // ====================================================

      if (thumbnailCreated) {
        setMessage(
          `${date} newspaper uploaded successfully.`
        );
        setMessageType("success");
      } else {
        setMessage(
          `${date} newspaper uploaded successfully, but the thumbnail could not be generated.`
        );
        setMessageType("info");
      }

      // Refresh existing edition state
      await checkEdition(date);

      // Keep correct final message
      if (thumbnailCreated) {
        setMessage(
          `${date} newspaper uploaded successfully.`
        );
        setMessageType("success");
      } else {
        setMessage(
          `${date} newspaper uploaded successfully, but the thumbnail could not be generated.`
        );
        setMessageType("info");
      }

      // Clear selected file
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error(
        "================================="
      );
      console.error(
        "NEWSPAPER UPLOAD FAILED"
      );
      console.error(error);
      console.error(
        "================================="
      );

      let errorMessage =
        "Newspaper upload failed.";

      if (error?.message) {
        errorMessage =
          `Newspaper upload failed: ${error.message}`;
      }

      setMessage(errorMessage);
      setMessageType("error");
    } finally {
      setUploading(false);
    }
  }

  // ========================================================
  // DELETE EDITION
  // ========================================================

  async function handleDelete() {
    if (!session?.user) {
      setMessage(
        "Your admin session has expired. Please sign in again."
      );
      setMessageType("error");
      return;
    }

    if (!isAdmin) {
      setMessage(
        "You do not have administrator access."
      );
      setMessageType("error");
      return;
    }

    if (!existingEdition) {
      setMessage(
        "There is no newspaper to delete for this date."
      );
      setMessageType("error");
      return;
    }

    const confirmed =
      window.confirm(
        `Are you sure you want to delete the newspaper for ${date}? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);

      setMessage(
        "Deleting newspaper..."
      );
      setMessageType("info");

      const filePath =
        existingEdition.pdf_path ||
        `${date}.pdf`;

      // ------------------------------------------------------
      // Delete PDF
      // ------------------------------------------------------

      const {
        error: storageDeleteError,
      } = await supabase.storage
        .from("newspapers")
        .remove([filePath]);

      if (storageDeleteError) {
        console.error(
          "PDF delete error:",
          storageDeleteError
        );

        throw storageDeleteError;
      }

      console.log(
        "PDF deleted:",
        filePath
      );

      // ------------------------------------------------------
      // Delete thumbnail
      // ------------------------------------------------------

      const thumbnailPath =
        `thumbnails/${date}.jpg`;

      const {
        error: thumbnailDeleteError,
      } = await supabase.storage
        .from("newspapers")
        .remove([
          thumbnailPath,
        ]);

      if (thumbnailDeleteError) {
        console.warn(
          "Thumbnail delete warning:",
          thumbnailDeleteError
        );
      }

      // ------------------------------------------------------
      // Delete database edition
      // ------------------------------------------------------

      const {
        error: editionDeleteError,
      } = await supabase
        .from("editions")
        .delete()
        .eq(
          "id",
          existingEdition.id
        );

      if (editionDeleteError) {
        console.error(
          "Edition database delete error:",
          editionDeleteError
        );

        throw editionDeleteError;
      }

      console.log(
        "Edition deleted from database."
      );

      // ------------------------------------------------------
      // Clear state
      // ------------------------------------------------------

      setExistingEdition(null);
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setMessage(
        `${date} newspaper deleted successfully.`
      );
      setMessageType("success");
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      setMessage(
        error?.message
          ? `Delete failed: ${error.message}`
          : "Newspaper deletion failed."
      );

      setMessageType("error");
    } finally {
      setDeleting(false);
    }
  }

  // ========================================================
  // LOGOUT
  // ========================================================

  async function handleLogout() {
    try {
      await supabase.auth.signOut();

      setSession(null);
      setIsAdmin(false);
      setFile(null);
      setExistingEdition(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );

      setMessage(
        "Unable to sign out."
      );
      setMessageType("error");
    }
  }

  // ========================================================
  // LOADING
  // ========================================================

  if (checkingAdmin) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#f5f7fb",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            padding: "32px",
            borderRadius: "16px",
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              margin: "0 0 10px",
            }}
          >
            Checking Admin Access
          </h2>

          <p
            style={{
              margin: 0,
              color: "#666",
            }}
          >
            Please wait...
          </p>
        </div>
      </div>
    );
  }

  // ========================================================
  // NOT LOGGED IN
  // ========================================================

  if (!session) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#f5f7fb",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "500px",
            background: "#ffffff",
            padding: "32px",
            borderRadius: "18px",
            boxShadow:
              "0 10px 35px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              marginTop: 0,
              marginBottom: "10px",
            }}
          >
            Shubhodayam Bharath
          </h1>

          <p
            style={{
              color: "#666",
              marginBottom: "24px",
            }}
          >
            Admin access required.
          </p>

          <Link
            to="/admin/login"
            style={{
              display: "inline-block",
              padding: "12px 22px",
              borderRadius: "10px",
              textDecoration: "none",
              background: "#111827",
              color: "#ffffff",
              fontWeight: 600,
            }}
          >
            Go to Admin Login
          </Link>
        </div>
      </div>
    );
  }

  // ========================================================
  // NOT ADMIN
  // ========================================================

  if (!isAdmin) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#f5f7fb",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "500px",
            background: "#ffffff",
            padding: "32px",
            borderRadius: "18px",
            boxShadow:
              "0 10px 35px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              marginTop: 0,
            }}
          >
            Access Denied
          </h1>

          <p
            style={{
              color: "#666",
            }}
          >
            Your account does not have administrator
            permission.
          </p>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              marginTop: "20px",
              padding: "12px 22px",
              border: "none",
              borderRadius: "10px",
              background: "#111827",
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ========================================================
  // MAIN ADMIN PAGE
  // ========================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "24px 16px 50px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        {/* ==================================================
            HEADER
        ================================================== */}

        <div
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            padding: "24px",
            marginBottom: "18px",
            boxShadow:
              "0 8px 30px rgba(0,0,0,0.07)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "15px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "28px",
                }}
              >
                Shubhodayam Bharath
              </h1>

              <p
                style={{
                  margin:
                    "6px 0 0",
                  color: "#666",
                }}
              >
                Newspaper Administration
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={
                uploading || deleting
              }
              style={{
                padding:
                  "10px 18px",
                border: "none",
                borderRadius: "9px",
                background: "#111827",
                color: "#ffffff",
                fontWeight: 600,
                cursor:
                  uploading || deleting
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  uploading || deleting
                    ? 0.6
                    : 1,
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* ==================================================
            ADMIN FORM
        ================================================== */}

        <form
          onSubmit={handleUpload}
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            padding: "24px",
            boxShadow:
              "0 8px 30px rgba(0,0,0,0.07)",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: "22px",
            }}
          >
            Upload Newspaper
          </h2>

          {/* =================================================
              DATE
          ================================================= */}

          <div
            style={{
              marginBottom: "20px",
            }}
          >
            <label
              htmlFor="newspaper-date"
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: 600,
              }}
            >
              Newspaper Date
            </label>

            <input
              id="newspaper-date"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setFile(null);

                if (fileInputRef.current) {
                  fileInputRef.current.value =
                    "";
                }

                setMessage("");
                setMessageType("");
              }}
              disabled={
                uploading || deleting
              }
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px 14px",
                border:
                  "1px solid #d1d5db",
                borderRadius: "10px",
                fontSize: "16px",
                background:
                  uploading || deleting
                    ? "#f3f4f6"
                    : "#ffffff",
              }}
            />

            {checkingEdition && (
              <p
                style={{
                  margin:
                    "8px 0 0",
                  color: "#666",
                  fontSize: "14px",
                }}
              >
                Checking this date...
              </p>
            )}
          </div>

          {/* =================================================
              FILE
          ================================================= */}

          <div
            style={{
              marginBottom: "20px",
            }}
          >
            <label
              htmlFor="newspaper-pdf"
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: 600,
              }}
            >
              Newspaper PDF
            </label>

            <input
              ref={fileInputRef}
              id="newspaper-pdf"
              type="file"
              accept=".pdf,application/pdf"
              onClick={(event) => {
                // Important for mobile browsers:
                // allows selecting the same PDF again.
                event.currentTarget.value = "";
              }}
              onChange={handleFileChange}
              disabled={
                uploading || deleting
              }
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px",
                border:
                  "1px solid #d1d5db",
                borderRadius: "10px",
                background:
                  uploading || deleting
                    ? "#f3f4f6"
                    : "#ffffff",
                fontSize: "15px",
              }}
            />

            {/* Selected file */}
            {file && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "13px 14px",
                  borderRadius: "10px",
                  background: "#ecfdf5",
                  border:
                    "1px solid #a7f3d0",
                  color: "#065f46",
                  wordBreak: "break-word",
                }}
              >
                <strong>
                  ✓ Selected PDF
                </strong>

                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "14px",
                  }}
                >
                  {file.name}
                </div>

                <div
                  style={{
                    marginTop: "3px",
                    fontSize: "13px",
                    opacity: 0.8,
                  }}
                >
                  {(
                    file.size /
                    (1024 * 1024)
                  ).toFixed(2)}{" "}
                  MB
                </div>
              </div>
            )}
          </div>

          {/* =================================================
              EXISTING EDITION INFO
          ================================================= */}

          {existingEdition && (
            <div
              style={{
                marginBottom: "20px",
                padding: "15px",
                borderRadius: "10px",
                background: "#fffbeb",
                border:
                  "1px solid #fde68a",
                color: "#92400e",
              }}
            >
              <strong>
                Newspaper already exists
              </strong>

              <p
                style={{
                  margin:
                    "6px 0 0",
                  fontSize: "14px",
                }}
              >
                A newspaper for{" "}
                <strong>
                  {date}
                </strong>{" "}
                already exists. Uploading will
                replace the existing PDF.
              </p>
            </div>
          )}

          {/* =================================================
              NEW EDITION INFO
          ================================================= */}

          {date &&
            !existingEdition &&
            !checkingEdition && (
              <div
                style={{
                  marginBottom: "20px",
                  padding: "15px",
                  borderRadius: "10px",
                  background: "#ecfdf5",
                  border:
                    "1px solid #a7f3d0",
                  color: "#065f46",
                }}
              >
                <strong>
                  ✓ Date available
                </strong>

                <p
                  style={{
                    margin:
                      "6px 0 0",
                    fontSize: "14px",
                  }}
                >
                  No newspaper exists for{" "}
                  <strong>
                    {date}
                  </strong>
                  .
                </p>
              </div>
            )}

          {/* =================================================
              MESSAGE
          ================================================= */}

          {message && (
            <div
              style={{
                marginBottom: "20px",
                padding: "14px 15px",
                borderRadius: "10px",

                background:
                  messageType === "error"
                    ? "#fef2f2"
                    : messageType === "info"
                    ? "#eff6ff"
                    : "#ecfdf5",

                border:
                  messageType === "error"
                    ? "1px solid #fecaca"
                    : messageType === "info"
                    ? "1px solid #bfdbfe"
                    : "1px solid #a7f3d0",

                color:
                  messageType === "error"
                    ? "#991b1b"
                    : messageType === "info"
                    ? "#1e40af"
                    : "#065f46",

                wordBreak:
                  "break-word",
              }}
            >
              {message}
            </div>
          )}

          {/* =================================================
              BUTTONS
          ================================================= */}

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="submit"
              disabled={
                uploading ||
                deleting ||
                checkingEdition ||
                !date ||
                !file
              }
              style={{
                flex: "1 1 220px",
                minHeight: "48px",
                padding:
                  "12px 20px",
                border: "none",
                borderRadius: "10px",
                background:
                  uploading ||
                  deleting ||
                  checkingEdition ||
                  !date ||
                  !file
                    ? "#9ca3af"
                    : "#111827",
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: 700,
                cursor:
                  uploading ||
                  deleting ||
                  checkingEdition ||
                  !date ||
                  !file
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {uploading
                ? "Uploading..."
                : existingEdition
                ? "Replace Newspaper"
                : "Upload Newspaper"}
            </button>

            {existingEdition && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={
                  uploading || deleting
                }
                style={{
                  flex:
                    "1 1 160px",
                  minHeight: "48px",
                  padding:
                    "12px 20px",
                  border:
                    "1px solid #dc2626",
                  borderRadius: "10px",
                  background:
                    uploading ||
                    deleting
                      ? "#f3f4f6"
                      : "#ffffff",
                  color: "#dc2626",
                  fontSize: "16px",
                  fontWeight: 700,
                  cursor:
                    uploading ||
                    deleting
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {deleting
                  ? "Deleting..."
                  : "Delete Newspaper"}
              </button>
            )}
          </div>

          {/* =================================================
              MOBILE HELP
          ================================================= */}

          <div
            style={{
              marginTop: "20px",
              padding: "13px 14px",
              borderRadius: "10px",
              background: "#f8fafc",
              border:
                "1px solid #e2e8f0",
              color: "#475569",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            <strong>
              Mobile upload:
            </strong>{" "}
            On Android or iPhone, tap the PDF field and
            select your newspaper PDF from the device's
            Files/Downloads app. After selection, the
            filename should appear above the Upload button.
          </div>
        </form>

        {/* ==================================================
            BACK TO WEBSITE
        ================================================== */}

        <div
          style={{
            textAlign: "center",
            marginTop: "22px",
          }}
        >
          <Link
            to="/"
            style={{
              color: "#374151",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            ← Back to Website
          </Link>
        </div>
      </div>
    </div>
  );
}