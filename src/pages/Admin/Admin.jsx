import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.54/pdf.worker.min.mjs";

const R2_PUBLIC_BASE_URL =
  "https://pub-f9f048e0bee74489bafcef7bcbf0bec1.r2.dev";

function Admin() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [date, setDate] = useState("");
  const [pdfFile, setPdfFile] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [existingEdition, setExistingEdition] = useState(null);
  const [checkingEdition, setCheckingEdition] = useState(false);

  useEffect(() => {
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
        setCheckingSession(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkSession() {
    try {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          "Session error:",
          sessionError
        );
      }

      setSession(currentSession);
    } catch (err) {
      console.error(
        "Unable to get session:",
        err
      );
    } finally {
      setCheckingSession(false);
    }
  }

  useEffect(() => {
    if (!date) {
      setExistingEdition(null);
      return;
    }

    checkExistingEdition();
  }, [date]);

  async function checkExistingEdition() {
    setCheckingEdition(true);
    setExistingEdition(null);

    try {
      const {
        data,
        error: fetchError,
      } = await supabase
        .from("editions")
        .select("*")
        .eq("date", date)
        .maybeSingle();

      if (fetchError) {
        console.error(
          "Edition check error:",
          fetchError
        );
        return;
      }

      if (data) {
        setExistingEdition(data);
      }
    } catch (err) {
      console.error(
        "Edition check failed:",
        err
      );
    } finally {
      setCheckingEdition(false);
    }
  }

  function handleFileChange(event) {
    const file =
      event.target.files?.[0] || null;

    setPdfFile(file);
    setMessage("");
    setError("");

    if (
      file &&
      file.type !== "application/pdf"
    ) {
      setError(
        "Please select a PDF file."
      );
      setPdfFile(null);
    }
  }

  async function createThumbnail(file) {
    try {
      const arrayBuffer =
        await file.arrayBuffer();

      const pdf =
        await pdfjsLib.getDocument({
          data: arrayBuffer,
        }).promise;

      const page =
        await pdf.getPage(1);

      const viewport =
        page.getViewport({
          scale: 0.5,
        });

      const canvas =
        document.createElement("canvas");

      const context =
        canvas.getContext("2d");

      canvas.width =
        viewport.width;

      canvas.height =
        viewport.height;

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      return new Promise(
        (resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(
                  new Error(
                    "Unable to create thumbnail."
                  )
                );
              }
            },
            "image/jpeg",
            0.8
          );
        }
      );
    } catch (err) {
      console.error(
        "Thumbnail creation error:",
        err
      );

      return null;
    }
  }

  async function uploadThumbnail(
    thumbnailBlob,
    thumbnailPath
  ) {
    if (!thumbnailBlob) {
      return;
    }

    const {
      error: uploadError,
    } = await supabase.storage
      .from("newspapers")
      .upload(
        thumbnailPath,
        thumbnailBlob,
        {
          contentType:
            "image/jpeg",
          upsert: true,
        }
      );

    if (uploadError) {
      console.error(
        "Thumbnail upload error:",
        uploadError
      );
    }
  }

  async function getR2UploadUrl(
    fileName,
    currentSession
  ) {
    if (
      !currentSession?.access_token
    ) {
      throw new Error(
        "Your login session has expired. Please login again."
      );
    }

    const response =
      await fetch(
        "/api/R2Upload",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${currentSession.access_token}`,
          },

          body: JSON.stringify({
            fileName,
            contentType:
              "application/pdf",
          }),
        }
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch {
      throw new Error(
        `R2 server returned HTTP ${response.status}.`
      );
    }

    if (
      !response.ok ||
      !data?.success
    ) {
      throw new Error(
        data?.error ||
          `R2 upload request failed with HTTP ${response.status}.`
      );
    }

    if (!data.uploadUrl) {
      throw new Error(
        "R2 upload URL was not returned."
      );
    }

    return data;
  }

  async function uploadFileToR2(
    uploadUrl,
    file
  ) {
    const response =
      await fetch(
        uploadUrl,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/pdf",
          },

          body: file,
        }
      );

    if (!response.ok) {
      const responseText =
        await response.text();

      console.error(
        "R2 file upload failed:",
        responseText
      );

      throw new Error(
        `R2 PDF upload failed with HTTP ${response.status}.`
      );
    }
  }

  async function handleUpload() {
    setMessage("");
    setError("");

    if (!session) {
      setError(
        "Please login again."
      );
      return;
    }

    if (!date) {
      setError(
        "Please select a newspaper date."
      );
      return;
    }

    if (!pdfFile) {
      setError(
        "Please select a PDF file."
      );
      return;
    }

    if (
      pdfFile.type !==
      "application/pdf"
    ) {
      setError(
        "Only PDF files are allowed."
      );
      return;
    }

    setUploading(true);

    try {
      const fileName =
        `${date}.pdf`;

      const thumbnailPath =
        `thumbnails/${date}.jpg`;

      const thumbnailBlob =
        await createThumbnail(
          pdfFile
        );

      // =====================================================
      // EXISTING EDITION
      // =====================================================

      if (existingEdition) {
        const shouldReplace =
          window.confirm(
            `An edition already exists for ${date}.\n\nDo you want to replace it?`
          );

        if (!shouldReplace) {
          setUploading(false);
          return;
        }

        const r2Data =
          await getR2UploadUrl(
            fileName,
            session
          );

        await uploadFileToR2(
          r2Data.uploadUrl,
          pdfFile
        );

        const publicUrl =
          r2Data.publicUrl ||
          `${R2_PUBLIC_BASE_URL}/${encodeURIComponent(
            fileName
          )}`;

        await uploadThumbnail(
          thumbnailBlob,
          thumbnailPath
        );

        const {
          error: updateError,
        } = await supabase
          .from("editions")
          .update({
            title:
              "SHUBHODAYAM BHARATH",

            pdf_path:
              publicUrl,

          })
          .eq(
            "date",
            date
          );

        if (updateError) {
          console.error(
            "Edition update error:",
            updateError
          );

          throw new Error(
            updateError.message
          );
        }

        setMessage(
          `${date} newspaper replaced successfully.`
        );
      }

      // =====================================================
      // NEW EDITION
      // =====================================================

      else {
        const r2Data =
          await getR2UploadUrl(
            fileName,
            session
          );

        await uploadFileToR2(
          r2Data.uploadUrl,
          pdfFile
        );

        const publicUrl =
          r2Data.publicUrl ||
          `${R2_PUBLIC_BASE_URL}/${encodeURIComponent(
            fileName
          )}`;

        await uploadThumbnail(
          thumbnailBlob,
          thumbnailPath
        );

        const {
          data,
          error: insertError,
        } = await supabase
          .from("editions")
          .insert({
            date,

            title:
              "SHUBHODAYAM BHARATH",

            pdf_path:
              publicUrl,

          })
          .select()
          .single();

        if (insertError) {
          console.error(
            "Edition save error:",
            insertError
          );

          throw new Error(
            insertError.message
          );
        }

        console.log(
          "Edition saved:",
          data
        );

        setMessage(
          `${date} newspaper uploaded successfully.`
        );
      }

      setPdfFile(null);
      setExistingEdition(null);

      const fileInput =
        document.getElementById(
          "pdf-upload"
        );

      if (fileInput) {
        fileInput.value = "";
      }

      await checkExistingEdition();
    } catch (err) {
      console.error(
        "Newspaper upload failed:",
        err
      );

      setError(
        `Newspaper upload failed: ${
          err?.message ||
          "Unknown error"
        }`
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    setMessage("");
    setError("");

    if (!session) {
      setError(
        "Please login again."
      );
      return;
    }

    if (!date) {
      setError(
        "Please select a newspaper date."
      );
      return;
    }

    if (!existingEdition) {
      setError(
        "No newspaper edition exists for this date."
      );
      return;
    }

    const shouldDelete =
      window.confirm(
        `Are you sure you want to delete the ${date} newspaper?\n\nThis will remove the edition from the website.`
      );

    if (!shouldDelete) {
      return;
    }

    setDeleting(true);

    try {
      const filePath =
        existingEdition.pdf_path ||
        existingEdition.pdf_url ||
        existingEdition.pdfUrl ||
        "";

      // =====================================================
      // R2 DELETE
      // =====================================================

      if (
        filePath &&
        /\.r2\.dev\//i.test(
          filePath
        )
      ) {
        let r2FileName = "";

        try {
          const url =
            new URL(filePath);

          const pathname =
            url.pathname;

          r2FileName =
            decodeURIComponent(
              pathname
                .split("/")
                .filter(Boolean)
                .pop() || ""
            );
        } catch (urlError) {
          console.error(
            "Invalid R2 URL:",
            urlError
          );

          throw new Error(
            "Invalid R2 PDF URL."
          );
        }

        if (
          !r2FileName ||
          !r2FileName
            .toLowerCase()
            .endsWith(".pdf")
        ) {
          throw new Error(
            "Invalid R2 PDF file name."
          );
        }

        const response =
          await fetch(
            "/api/R2Delete",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${session.access_token}`,
              },

              body: JSON.stringify({
                fileName:
                  r2FileName,
              }),
            }
          );

        let data = null;

        try {
          data =
            await response.json();
        } catch {
          throw new Error(
            `R2 delete server returned HTTP ${response.status}.`
          );
        }

        if (
          !response.ok ||
          !data?.success
        ) {
          throw new Error(
            data?.error ||
              `R2 delete failed with HTTP ${response.status}.`
          );
        }

        console.log(
          "R2 PDF deleted:",
          r2FileName
        );
      }

      // =====================================================
      // OLD SUPABASE STORAGE DELETE
      // =====================================================

      else if (
        filePath
      ) {
        const storagePrefix =
          "/storage/v1/object/public/newspapers/";

        if (
          filePath.includes(
            storagePrefix
          )
        ) {
          const storagePath =
            filePath.split(
              storagePrefix
            )[1];

          if (storagePath) {
            const {
              error:
                storageDeleteError,
            } = await supabase.storage
              .from("newspapers")
              .remove([
                decodeURIComponent(
                  storagePath
                ),
              ]);

            if (
              storageDeleteError
            ) {
              console.error(
                "Supabase storage delete error:",
                storageDeleteError
              );
            }
          }
        }
      }

      // =====================================================
      // DELETE THUMBNAIL
      // =====================================================

      const thumbnailPath =
        existingEdition.thumbnail_path ||
        `thumbnails/${date}.jpg`;

      if (
        thumbnailPath
      ) {
        const {
          error:
            thumbnailDeleteError,
        } = await supabase.storage
          .from("newspapers")
          .remove([
            thumbnailPath,
          ]);

        if (
          thumbnailDeleteError
        ) {
          console.error(
            "Thumbnail delete error:",
            thumbnailDeleteError
          );
        }
      }

      // =====================================================
      // DELETE DATABASE ROW
      // =====================================================

      const {
        error: deleteError,
      } = await supabase
        .from("editions")
        .delete()
        .eq(
          "date",
          date
        );

      if (deleteError) {
        console.error(
          "Edition database delete error:",
          deleteError
        );

        throw new Error(
          deleteError.message
        );
      }

      setMessage(
        `${date} newspaper deleted successfully.`
      );

      setExistingEdition(
        null
      );

      setPdfFile(null);
    } catch (err) {
      console.error(
        "Newspaper deletion failed:",
        err
      );

      setError(
        `Newspaper deletion failed: ${
          err?.message ||
          "Unknown error"
        }`
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error(
        "Logout error:",
        err
      );
    }
  }

  if (checkingSession) {
    return (
      <div
        style={{
          maxWidth: "900px",
          margin: "40px auto",
          padding: "20px",
        }}
      >
        <h2>
          Checking admin session...
        </h2>
      </div>
    );
  }

  if (!session) {
    return (
      <div
        style={{
          maxWidth: "900px",
          margin: "40px auto",
          padding: "20px",
        }}
      >
        <h2>
          Admin login required
        </h2>

        <p>
          Please login to access
          the newspaper admin panel.
        </p>

        <button
          type="button"
          onClick={() => {
            window.location.href =
              "/admin/login";
          }}
          style={{
            padding:
              "10px 18px",
            cursor:
              "pointer",
          }}
        >
          Go to Admin Login
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "30px auto",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          marginBottom: "25px",
          gap: "15px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: "0 0 5px",
            }}
          >
            Shubhodayam Bharath
            Admin
          </h1>

          <p
            style={{
              margin: "0",
              color: "#666",
            }}
          >
            Newspaper Edition
            Management
          </p>
        </div>

        <button
          type="button"
          onClick={
            handleLogout
          }
          style={{
            padding:
              "9px 16px",
            cursor:
              "pointer",
          }}
        >
          Logout
        </button>
      </div>

      {message && (
        <div
          style={{
            marginBottom: "20px",
            padding: "12px 15px",
            border:
              "1px solid #b7dfb9",
            background:
              "#edf9ee",
            color:
              "#236b2a",
            borderRadius: "6px",
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: "20px",
            padding: "12px 15px",
            border:
              "1px solid #e5b5b5",
            background:
              "#fff0f0",
            color:
              "#a32121",
            borderRadius: "6px",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          border:
            "1px solid #ddd",
          borderRadius: "10px",
          padding: "20px",
          background: "#fff",
        }}
      >
        <div
          style={{
            marginBottom: "20px",
          }}
        >
          <label
            htmlFor="edition-date"
            style={{
              display: "block",
              fontWeight: "600",
              marginBottom: "8px",
            }}
          >
            Newspaper Date
          </label>

          <input
            id="edition-date"
            type="date"
            value={date}
            onChange={(event) =>
              setDate(
                event.target.value
              )
            }
            disabled={
              uploading ||
              deleting
            }
            style={{
              padding: "10px",
              width: "100%",
              maxWidth: "300px",
              boxSizing:
                "border-box",
            }}
          />
        </div>

        {checkingEdition && (
          <p
            style={{
              color: "#666",
            }}
          >
            Checking existing
            edition...
          </p>
        )}

        {existingEdition && (
          <div
            style={{
              marginBottom: "20px",
              padding: "15px",
              border:
                "1px solid #ddd",
              borderRadius: "6px",
              background: "#fafafa",
            }}
          >
            <strong>
              Edition already exists
            </strong>

            <p
              style={{
                margin:
                  "8px 0 0",
              }}
            >
              Date:{" "}
              {
                existingEdition.date
              }
            </p>

            {existingEdition.pdf_path && (
              <p
                style={{
                  margin:
                    "5px 0 0",
                  wordBreak:
                    "break-all",
                  fontSize:
                    "13px",
                  color:
                    "#666",
                }}
              >
                PDF:{" "}
                {
                  existingEdition.pdf_path
                }
              </p>
            )}

            <p
              style={{
                margin:
                  "10px 0 0",
                color:
                  "#9a5b00",
              }}
            >
              Uploading this date
              will replace the
              existing edition.
            </p>
          </div>
        )}

        <div
          style={{
            marginBottom: "20px",
          }}
        >
          <label
            htmlFor="pdf-upload"
            style={{
              display: "block",
              fontWeight: "600",
              marginBottom: "8px",
            }}
          >
            Newspaper PDF
          </label>

          <input
            id="pdf-upload"
            type="file"
            accept="application/pdf,.pdf"
            onChange={
              handleFileChange
            }
            disabled={
              uploading ||
              deleting
            }
          />

          {pdfFile && (
            <p
              style={{
                marginTop:
                  "8px",
                color:
                  "#555",
              }}
            >
              Selected:{" "}
              <strong>
                {pdfFile.name}
              </strong>
            </p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={
              handleUpload
            }
            disabled={
              uploading ||
              deleting ||
              checkingEdition
            }
            style={{
              padding:
                "11px 20px",
              cursor:
                uploading ||
                deleting
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
              onClick={
                handleDelete
              }
              disabled={
                uploading ||
                deleting
              }
              style={{
                padding:
                  "11px 20px",
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
      </div>
    </div>
  );
}

export default Admin;