import React, { useRef } from "react";
import PropTypes from "prop-types";

/**
 * EvidenceUpload is a modular file upload component for evidence documents.
 * Props:
 *   onUpload(files: FileList) - called when files are selected
 *   onDelete(filename: string) - called when a file is deleted
 *   evidenceList: array of { name: string, url?: string }
 */
const EvidenceUpload = ({ onUpload, onDelete, evidenceList }) => {
  const fileInputRef = useRef();
  const [showModal, setShowModal] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteClick = (filename) => {
    setPendingDelete(filename);
    setShowModal(true);
  };

  const confirmDelete = () => {
    if (pendingDelete) {
      onDelete(pendingDelete);
      setPendingDelete(null);
      setShowModal(false);
    }
  };

  const cancelDelete = () => {
    setPendingDelete(null);
    setShowModal(false);
  };

  return (
    <div className="evidence-upload govuk-form-group">
      <label className="govuk-label" htmlFor="evidence-upload">Upload evidence documents</label>
      <input
        id="evidence-upload"
        type="file"
        multiple
        className="govuk-file-upload"
        ref={fileInputRef}
        onChange={handleFileChange}
        aria-describedby="evidence-upload-hint"
      />
      <div id="evidence-upload-hint" className="govuk-hint">
        You can upload multiple files. Accepted formats: PDF, JPG, PNG, DOCX.
      </div>
      {evidenceList && evidenceList.length > 0 && (
        <ul className="govuk-list govuk-list--bullet govuk-!-margin-top-2">
          {evidenceList.map((file) => (
            <li key={file.name} className="govuk-!-margin-bottom-2">
              {file.url ? (
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="govuk-link">{file.name}</a>
              ) : (
                file.name
              )}
              <button
                type="button"
                className="govuk-button govuk-button--warning govuk-!-margin-left-2 govuk-!-margin-bottom-0"
                onClick={() => handleDeleteClick(file.name)}
                aria-label={`Delete ${file.name}`}
                style={{ padding: '2px 8px', fontSize: '0.9em', verticalAlign: 'middle' }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* GDS Modal for delete confirmation */}
      {showModal && (
        <div className="govuk-modal-overlay">
          <div className="govuk-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex="-1">
            <h2 id="modal-title" className="govuk-heading-m">Are you sure you want to delete this file?</h2>
            <p className="govuk-body">This action cannot be undone.</p>
            <div className="govuk-button-group">
              <button className="govuk-button govuk-button--warning" onClick={confirmDelete} autoFocus>Delete</button>
              <button className="govuk-button govuk-button--secondary" onClick={cancelDelete}>Cancel</button>
            </div>
          </div>
          <style>{`
            .govuk-modal-overlay {
              position: fixed;
              top: 0; left: 0; right: 0; bottom: 0;
              background: rgba(0,0,0,0.5);
              z-index: 2000;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .govuk-modal {
              background: #fff;
              border-radius: 8px;
              padding: 32px 24px 24px 24px;
              max-width: 400px;
              width: 100%;
              box-shadow: 0 4px 24px rgba(0,0,0,0.2);
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

EvidenceUpload.propTypes = {
  onUpload: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  evidenceList: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      url: PropTypes.string,
    })
  ).isRequired,
};

export default EvidenceUpload;
