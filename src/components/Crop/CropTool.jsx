import { useState } from "react"

function CropTool({ onClose }) {
  const [message, setMessage] = useState(
    "Upload a newspaper PDF first to use Crop."
  )

  return (
    <div className="crop-overlay">

      <div className="crop-panel">

        <div className="crop-header">
          <h2>Crop Newspaper</h2>

          <button
            type="button"
            className="crop-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="crop-preview">
          <p>{message}</p>
        </div>

        <div className="crop-actions">

          <button
            type="button"
            className="primary-button"
            disabled
          >
            Crop Selected Area
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={onClose}
          >
            Cancel
          </button>

        </div>

      </div>

    </div>
  )
}

export default CropTool