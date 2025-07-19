import { getAISuggestions } from "../api/aiAgent";
import { extractFormData } from "../api/aiAgent.extract";
import React, { useState, useContext, useEffect, useCallback } from "react";
import { validatePostcode, validateNINO, validatePhoneNumber, validateEmail } from "../utils/validation";
import { useNavigate, useSearchParams, Link, useLocation } from "react-router-dom";
import AuthContext from "../auth/AuthContext";
import { autoSaveForm, getResumeData } from "../api";
import {
    getAllSectionStatuses,
    hasAnyProgress,
    saveSectionProgress,
    clearSectionProgress
} from "../utils/formProgress";
import { formSections, getConditionalFields } from '../data/formStructure';
import { clearFormData, loadFormData, saveFormData, saveFormStep, loadFormStep } from '../utils/formPersistence';
import ChatbotWidget from "../components/ChatbotWidget";
import EvidenceUpload from "../components/EvidenceUpload";
import { uploadEvidenceFile, deleteEvidenceFile, getEvidenceList } from "../api/evidence";

const FormPage = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({});
    const [errors, setErrors] = useState({});
    const [confirmationOpen, setConfirmationOpen] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [uploadedEvidence, setUploadedEvidence] = useState([]);
    const [uploadStatus, setUploadStatus] = useState({});
    const [evidenceUploading, setEvidenceUploading] = useState(false);
    const [evidenceError, setEvidenceError] = useState(null);
    const [evidenceWarning, setEvidenceWarning] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const { user, token } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const stepParam = searchParams.get('step');
    const location = useLocation();

    // Load form data from local storage
    useEffect(() => {
        // Fetch user data from local storage
        const savedFormData = loadFormData();
        if (savedFormData) {
            console.log('[FORM] Loaded saved form data:', savedFormData);
            setFormData(savedFormData);
        }

        // Set initial step from URL parameter or saved step
        const savedStep = loadFormStep();
        const initialStep = stepParam ? parseInt(stepParam, 10) : (savedStep || 1);
        setCurrentStep(initialStep);

        // Fetch any previously uploaded evidence
        fetchEvidenceList();

        setIsLoading(false);
    }, [stepParam]);

    // Fetch the list of previously uploaded evidence files
    const fetchEvidenceList = async () => {
        try {
            if (token) {
                console.log('[FORM] Fetching evidence list...');
                const evidenceFiles = await getEvidenceList(token);
                console.log('[FORM] Evidence files retrieved:', evidenceFiles);
                setUploadedEvidence(evidenceFiles);

                // Initialize upload status for existing files
                const initialStatus = {};
                evidenceFiles.forEach(file => {
                    initialStatus[file.name] = { progress: 100, state: 'complete' };
                });
                setUploadStatus(prev => ({ ...prev, ...initialStatus }));
            }
        } catch (err) {
            console.error('[FORM] Error fetching evidence list:', err);
            setEvidenceWarning('Could not retrieve previously uploaded evidence files. New uploads will still work.');
        }
    };

    // Handle changes to form inputs
    const handleChange = (e) => {
        const { name, value, type, checked, options, multiple } = e.target;

        if (type === 'checkbox') {
            if (multiple) {
                // Handle multiple checkboxes (e.g., evidence selection)
                const selectedValues = [...(formData[name] || [])];
                if (checked) {
                    if (!selectedValues.includes(value)) {
                        selectedValues.push(value);
                    }
                } else {
                    const index = selectedValues.indexOf(value);
                    if (index !== -1) {
                        selectedValues.splice(index, 1);
                    }
                }
                setFormData(prev => ({ ...prev, [name]: selectedValues }));
            } else {
                // Single checkbox
                setFormData(prev => ({ ...prev, [name]: checked }));
            }
        } else if (type === 'select-multiple') {
            const selectedOptions = Array.from(options)
                .filter(option => option.selected)
                .map(option => option.value);
            setFormData(prev => ({ ...prev, [name]: selectedOptions }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }

        // Clear any validation errors when the field is changed
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    // Handle file upload
    const handleEvidenceUpload = async (files) => {
        if (!files || files.length === 0) return;

        setEvidenceUploading(true);
        setEvidenceError(null);
        setEvidenceWarning(null);

        try {
            console.log(`[FORM] Starting upload of ${files.length} files`);

            // Process files sequentially, one at a time
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`[FORM] Uploading file ${i + 1}/${files.length}: ${file.name}`);

                // Initialize upload status for this file
                setUploadStatus(prev => ({
                    ...prev,
                    [file.name]: { progress: 0, state: 'uploading' }
                }));

                try {
                    // Upload the file with progress tracking
                    const uploadResult = await uploadEvidenceFile(file, token, (progress) => {
                        setUploadStatus(prev => ({
                            ...prev,
                            [file.name]: { progress, state: 'uploading' }
                        }));
                    });

                    console.log(`[FORM] Upload successful for ${file.name}:`, uploadResult);

                    // Update upload status to show we're extracting data
                    setUploadStatus(prev => ({
                        ...prev,
                        [file.name]: { progress: 100, state: 'extracting' }
                    }));

                    // Add the file to our list of uploaded evidence
                    setUploadedEvidence(prev => [...prev, uploadResult]);

                    // Extract data from the uploaded file
                    console.log(`[FORM] Extracting data from ${file.name}`);
                    try {
                        const extractionResult = await extractFormData(token, file.name);
                        console.log(`[FORM] Extraction result:`, extractionResult);

                        if (extractionResult && extractionResult.extracted) {
                            // Update the form data with extracted information
                            const extractedData = extractionResult.extracted;
                            setFormData(prev => ({
                                ...prev,
                                ...extractedData
                            }));

                            // Update upload status to show processing is complete
                            setUploadStatus(prev => ({
                                ...prev,
                                [file.name]: { progress: 100, state: 'processed' }
                            }));

                            console.log(`[FORM] Successfully extracted and updated form data from ${file.name}`);
                        } else {
                            console.warn(`[FORM] No data extracted from ${file.name}`);
                            setUploadStatus(prev => ({
                                ...prev,
                                [file.name]: { progress: 100, state: 'complete' }
                            }));
                        }
                    } catch (extractError) {
                        console.error(`[FORM] Error extracting data from ${file.name}:`, extractError);
                        setUploadStatus(prev => ({
                            ...prev,
                            [file.name]: { progress: 100, state: 'extraction-failed' }
                        }));
                        setEvidenceWarning(`Data extraction failed for ${file.name}, but the file was uploaded successfully.`);
                    }
                } catch (uploadError) {
                    console.error(`[FORM] Error uploading ${file.name}:`, uploadError);
                    setUploadStatus(prev => ({
                        ...prev,
                        [file.name]: { progress: 0, state: 'error' }
                    }));
                    setEvidenceError(`Failed to upload ${file.name}: ${uploadError.message}`);
                }
            }

            console.log(`[FORM] All files processed`);

            // Auto-save form data after extraction
            saveFormData(formData);

        } catch (err) {
            console.error('[FORM] Error processing files:', err);
            setEvidenceError(`Error processing files: ${err.message}`);
        } finally {
            setEvidenceUploading(false);
        }
    };

    // Handle evidence file deletion
    const handleEvidenceDelete = async (filename) => {
        try {
            console.log(`[FORM] Deleting evidence file: ${filename}`);
            await deleteEvidenceFile(filename, token);

            // Remove the file from the list
            setUploadedEvidence(prev => prev.filter(file => file.name !== filename));

            // Remove upload status for this file
            setUploadStatus(prev => {
                const newStatus = { ...prev };
                delete newStatus[filename];
                return newStatus;
            });

            console.log(`[FORM] Successfully deleted ${filename}`);
        } catch (err) {
            console.error(`[FORM] Error deleting ${filename}:`, err);
            setEvidenceError(`Failed to delete ${filename}: ${err.message}`);
        }
    };

    // Save the current form data
    const saveForm = useCallback(() => {
        saveFormData(formData);
        saveFormStep(currentStep);
        console.log('[FORM] Saved form data and step');
    }, [formData, currentStep]);

    // Auto-save form data periodically
    useEffect(() => {
        const interval = setInterval(saveForm, 30000); // Save every 30 seconds
        return () => clearInterval(interval);
    }, [saveForm]);

    // Handle navigation to next step
    const handleNext = () => {
        // Validate the current section
        const validationErrors = validateSection(currentStep);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            window.scrollTo(0, 0);
            return;
        }

        // Save form data and section progress
        saveForm();
        saveSectionProgress(currentStep, true);

        // Navigate to next step
        const nextStep = currentStep + 1;
        if (nextStep <= formSections.length) {
            setCurrentStep(nextStep);
            navigate(`?step=${nextStep}`, { replace: true });
            window.scrollTo(0, 0);
        }
    };

    // Handle navigation to previous step
    const handlePrevious = () => {
        saveForm();
        const prevStep = currentStep - 1;
        if (prevStep >= 1) {
            setCurrentStep(prevStep);
            navigate(`?step=${prevStep}`, { replace: true });
            window.scrollTo(0, 0);
        }
    };

    // Validate the current section
    const validateSection = (stepIndex) => {
        const idx = stepIndex - 1;
        const section = formSections[idx];
        if (!section) return {};

        const validationErrors = {};

        // Skip validation for the evidence section
        if (section.id === 'evidence-documentation') {
            return validationErrors;
        }

        // Validate each field in the section
        section.fields.forEach(field => {
            // Skip fields that are conditionally hidden
            const conditionalFields = getConditionalFields(formData);
            if (conditionalFields[field.name] === false) {
                return;
            }

            // Skip validation for optional fields
            if (!field.required) {
                return;
            }

            const value = formData[field.name];

            // Check if field is required but empty
            if (field.required && (value === undefined || value === null || value === '')) {
                validationErrors[field.name] = `${field.label} is required`;
                return;
            }

            // Validate based on field type
            if (field.type === 'email' && value) {
                if (!validateEmail(value)) {
                    validationErrors[field.name] = 'Enter a valid email address';
                }
            } else if (field.type === 'tel' && value) {
                if (!validatePhoneNumber(value)) {
                    validationErrors[field.name] = 'Enter a valid phone number';
                }
            } else if (field.name === 'postcode' && value) {
                if (!validatePostcode(value)) {
                    validationErrors[field.name] = 'Enter a valid UK postcode';
                }
            } else if (field.name === 'nino' && value) {
                if (!validateNINO(value)) {
                    validationErrors[field.name] = 'Enter a valid National Insurance number';
                }
            }
        });

        return validationErrors;
    };

    // Helper to render the current section
    const renderSection = () => {
        const idx = currentStep - 1;
        const section = formSections[idx];
        if (!section) return <div className="govuk-error-message">Unknown step</div>;

        // Special case: evidence section
        if (section.id === 'evidence-documentation') {
            return (
                <>
                    <h2 className="govuk-heading-l">{section.title}</h2>
                    <p className="govuk-body">You can upload your documents now or come back later. By uploading now, we will extract key data and prepopulate the form for you with any extractable information.</p>
                    <div className="govuk-form-group">
                        <fieldset className="govuk-fieldset">
                            <legend className="govuk-fieldset__legend">
                                Which documents can you provide? Select all that apply.
                            </legend>
                            <div className="govuk-checkboxes">
                                {section.fields[0].options.map(doc => (
                                    <div key={doc} className="govuk-checkboxes__item">
                                        <input
                                            className="govuk-checkboxes__input"
                                            id={`evidence-${doc.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                                            name="evidence"
                                            type="checkbox"
                                            value={doc}
                                            checked={formData.evidence && formData.evidence.includes(doc)}
                                            onChange={handleChange}
                                        />
                                        <label className="govuk-label govuk-checkboxes__label" htmlFor={`evidence-${doc.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}>
                                            {doc}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </fieldset>
                    </div>
                    <EvidenceUpload
                        onUpload={handleEvidenceUpload}
                        onDelete={handleEvidenceDelete}
                        evidenceList={uploadedEvidence}
                        uploadStatus={uploadStatus}
                    />
                    {console.log('[DEBUG] FormPage rendering with uploadStatus:', uploadStatus)}
                    {evidenceUploading && (
                        <div className="govuk-inset-text" aria-live="polite">
                            <p className="govuk-body">
                                <strong>Processing documents...</strong> Please wait while we upload and analyze your files.
                            </p>
                        </div>
                    )}
                    {evidenceError && (
                        <div className="govuk-error-message" id="evidence-error" role="alert" aria-live="assertive">
                            <span className="govuk-visually-hidden">Error:</span> {evidenceError}
                        </div>
                    )}
                    {evidenceWarning && (
                        <div className="govuk-warning-message" id="evidence-warning" role="status" aria-live="polite" style={{ color: '#594d00', backgroundColor: '#fff7bf', padding: '15px', marginBottom: '15px', border: '1px solid #ffdd00' }}>
                            <span className="govuk-visually-hidden">Warning:</span> {evidenceWarning}
                        </div>
                    )}
                    {aiLoading && <p className="govuk-body">Getting AI suggestions...</p>}
                    {aiError && <p className="govuk-error-message">{aiError}</p>}
                    {aiSuggestions && (
                        <div className="govuk-inset-text govuk-inset-text--suggested" style={{ borderLeft: '5px solid #ffbf47', background: '#fffbe6' }}>
                            <strong>Suggested by AI:</strong>
                            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#6f777b' }}>suggested: {aiSuggestions}</pre>
                            <p className="govuk-hint">You can edit or overwrite these suggestions.</p>
                        </div>
                    )}
                    <div className="govuk-inset-text">
                        <p className="govuk-body">You can upload your documents now or after submitting this application.</p>
                    </div>
                </>
            );
        }

        // Default: render fields for this section
        // Get the conditional visibility map for all fields
        const conditionalFields = getConditionalFields(formData);
        console.log('[FORM] Conditional fields for section:', section.title, conditionalFields);

        return (
            <>
                <h2 className="govuk-heading-l">{section.title}</h2>
                {section.intro && <p className="govuk-body">{section.intro}</p>}

                {section.fields.map(field => {
                    // Skip fields that are conditionally hidden
                    if (conditionalFields[field.name] === false) {
                        return null;
                    }

                    if (field.type === 'text' || field.type === 'date' || field.type === 'number' || field.type === 'email' || field.type === 'tel') {
                        return (
                            <div className={`govuk-form-group ${errors[field.name] ? 'govuk-form-group--error' : ''}`} key={field.name}>
                                <label className="govuk-label" htmlFor={field.name}>{field.label}</label>
                                {field.hint && <div className="govuk-hint">{field.hint}</div>}
                                {errors[field.name] && (
                                    <p id={`${field.name}-error`} className="govuk-error-message">
                                        <span className="govuk-visually-hidden">Error:</span> {errors[field.name]}
                                    </p>
                                )}
                                <input
                                    className={`govuk-input ${errors[field.name] ? 'govuk-input--error' : ''}`}
                                    id={field.name}
                                    name={field.name}
                                    type={field.type}
                                    value={formData[field.name] || ''}
                                    onChange={handleChange}
                                    aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
                                />
                            </div>
                        );
                    }

                    if (field.type === 'checkbox') {
                        return (
                            <div className={`govuk-form-group ${errors[field.name] ? 'govuk-form-group--error' : ''}`} key={field.name}>
                                <fieldset className="govuk-fieldset">
                                    <legend className="govuk-fieldset__legend">{field.label}</legend>
                                    {field.hint && <div className="govuk-hint">{field.hint}</div>}
                                    {errors[field.name] && (
                                        <p id={`${field.name}-error`} className="govuk-error-message">
                                            <span className="govuk-visually-hidden">Error:</span> {errors[field.name]}
                                        </p>
                                    )}
                                    <div className="govuk-checkboxes">
                                        {field.options.map(opt => (
                                            <div key={opt} className="govuk-checkboxes__item">
                                                <input
                                                    className="govuk-checkboxes__input"
                                                    id={`${field.name}-${opt.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                                                    name={field.name}
                                                    type="checkbox"
                                                    value={opt}
                                                    checked={Array.isArray(formData[field.name]) && formData[field.name].includes(opt)}
                                                    onChange={handleChange}
                                                    aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
                                                />
                                                <label className="govuk-label govuk-checkboxes__label" htmlFor={`${field.name}-${opt.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}>{opt}</label>
                                            </div>
                                        ))}
                                    </div>
                                </fieldset>
                            </div>
                        );
                    }

                    if (field.type === 'radio') {
                        return (
                            <div className={`govuk-form-group ${errors[field.name] ? 'govuk-form-group--error' : ''}`} key={field.name}>
                                <fieldset className="govuk-fieldset">
                                    <legend className="govuk-fieldset__legend">{field.label}</legend>
                                    {field.hint && <div className="govuk-hint">{field.hint}</div>}
                                    {errors[field.name] && (
                                        <p id={`${field.name}-error`} className="govuk-error-message">
                                            <span className="govuk-visually-hidden">Error:</span> {errors[field.name]}
                                        </p>
                                    )}
                                    <div className="govuk-radios">
                                        {field.options.map(opt => (
                                            <div key={opt} className="govuk-radios__item">
                                                <input
                                                    className="govuk-radios__input"
                                                    id={`${field.name}-${opt.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                                                    name={field.name}
                                                    type="radio"
                                                    value={opt}
                                                    checked={formData[field.name] === opt}
                                                    onChange={handleChange}
                                                    aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
                                                />
                                                <label className="govuk-label govuk-radios__label" htmlFor={`${field.name}-${opt.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}>{opt}</label>
                                            </div>
                                        ))}
                                    </div>
                                </fieldset>
                            </div>
                        );
                    }

                    if (field.type === 'select') {
                        return (
                            <div className={`govuk-form-group ${errors[field.name] ? 'govuk-form-group--error' : ''}`} key={field.name}>
                                <label className="govuk-label" htmlFor={field.name}>{field.label}</label>
                                {field.hint && <div className="govuk-hint">{field.hint}</div>}
                                {errors[field.name] && (
                                    <p id={`${field.name}-error`} className="govuk-error-message">
                                        <span className="govuk-visually-hidden">Error:</span> {errors[field.name]}
                                    </p>
                                )}
                                <select
                                    className={`govuk-select ${errors[field.name] ? 'govuk-select--error' : ''}`}
                                    id={field.name}
                                    name={field.name}
                                    value={formData[field.name] || ''}
                                    onChange={handleChange}
                                    aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
                                >
                                    <option value="">Please select</option>
                                    {field.options.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        );
                    }

                    if (field.type === 'textarea') {
                        return (
                            <div className={`govuk-form-group ${errors[field.name] ? 'govuk-form-group--error' : ''}`} key={field.name}>
                                <label className="govuk-label" htmlFor={field.name}>{field.label}</label>
                                {field.hint && <div className="govuk-hint">{field.hint}</div>}
                                {errors[field.name] && (
                                    <p id={`${field.name}-error`} className="govuk-error-message">
                                        <span className="govuk-visually-hidden">Error:</span> {errors[field.name]}
                                    </p>
                                )}
                                <textarea
                                    className={`govuk-textarea ${errors[field.name] ? 'govuk-textarea--error' : ''}`}
                                    id={field.name}
                                    name={field.name}
                                    rows={5}
                                    value={formData[field.name] || ''}
                                    onChange={handleChange}
                                    aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
                                ></textarea>
                            </div>
                        );
                    }

                    return null;
                })}
            </>
        );
    };

    // Determine if there are form-wide errors
    const hasErrors = Object.keys(errors).length > 0;

    // Render loading state
    if (isLoading) {
        return (
            <div className="govuk-width-container">
                <main className="govuk-main-wrapper" id="main-content" role="main">
                    <div className="govuk-grid-row">
                        <div className="govuk-grid-column-two-thirds">
                            <h1 className="govuk-heading-xl">Loading form...</h1>
                            <p className="govuk-body">Please wait while we load your form data.</p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="govuk-width-container">
            <main className="govuk-main-wrapper" id="main-content" role="main">
                <div className="govuk-grid-row">
                    <div className="govuk-grid-column-two-thirds">
                        {/* Form title */}
                        <h1 className="govuk-heading-xl">Funeral Expenses Payment application</h1>

                        {/* Error summary */}
                        {hasErrors && (
                            <div className="govuk-error-summary" aria-labelledby="error-summary-title" role="alert" tabIndex="-1">
                                <h2 className="govuk-error-summary__title" id="error-summary-title">
                                    There is a problem
                                </h2>
                                <div className="govuk-error-summary__body">
                                    <ul className="govuk-list govuk-error-summary__list">
                                        {Object.entries(errors).map(([field, message]) => (
                                            <li key={field}>
                                                <a href={`#${field}`}>{message}</a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Form section */}
                        <form>
                            {renderSection()}

                            {/* Navigation buttons */}
                            <div className="govuk-button-group">
                                {currentStep > 1 && (
                                    <button type="button" className="govuk-button govuk-button--secondary" onClick={handlePrevious}>
                                        Previous
                                    </button>
                                )}

                                {currentStep < formSections.length ? (
                                    <button type="button" className="govuk-button" onClick={handleNext}>
                                        Continue
                                    </button>
                                ) : (
                                    <button type="button" className="govuk-button" onClick={() => setConfirmationOpen(true)}>
                                        Submit application
                                    </button>
                                )}

                                <Link to="/task-list" className="govuk-link">
                                    Save and return to task list
                                </Link>
                            </div>
                        </form>
                    </div>

                    <div className="govuk-grid-column-one-third">
                        <ChatbotWidget />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default FormPage;
