import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function Admin() {
  const [session, setSession] = useState(null);

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [date, setDate] = useState("");
  const [file, setFile] = useState(null);

  const [existingEdition, setExistingEdition] = useState(null);
  const [checkingEdition, setCheckingEdition] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  /*
   * =========================================================
   * AUTHENTICATION + ADMIN CHECK
   * =========================================================
   */

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(session);

      if (session?.user) {
        await verifyAdmin(session);
      } else {
        setCheckingAdmin(false);
      }
    }

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);

        if (newSession?.user) {
          await verifyAdmin(newSession);
        } else {
          setIsAdmin(false);
          setCheckingAdmin(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function verifyAdmin(currentSession) {
    setCheckingAdmin(true);
    setIsAdmin(false);

    if (!currentSession?.user?.id) {
      setCheckingAdmin(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", currentSession.user.id)
        .maybeSingle();

      if (error) {
        console.error(
          "Admin verification error:",
          error
        );

        setMessage(
          "Unable to verify administrator access. Please try again."
        );

        setMessageType("error");

        return;
      }

      if (data?.user_id === currentSession.user.id) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error(
        "Admin verification error:",
        error
      );

      setMessage(
        "Unable to verify administrator access."
      );

      setMessageType("error");
    } finally {
      setCheckingAdmin(false);
    }
  }

  /*
   * =========================================================
   * CHECK SELECTED DATE
   * =========================================================
   */

  useEffect(() => {
    if (!date || !isAdmin) {
      setExistingEdition(null);
      return;
    }

    checkEdition(date);
  }, [date, isAdmin]);

  async function checkEdition(selectedDate) {
    setCheckingEdition(true);
    setExistingEdition(null);

    setMessage("");
    setMessageType("");

    try {
      const { data, error } = await supabase
        .from("editions")
        .select(
          "id, created_at, date, title, pdf_path"
        )
        .eq("date", selectedDate)
        .maybeSingle();

      if (error) {
        throw error;
      }

      console.log(
        "ADMIN DATE CHECK:",
        selectedDate
      );

      console.log(
        "ADMIN EDITION RESULT:",
        data
      );

      if (data) {
        setExistingEdition(data);

        setMessage(
          `A newspaper for ${selectedDate} already exists. You can replace or delete it.`
        );

        setMessageType("info");
      } else {
        setExistingEdition(null);
      }
    } catch (error) {
      console.error(
        "Edition check error:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to check the selected newspaper date."
      );

      setMessageType("error");
    } finally {
      setCheckingEdition(false);
    }
  }

  /*
   * =========================================================
   * FILE SELECTION
   * =========================================================
   */

  function handleFileChange(event) {
    const selectedFile =
      event.target.files?.[0];

    setMessage("");
    setMessageType("");

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const isPdf =
      selectedFile.type ===
        "application/pdf" ||
      selectedFile.name
        .toLowerCase()
        .endsWith(".pdf");

    if (!isPdf) {
      setFile(null);

      setMessage(
        "Please select a PDF file only."
      );

      setMessageType("error");

      event.target.value = "";

      return;
    }

    setFile(selectedFile);
  }

  /*
   * =========================================================
   * UPLOAD / REPLACE
   * =========================================================
   */

  async function handleUpload(event) {
    event.preventDefault();

    setMessage("");
    setMessageType("");

    if (!session || !isAdmin) {
      setMessage(
        "Administrator access is required."
      );

      setMessageType("error");

      return;
    }

    if (!date) {
      setMessage(
        "Please select the newspaper date."
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

    try {
      setUploading(true);

      const filePath = `${date}.pdf`;

      /*
       * =====================================================
       * REPLACE EXISTING NEWSPAPER
       * =====================================================
       */

      if (existingEdition) {
        /*
         * Replace existing PDF in Supabase Storage.
         *
         * IMPORTANT:
         * We use .update() here because the file
         * already exists.
         */

        const { error: uploadError } =
          await supabase.storage
            .from("newspapers")
            .update(
              filePath,
              file,
              {
                cacheControl: "3600",
                contentType:
                  "application/pdf",
              }
            );

        if (uploadError) {
          throw uploadError;
        }

        /*
         * Update the existing database row.
         */

        const {
          error: databaseError,
        } = await supabase
          .from("editions")
          .update({
            pdf_path: filePath,
          })
          .eq(
            "id",
            existingEdition.id
          );

        if (databaseError) {
          throw databaseError;
        }

        setMessage(
          `Newspaper for ${date} replaced successfully!`
        );

        setMessageType("success");
      }

      /*
       * =====================================================
       * UPLOAD NEW NEWSPAPER
       * =====================================================
       */

      else {
        /*
         * Upload PDF to Storage.
         */

        const { error: uploadError } =
          await supabase.storage
            .from("newspapers")
            .upload(
              filePath,
              file,
              {
                cacheControl: "3600",
                contentType:
                  "application/pdf",
                upsert: false,
              }
            );

        if (uploadError) {
          throw uploadError;
        }

        /*
         * Create database record.
         */

        const {
          error: databaseError,
        } = await supabase
          .from("editions")
          .insert([
            {
              date: date,
              title:
                "SHUBHODAYAM BHARATH",
              pdf_path: filePath,
            },
          ]);

        if (databaseError) {
          /*
           * If database insertion fails,
           * remove the uploaded PDF.
           */

          await supabase.storage
            .from("newspapers")
            .remove([filePath]);

          throw databaseError;
        }

        setMessage(
          `Newspaper for ${date} uploaded successfully!`
        );

        setMessageType("success");
      }

      /*
       * Refresh the selected date.
       */

      await checkEdition(date);

      /*
       * Clear selected file.
       */

      setFile(null);

      const fileInput =
        document.getElementById(
          "newspaper-pdf"
        );

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      console.error(
        "Admin upload/replace error:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save the newspaper."
      );

      setMessageType("error");
    } finally {
      setUploading(false);
    }
  }

  /*
   * =========================================================
   * DELETE NEWSPAPER
   * =========================================================
   */

  async function handleDelete() {
    if (!session || !isAdmin) {
      setMessage(
        "Administrator access is required."
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
        `Are you sure you want to permanently delete the newspaper for ${date}?\n\nThe PDF will be removed and this edition will disappear from the Calendar.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);

      setMessage("");
      setMessageType("");

      /*
       * Use the actual pdf_path stored
       * in the database.
       */

      const storagePath =
        existingEdition.pdf_path ||
        `${date}.pdf`;

      console.log(
        "DELETING STORAGE FILE:",
        storagePath
      );

      /*
       * =====================================================
       * DELETE PDF FROM STORAGE
       * =====================================================
       */

      const {
        error: storageError,
      } = await supabase.storage
        .from("newspapers")
        .remove([
          storagePath,
        ]);

      if (storageError) {
        throw storageError;
      }

      /*
       * =====================================================
       * DELETE EDITION FROM DATABASE
       * =====================================================
       */

      const {
        error: databaseError,
      } = await supabase
        .from("editions")
        .delete()
        .eq(
          "id",
          existingEdition.id
        );

      if (databaseError) {
        throw databaseError;
      }

      /*
       * Clear state.
       */

      setExistingEdition(null);
      setFile(null);

      const fileInput =
        document.getElementById(
          "newspaper-pdf"
        );

      if (fileInput) {
        fileInput.value = "";
      }

      setMessage(
        `Newspaper for ${date} deleted successfully.`
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "Admin delete error:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to delete the newspaper."
      );

      setMessageType("error");
    } finally {
      setDeleting(false);
    }
  }

  /*
   * =========================================================
   * LOGOUT
   * =========================================================
   */

  async function handleLogout() {
    await supabase.auth.signOut();

    setSession(null);
    setIsAdmin(false);
    setExistingEdition(null);
    setDate("");
    setFile(null);
  }

  /*
   * =========================================================
   * CHECKING ADMIN
   * =========================================================
   */

  if (checkingAdmin) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f7fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border:
              "1px solid #e1e6eb",
            borderRadius: 16,
            padding: 35,
            textAlign: "center",
            boxShadow:
              "0 8px 25px rgba(0,0,0,0.06)",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              color: "#123c69",
            }}
          >
            Checking Admin Access
          </h2>

          <p
            style={{
              color: "#6b7280",
              marginBottom: 0,
            }}
          >
            Please wait...
          </p>
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * NOT LOGGED IN
   * =========================================================
   */

  if (!session) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f7fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            background: "#ffffff",
            border:
              "1px solid #e1e6eb",
            borderRadius: 16,
            padding: 35,
            textAlign: "center",
            boxShadow:
              "0 8px 25px rgba(0,0,0,0.06)",
          }}
        >
          <h1
            style={{
              marginTop: 0,
              color: "#123c69",
              fontFamily:
                'Georgia, "Times New Roman", serif',
            }}
          >
            Admin Access
          </h1>

          <p
            style={{
              color: "#6b7280",
              lineHeight: 1.6,
            }}
          >
            You must be logged in as an
            administrator to manage newspaper
            editions.
          </p>

          <Link
            to="/"
            style={{
              display: "inline-block",
              marginTop: 15,
              background: "#123c69",
              color: "#ffffff",
              textDecoration: "none",
              padding: "11px 20px",
              borderRadius: 8,
              fontWeight: 700,
            }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * LOGGED IN BUT NOT ADMIN
   * =========================================================
   */

  if (!isAdmin) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f7fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            background: "#ffffff",
            border:
              "1px solid #fecaca",
            borderRadius: 16,
            padding: 35,
            textAlign: "center",
            boxShadow:
              "0 8px 25px rgba(0,0,0,0.06)",
          }}
        >
          <h1
            style={{
              marginTop: 0,
              color: "#b91c1c",
              fontFamily:
                'Georgia, "Times New Roman", serif',
            }}
          >
            Access Denied
          </h1>

          <p
            style={{
              color: "#6b7280",
              lineHeight: 1.6,
            }}
          >
            This account does not have
            administrator permissions.
          </p>

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: 20,
            }}
          >
            <Link
              to="/"
              style={{
                display: "inline-block",
                background: "#123c69",
                color: "#ffffff",
                textDecoration:
                  "none",
                padding: "11px 20px",
                borderRadius: 8,
                fontWeight: 700,
              }}
            >
              Back to Home
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                border: "none",
                background: "#b91c1c",
                color: "#ffffff",
                padding: "11px 20px",
                borderRadius: 8,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * ADMIN PAGE
   * =========================================================
   */

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fa",
        color: "#1f2937",
      }}
    >
      {/* HEADER */}

      <header
        style={{
          background: "#ffffff",
          borderBottom:
            "1px solid #e5e7eb",
          padding: "18px 6%",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#123c69",
              fontFamily:
                'Georgia, "Times New Roman", serif',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Shubhodayam Bharath
          </div>

          <div
            style={{
              color: "#6b7280",
              fontSize: 13,
              marginTop: 3,
            }}
          >
            Newspaper Administration
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/"
            style={navButtonStyle()}
          >
            Home
          </Link>

          <Link
            to="/calendar"
            style={navButtonStyle()}
          >
            Calendar
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              ...navButtonStyle(),
              border: "none",
              cursor: "pointer",
              background: "#b91c1c",
              color: "#ffffff",
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* MAIN */}

      <main
        style={{
          width: "min(700px, 92%)",
          margin: "0 auto",
          padding: "45px 0 70px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 30,
          }}
        >
          <div
            style={{
              color: "#167447",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.5,
            }}
          >
            ADMIN PANEL
          </div>

          <h1
            style={{
              margin:
                "7px 0 10px",
              color: "#123c69",
              fontFamily:
                'Georgia, "Times New Roman", serif',
              fontSize: 34,
            }}
          >
            Manage Newspaper
          </h1>

          <p
            style={{
              margin: 0,
              color: "#6b7280",
            }}
          >
            Upload, replace, or delete daily
            newspaper editions.
          </p>
        </div>

        {/* MANAGEMENT CARD */}

        <form
          onSubmit={handleUpload}
          style={{
            background: "#ffffff",
            border:
              "1px solid #dfe5eb",
            borderRadius: 16,
            padding: 30,
            boxShadow:
              "0 8px 25px rgba(0,0,0,0.06)",
          }}
        >
          {/* DATE */}

          <div
            style={{
              marginBottom: 24,
            }}
          >
            <label
              htmlFor="newspaper-date"
              style={labelStyle}
            >
              Newspaper Date
            </label>

            <input
              id="newspaper-date"
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
              style={inputStyle}
            />

            <p
              style={helpTextStyle}
            >
              Select the date printed on
              this newspaper.
            </p>
          </div>

          {/* CHECKING */}

          {date &&
            checkingEdition && (
              <div
                style={{
                  marginBottom: 22,
                  padding: 13,
                  borderRadius: 9,
                  background:
                    "#f1f5f9",
                  border:
                    "1px solid #dbe3ea",
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                Checking this date...
              </div>
            )}

          {/* EXISTING */}

          {date &&
            !checkingEdition &&
            existingEdition && (
              <div
                style={{
                  marginBottom: 22,
                  padding: 15,
                  borderRadius: 9,
                  background:
                    "#fff8e7",
                  border:
                    "1px solid #f5d58a",
                  color: "#8a5a00",
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                <strong>
                  Existing newspaper found
                </strong>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 13,
                  }}
                >
                  A newspaper already
                  exists for{" "}
                  <strong>
                    {date}
                  </strong>
                  . You can replace it
                  with a new PDF or delete
                  it.
                </div>

                {existingEdition.pdf_path && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "#9a6700",
                    }}
                  >
                    PDF:{" "}
                    {
                      existingEdition.pdf_path
                    }
                  </div>
                )}
              </div>
            )}

          {/* NO EXISTING */}

          {date &&
            !checkingEdition &&
            !existingEdition && (
              <div
                style={{
                  marginBottom: 22,
                  padding: 15,
                  borderRadius: 9,
                  background:
                    "#eef7f1",
                  border:
                    "1px solid #cce5d5",
                  color: "#167447",
                  fontSize: 14,
                }}
              >
                ✓ No newspaper exists for{" "}
                <strong>
                  {date}
                </strong>
                . You can upload a new
                edition.
              </div>
            )}

          {/* FILE */}

          <div
            style={{
              marginBottom: 24,
            }}
          >
            <label
              htmlFor="newspaper-pdf"
              style={labelStyle}
            >
              Newspaper PDF
            </label>

            <input
              id="newspaper-pdf"
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
              disabled={
                uploading ||
                deleting
              }
              style={{
                ...inputStyle,
                padding: 10,
                background:
                  "#fafafa",
              }}
            />

            {file && (
              <div
                style={{
                  marginTop: 10,
                  padding: 12,
                  background:
                    "#eef7f1",
                  border:
                    "1px solid #cce5d5",
                  borderRadius: 8,
                  color: "#167447",
                  fontSize: 13,
                  fontWeight: 600,
                  wordBreak:
                    "break-word",
                }}
              >
                ✓ Selected:{" "}
                {file.name}
              </div>
            )}

            <p
              style={helpTextStyle}
            >
              Only PDF files are accepted.
            </p>
          </div>

          {/* MESSAGE */}

          {message && (
            <div
              style={{
                marginBottom: 22,
                padding: 15,
                borderRadius: 9,
                background:
                  messageType ===
                  "success"
                    ? "#eef7f1"
                    : messageType ===
                      "info"
                    ? "#eff6ff"
                    : "#fff5f5",
                border:
                  messageType ===
                  "success"
                    ? "1px solid #b9dec6"
                    : messageType ===
                      "info"
                    ? "1px solid #bfdbfe"
                    : "1px solid #fecaca",
                color:
                  messageType ===
                  "success"
                    ? "#167447"
                    : messageType ===
                      "info"
                    ? "#1d4ed8"
                    : "#b91c1c",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {message}
            </div>
          )}

          {/* SAVE BUTTON */}

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
              width: "100%",
              border: "none",
              borderRadius: 9,
              padding:
                "14px 20px",
              background:
                uploading ||
                deleting ||
                checkingEdition ||
                !date ||
                !file
                  ? "#94a3b8"
                  : "#123c69",
              color: "#ffffff",
              fontSize: 15,
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
              ? existingEdition
                ? "Replacing newspaper..."
                : "Uploading newspaper..."
              : existingEdition
              ? "Replace Newspaper"
              : "Upload Newspaper"}
          </button>

          {/* DELETE BUTTON */}

          {existingEdition && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={
                uploading ||
                deleting ||
                checkingEdition
              }
              style={{
                width: "100%",
                border:
                  "1px solid #dc2626",
                borderRadius: 9,
                padding:
                  "13px 20px",
                marginTop: 12,
                background:
                  deleting ||
                  uploading ||
                  checkingEdition
                    ? "#fca5a5"
                    : "#ffffff",
                color:
                  deleting ||
                  uploading ||
                  checkingEdition
                    ? "#ffffff"
                    : "#b91c1c",
                fontSize: 15,
                fontWeight: 700,
                cursor:
                  deleting ||
                  uploading ||
                  checkingEdition
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {deleting
                ? "Deleting newspaper..."
                : "Delete Newspaper"}
            </button>
          )}
        </form>

        {/* INFORMATION */}

        <div
          style={{
            marginTop: 20,
            padding: 20,
            background: "#ffffff",
            border:
              "1px solid #e1e6eb",
            borderRadius: 12,
          }}
        >
          <strong
            style={{
              color: "#123c69",
            }}
          >
            Newspaper management
          </strong>

          <ol
            style={{
              marginBottom: 0,
              color: "#6b7280",
              lineHeight: 1.8,
              paddingLeft: 22,
            }}
          >
            <li>
              Select the newspaper date.
            </li>

            <li>
              If no edition exists,
              select a PDF and upload
              it.
            </li>

            <li>
              If an edition already
              exists, select a new PDF
              and replace it.
            </li>

            <li>
              Delete an existing
              newspaper using the
              Delete Newspaper button.
            </li>

            <li>
              Deleting removes the PDF
              from Supabase Storage and
              removes the edition from
              the Calendar.
            </li>

            <li>
              Only administrator
              accounts can perform these
              operations.
            </li>
          </ol>
        </div>
      </main>

      {/* FOOTER */}

      <footer
        style={{
          padding: 25,
          background: "#ffffff",
          borderTop:
            "1px solid #e5e7eb",
          textAlign: "center",
          color: "#6b7280",
          fontSize: 13,
        }}
      >
        ©️{" "}
        {new Date().getFullYear()}{" "}
        Shubhodayam Bharath
      </footer>
    </div>
  );
}

/*
 * =========================================================
 * STYLES
 * =========================================================
 */

function navButtonStyle() {
  return {
    display: "inline-block",
    textDecoration: "none",
    padding: "9px 14px",
    borderRadius: 7,
    background: "#eef3f8",
    color: "#123c69",
    fontWeight: 700,
    fontSize: 13,
  };
}

const labelStyle = {
  display: "block",
  marginBottom: 8,
  color: "#123c69",
  fontSize: 14,
  fontWeight: 700,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d1d9e2",
  borderRadius: 8,
  padding: "12px 13px",
  background: "#ffffff",
  color: "#1f2937",
  fontSize: 14,
};

const helpTextStyle = {
  margin: "7px 0 0",
  color: "#8a94a3",
  fontSize: 12,
};