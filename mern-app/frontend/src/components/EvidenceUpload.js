import React, { useRef } from "react";
import PropTypes from "prop-types";

/**
 * EvidenceUpload is a modular file upload component for evidence documents.
 * Props:
 *   onUpload(files: FileList) - called when files are selected
 *   onDelete(filename: string) - called when a file is deleted
 *   evidenceList: array of { name: string, url?: string }
 *   uploadStatus: object mapping filenames to status {progress: number, state: 'uploading'|'complete'|'error'}
 */
const EvidenceUpload = ({ onUpload, onDelete, evidenceList, uploadStatus }) => {
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

  const renderFileStatus = (filename) => {
    console.log(`[DEBUG] renderFileStatus for ${filename}, uploadStatus:`, uploadStatus);

    // Always show some status info even if we don't have an entry in uploadStatus
    const status = uploadStatus?.[filename];

    // Force display of status for debugging
    const testStatus = {
      uploading: { progress: 45, state: 'uploading' },
      extracting: { progress: 100, state: 'extracting' },
      processed: { progress: 100, state: 'processed' },
      error: { progress: 0, state: 'error' },
      complete: { progress: 100, state: 'complete' }
    };

    // Uncomment this line to force a test status for all files
    // const forcedStatus = testStatus.uploading;

    if (!status) {
      console.log(`[DEBUG] No status found for ${filename}, defaulting to 'uploading'`);
      // If no status, assume uploading just started (for debugging)
      return (
        <span className="file-status default" aria-live="polite">
          <span className="govuk-tag govuk-tag--blue" style={{
            fontSize: '16px',
            padding: '4px 8px',
            fontWeight: 'bold',
            display: 'inline-block',
            marginLeft: '10px'
          }}>Uploading</span>
        </span>
      );
    }

    console.log(`[DEBUG] File status for ${filename}:`, status);

    if (status.state === 'uploading') {
      return (
        <span className="file-status uploading" aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <span className="govuk-tag govuk-tag--blue" style={{
            fontSize: '16px',
            padding: '4px 8px',
            fontWeight: 'bold',
            marginRight: '10px'
          }}>Uploading: {status.progress}%</span>
          <div className="progress-bar" style={{
            width: '150px',
            height: '12px',
            backgroundColor: '#f3f2f1',
            borderRadius: '4px',
            overflow: 'hidden',
            border: '1px solid #1d70b8'
          }}>
            <div
              className="progress-bar-fill"
              style={{
                width: `${status.progress}%`,
                height: '100%',
                backgroundColor: '#1d70b8'
              }}
              role="progressbar"
              aria-valuenow={status.progress}
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
        </span>
      );
    } else if (status.state === 'extracting') {
      return (
        <span className="file-status extracting" aria-live="polite">
          <span className="govuk-tag govuk-tag--orange" style={{
            fontSize: '16px',
            padding: '4px 8px',
            fontWeight: 'bold',
            display: 'inline-block',
            marginLeft: '10px'
          }}>Extracting data...</span>
        </span>
      );
    } else if (status.state === 'processed') {
      return <span className="file-status complete govuk-tag govuk-tag--green" style={{
        fontSize: '16px',
        padding: '4px 8px',
        fontWeight: 'bold',
        display: 'inline-block',
        marginLeft: '10px'
      }}>Processed</span>;
    } else if (status.state === 'extraction-failed') {
      return <span className="file-status error govuk-tag govuk-tag--red" style={{
        fontSize: '16px',
        padding: '4px 8px',
        fontWeight: 'bold',
        display: 'inline-block',
        marginLeft: '10px'
      }}>Extraction failed</span>;
    } else if (status.state === 'error') {
      return <span className="file-status error govuk-tag govuk-tag--red" style={{
        fontSize: '16px',
        padding: '4px 8px',
        fontWeight: 'bold',
        display: 'inline-block',
        marginLeft: '10px'
      }}>Failed to upload</span>;
    } else if (status.state === 'complete') {
      return <span className="file-status complete govuk-tag govuk-tag--green" style={{
        fontSize: '16px',
        padding: '4px 8px',
        fontWeight: 'bold',
        display: 'inline-block',
        marginLeft: '10px'
      }}>Uploaded</span>;
    }

    // Default fallback status
    return <span className="file-status unknown govuk-tag" style={{
      fontSize: '16px',
      padding: '4px 8px',
      fontWeight: 'bold',
      display: 'inline-block',
      marginLeft: '10px'
    }}>Status: {status.state || 'unknown'}</span>;
  };

  return (
    <div className="evidence-upload govuk-form-group">
      <label className="govuk-label" htmlFor="evidence-upload">Upload evidence documents</label>
      <div id="evidence-upload-hint" className="govuk-hint">
        You can upload multiple files. Accepted formats: PDF, JPG, PNG, DOCX. Maximum size: 25MB per file.
      </div>
      <div className="govuk-file-upload-container">
        <input
          id="evidence-upload"
          type="file"
          multiple
          className="govuk-file-upload"
          ref={fileInputRef}
          onChange={handleFileChange}
          aria-describedby="evidence-upload-hint"
          accept=".pdf,.jpg,.jpeg,.png,.docx"
        />
      </div>
      {evidenceList && evidenceList.length > 0 && (
        <div className="govuk-!-margin-top-4">
          <h3 className="govuk-heading-s">Uploaded files</h3>
          <ul className="govuk-list govuk-list--bullet govuk-!-margin-top-2" aria-live="polite">
            {evidenceList.map((file) => {
              console.log(`[DEBUG] Rendering file item for ${file.name}, upload status:`, uploadStatus?.[file.name]);
              return (
                <li key={file.name} className="govuk-!-margin-bottom-3 evidence-file-item">
                  <div className="evidence-file-container" style={{
                    padding: '12px',
                    border: '2px solid #1d70b8',
                    borderRadius: '5px',
                    backgroundColor: '#f8f8f8',
                    position: 'relative'
                  }}>
                    <div className="evidence-file-name" style={{
                      fontWeight: 'bold',
                      marginBottom: '8px'
                    }}>
                      {file.url ? (
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="govuk-link">{file.name}</a>
                      ) : (
                        <strong>{file.name}</strong>
                      )}
                    </div>

                    <div className="evidence-file-status" style={{
                      margin: '8px 0',
                      minHeight: '30px'
                    }}>
                      {renderFileStatus(file.name)}
                    </div>

                    <button
                      type="button"
                      className="govuk-button govuk-button--warning govuk-!-margin-top-2 govuk-!-margin-bottom-0"
                      onClick={() => handleDeleteClick(file.name)}
                      aria-label={`Delete ${file.name}`}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.9em',
                        display: 'inline-block',
                        marginLeft: '0'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <style>{`
            .evidence-file-container {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
            }
            .evidence-file-name {
              word-break: break-word;
              width: 100%;
            }
            .evidence-file-status {
              width: 100%;
            }
            .file-status {
              display: inline-flex;
              align-items: center;
            }
            .progress-bar {
              display: inline-block;
              width: 120px;
              height: 12px;
              background-color: #f3f2f1;
              border-radius: 4px;
              margin-left: 10px;
              vertical-align: middle;
              overflow: hidden;
              border: 1px solid #1d70b8;
            }
            .progress-bar-fill {
              height: 100%;
              background-color: #1d70b8;
              border-radius: 4px;
              transition: width 0.3s ease;
            }
            .govuk-tag--blue {
              background-color: #1d70b8;
              color: white;
              font-size: 16px !important;
              padding: 5px 8px !important;
              font-weight: bold;
            }
            .govuk-tag--orange {
              background-color: #f47738;
              color: white;
              font-size: 16px !important;
              padding: 5px 8px !important;
              font-weight: bold;
            }
            .govuk-tag--red {
              background-color: #d4351c;
              color: white;
              font-size: 16px !important;
              padding: 5px 8px !important;
              font-weight: bold;
            }
            .govuk-tag--green {
              background-color: #00703c;
              color: white;
              font-size: 16px !important;
              padding: 5px 8px !important;
              font-weight: bold;
            }
            @media (max-width: 640px) {
              .file-status {
                margin-left: 0;
                margin-top: 5px;
                margin-bottom: 5px;
              }
              .govuk-button--warning {
                margin-left: 0 !important;
                margin-top: 5px;
              }
            }
          `}</style>
        </div>
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
            .file-status {
              margin-left: 10px;
              vertical-align: middle;
              display: inline-flex;
              align-items: center;
            }
            .progress-bar {
              display: inline-block;
              width: 120px;
              height: 8px;
              background-color: #f3f2f1;
              border-radius: 4px;
              margin-left: 10px;
              vertical-align: middle;
              overflow: hidden;
            }
            .progress-bar-fill {
              height: 100%;
              background-color: #1d70b8;
              border-radius: 4px;
              transition: width 0.3s ease;
            }
            .govuk-tag--blue {
              background-color: #1d70b8;
              color: white;
              font-size: 14px;
              padding: 2px 6px;
              margin-right: 8px;
            }
            .govuk-tag--orange {
              background-color: #f47738;
              color: white;
              font-size: 14px;
              padding: 2px 6px;
              margin-right: 8px;
            }
            .govuk-tag--red {
              background-color: #d4351c;
              color: white;
              font-size: 14px;
              padding: 2px 6px;
            }
            .govuk-tag--green {
              background-color: #00703c;
              color: white;
              font-size: 14px;
              padding: 2px 6px;
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
  uploadStatus: PropTypes.objectOf(
    PropTypes.shape({
      progress: PropTypes.number,
      state: PropTypes.oneOf(['uploading', 'complete', 'error']),
    })
  ),
};

EvidenceUpload.defaultProps = {
  uploadStatus: {},
};

export default EvidenceUpload;
