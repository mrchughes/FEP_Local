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

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      fileInputRef.current.value = "";
    }
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
                onClick={() => onDelete(file.name)}
                aria-label={`Delete ${file.name}`}
                style={{ padding: '2px 8px', fontSize: '0.9em', verticalAlign: 'middle' }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
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
