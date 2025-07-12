import { getAISuggestions } from "../api/aiAgent";
import { extractFormData } from "../api/aiAgent.extract";
import React, { useState, useContext, useEffect } from "react";
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
import { formSections } from '../data/formStructure';
import { clearFormData, loadFormData, saveFormData, saveFormStep, loadFormStep } from '../utils/formPersistence';
import ChatbotWidget from "../components/ChatbotWidget";
import EvidenceUpload from "../components/EvidenceUpload";
import { uploadEvidenceFile, deleteEvidenceFile } from "../api/evidence";

const FormPage = () => {
    // AI suggestions state
    const [aiSuggestions, setAISuggestions] = useState("");
    const [aiLoading, setAILoading] = useState(false);
    const [aiError, setAIError] = useState("");
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    // For evidence upload
    const [uploadedEvidence, setUploadedEvidence] = useState([]); // [{name, url}]
    const [evidenceUploading, setEvidenceUploading] = useState(false);
    const [evidenceError, setEvidenceError] = useState("");
    // Popup state for updated fields after ingest
    const [showUpdatedFieldsPopup, setShowUpdatedFieldsPopup] = useState(false);
    const [updatedFields, setUpdatedFields] = useState([]); // Form fields updated
    const [extractedFields, setExtractedFields] = useState([]); // Data fields extracted from files

    // Mapping from AI-extracted keys to form field keys
    const aiToFormFieldMap = {
        // Deceased details
        "Name of deceased": "deceasedFirstName", // Will split into first/last below
        "Date of death": "deceasedDateOfDeath",
        "Place of death": "deceasedPlaceOfDeath",
        "Cause of death": "deceasedCauseOfDeath",
        "Certifying doctor": "deceasedCertifyingDoctor",
        "Certificate issued": "deceasedCertificateIssued",
        // Applicant details
        "Name of applicant": "firstName", // Will split into first/last below
        "Claimant": "firstName", // Will split into first/last below
        "National Insurance Number": "nationalInsuranceNumber",
        "Address": "addressLine1", // Will split if possible
        // Funeral bill
        "Funeral Director": "funeralDirector",
        "Estimate number": "funeralEstimateNumber",
        "Date issued": "funeralDateIssued",
        "Total estimated cost": "funeralTotalEstimatedCost",
        "Description": "funeralDescription",
        "Contact": "funeralContact",
        // Relationship
        "Relationship": "relationshipToDeceased",
        "Supporting evidence": "supportingEvidence",
        // Responsibility
        "Applicant": "firstName", // Will split into first/last below
        "Relationship to deceased": "relationshipToDeceased",
        "Statement": "responsibilityStatement",
        "Date": "responsibilityDate",
        // Benefits
        "Benefit": "benefitType",
        "Reference number": "benefitReferenceNumber",
        "Letter date": "benefitLetterDate",
        // Specific benefits
        "Income Support": "householdBenefits",
        "Jobseeker's Allowance": "householdBenefits",
        "Employment and Support Allowance": "householdBenefits",
        "Universal Credit": "householdBenefits",
        "Pension Credit": "householdBenefits",
        // Details
        "Benefit details": "incomeSupportDetails",
        "Income Support details": "incomeSupportDetails"
    };

    // Helper to split full name into first/last
    function splitName(fullName) {
        if (!fullName) return { firstName: "", lastName: "" };
        const parts = fullName.trim().split(" ");
        if (parts.length === 1) return { firstName: parts[0], lastName: "" };
        return { firstName: parts.slice(0, -1).join(" "), lastName: parts.slice(-1).join(" ") };
    }

    // Handler for evidence upload
    const handleEvidenceUpload = (files) => {
        console.log('[EVIDENCE] handleEvidenceUpload called with files:', files);
        setEvidenceError("");
        setEvidenceUploading(true);
        const uploadAll = Array.from(files).map(async (file) => {
            try {
                const res = await uploadEvidenceFile(file, user?.token);
                setUploadedEvidence(prev => [...prev, { name: res.name, url: res.url }]);
            } catch (err) {
                setEvidenceError(`Failed to upload ${file.name}`);
            }
        });
        Promise.all(uploadAll).then(async (uploadResults) => {
            console.log('[EVIDENCE] All uploads complete, uploadResults:', uploadResults);
            // After all evidence is uploaded, call AI extraction
            try {
                const result = await extractFormData(user?.token);
                console.log('[EVIDENCE] AI extraction result:', result);

                // Check if result has expected format
                if (!result || !result.extracted) {
                    console.error('[EVIDENCE] Invalid extraction result format:', result);
                    setEvidenceError("AI extraction returned invalid data format");
                    return;
                }

                // result.extracted is an object: { filename: extractedJsonString }
                let merged = { ...formData };
                let changedFields = [];
                let extractedFieldInfo = {};
                let extractedFieldNames = new Set();
                Object.entries(result.extracted || {}).forEach(([filename, val]) => {
                    console.log(`[EVIDENCE] Processing extraction from ${filename}:`, val);
                    try {
                        let obj;
                        try {
                            // Handle string vs object response
                            obj = typeof val === 'string' ? JSON.parse(val) : val;
                        } catch (parseErr) {
                            console.error(`[EVIDENCE] Failed to parse JSON from ${filename}:`, parseErr);
                            console.error(`[EVIDENCE] Raw value:`, val);
                            return;
                        }
                        Object.entries(obj).forEach(([k, v]) => {
                            // v is expected to be { value, reasoning }
                            if (!v || !v.value) {
                                console.log(`[EVIDENCE] Skipping empty value for field: ${k}`);
                                return;
                            }
                            let mappedKey = aiToFormFieldMap[k] || k;
                            if (!aiToFormFieldMap[k]) {
                                const lowerK = k.toLowerCase();
                                const ciMatch = Object.keys(aiToFormFieldMap).find(
                                    key => key.toLowerCase() === lowerK
                                );
                                if (ciMatch) mappedKey = aiToFormFieldMap[ciMatch];
                            }
                            extractedFieldInfo[mappedKey] = { value: v.value, reasoning: v.reasoning };
                            extractedFieldNames.add(mappedKey);
                            // Special handling for names
                            if (["Name of deceased", "Name of applicant", "Claimant", "Applicant"].includes(k)) {
                                const { firstName, lastName } = splitName(v.value);
                                if (k === "Name of deceased") {
                                    if (merged.deceasedFirstName !== firstName) changedFields.push("deceasedFirstName");
                                    if (merged.deceasedLastName !== lastName) changedFields.push("deceasedLastName");
                                    merged.deceasedFirstName = firstName;
                                    merged.deceasedLastName = lastName;
                                } else {
                                    if (merged.firstName !== firstName) changedFields.push("firstName");
                                    if (merged.lastName !== lastName) changedFields.push("lastName");
                                    merged.firstName = firstName;
                                    merged.lastName = lastName;
                                }
                            } else if (k === "Address") {
                                const addressParts = v.value.split(',').map(part => part.trim());
                                if (addressParts.length === 3) {
                                    merged.addressLine1 = addressParts[0];
                                    merged.town = addressParts[1];
                                    merged.postcode = addressParts[2];
                                    changedFields.push("addressLine1", "town", "postcode");
                                } else if (addressParts.length === 2) {
                                    merged.addressLine1 = addressParts[0];
                                    merged.postcode = addressParts[1];
                                    changedFields.push("addressLine1", "postcode");
                                } else {
                                    merged.addressLine1 = v.value;
                                    changedFields.push("addressLine1");
                                }
                            } else if (["Income Support", "Jobseeker's Allowance", "Employment and Support Allowance", "Universal Credit", "Pension Credit"].includes(k)) {
                                if (!Array.isArray(merged.householdBenefits)) merged.householdBenefits = [];
                                if (!merged.householdBenefits.includes(k)) {
                                    merged.householdBenefits.push(k);
                                    changedFields.push("householdBenefits");
                                }
                            } else if (["Benefit details", "Income Support details"].includes(k)) {
                                if (merged[mappedKey] !== v.value) changedFields.push(mappedKey);
                                merged[mappedKey] = v.value;
                            } else {
                                if (merged[mappedKey] !== v.value) changedFields.push(mappedKey);
                                merged[mappedKey] = v.value;
                            }
                        });
                    } catch (e) {
                        // If not valid JSON, skip
                    }
                });
                console.log('[AI->FORM] Merged formData after mapping:', merged);
                try {
                    window.localStorage.setItem('debug_lastMergedFormData', JSON.stringify(merged));
                } catch (e) { }
                setFormData(merged);
                // Persist extracted data to backend for first-time ingest
                if ((extractedFieldNames.size > 0 || changedFields.length > 0) && user?.token) {
                    try {
                        console.log('[AI->FORM][DEBUG] About to call autoSaveForm with:', merged);
                        const saveResp = await autoSaveForm(merged, user.token);
                        console.log('[AI->FORM][DEBUG] autoSaveForm response:', saveResp);
                        console.log('[AI->FORM] Successfully saved extracted data to backend');
                    } catch (err) {
                        // Optionally show error to user
                        console.error('[AI->FORM][DEBUG] autoSaveForm error:', err);
                        console.warn('Failed to persist extracted data:', err);
                    }
                }
                if (Object.keys(extractedFieldInfo).length > 0 || changedFields.length > 0) {
                    console.log('[AI->FORM][POPUP] changedFields:', changedFields, 'merged:', merged);
                    setExtractedFields(extractedFieldInfo);
                    setUpdatedFields(changedFields);
                    setShowUpdatedFieldsPopup(true);
                } else {
                    console.log('[AI->FORM] No fields were extracted or changed');
                    setEvidenceError("No relevant data found in uploaded documents");
                }
            } catch (e) {
                console.error('[EVIDENCE] AI extraction error:', e);
                setEvidenceError(`AI extraction failed: ${e.message || "Unknown error"}`);
            }
        }).finally(() => setEvidenceUploading(false));
    };

    // Handler for evidence delete
    const handleEvidenceDelete = (filename) => {
        setEvidenceError("");
        setEvidenceUploading(true);
        deleteEvidenceFile(filename, user?.token)
            .then(() => setUploadedEvidence(prev => prev.filter(f => f.name !== filename)))
            .catch(() => setEvidenceError(`Failed to delete ${filename}`))
            .finally(() => setEvidenceUploading(false));
    };

    // Default form data structure
    const defaultFormData = {
        // Personal details
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        nationalInsuranceNumber: "",
        addressLine1: "",
        addressLine2: "",
        town: "",
        county: "",
        postcode: "",
        phoneNumber: "",
        email: "",

        // Partner details
        hasPartner: "",
        partnerFirstName: "",
        partnerLastName: "",
        partnerDateOfBirth: "",
        partnerNationalInsuranceNumber: "",
        partnerBenefitsReceived: [],
        partnerSavings: "",

        // Family composition and dependents
        hasChildren: "",
        numberOfChildren: "",
        childrenDetails: "",
        hasDependents: "",
        dependentsDetails: "",
        householdSize: "",
        householdMembers: "",

        // Enhanced benefits information
        householdBenefits: [],
        incomeSupportDetails: "",
        disabilityBenefits: [],
        carersAllowance: "",
        carersAllowanceDetails: "",

        // About the person who died
        deceasedFirstName: "",
        deceasedLastName: "",
        deceasedDateOfBirth: "",
        deceasedDateOfDeath: "",
        relationshipToDeceased: "",

        // Address of the person who died
        deceasedAddressLine1: "",
        deceasedAddressLine2: "",
        deceasedTown: "",
        deceasedCounty: "",
        deceasedPostcode: "",
        deceasedUsualAddress: "",

        // Responsibility for funeral arrangements
        responsibilityReason: "",
        nextOfKin: "",
        otherResponsiblePerson: "",

        // Funeral details
        funeralDirector: "",
        funeralCost: "",
        funeralDate: "",
        funeralLocation: "",
        burialOrCremation: "",

        // Estate and assets
        estateValue: "",
        propertyOwned: "",
        propertyDetails: "",
        bankAccounts: "",
        investments: "",
        lifeInsurance: "",
        debtsOwed: "",
        willExists: "",
        willDetails: "",

        // Financial circumstances
        benefitsReceived: [],
        employmentStatus: "",
        savings: "",
        savingsAmount: "",
        otherIncome: "",

        // Evidence and documentation
        evidence: [],

        // Declaration
        declarationAgreed: false,
        informationCorrect: false,
        notifyChanges: false
    };

    // Get step from URL params or determine appropriate starting step
    const getInitialStep = () => {
        const stepParam = searchParams.get('step');
        const freshParam = searchParams.get('fresh');

        // If coming with step parameter (from Review page), use it immediately
        if (stepParam && !isNaN(parseInt(stepParam))) {
            console.log('📝 FormPage: Using step from URL (initial):', stepParam);
            return parseInt(stepParam);
        }

        // If fresh=true parameter, always start at step 1 (new application)
        if (freshParam === 'true') {
            console.log('📝 FormPage: Fresh application, clearing data and starting at step 1');
            // Immediately clear localStorage for fresh applications
            if (user?.email) {
                clearFormData(user?.email);
                clearSectionProgress(user?.email);
            }
            return 1;
        }

        // For continuing applications, check if there's actual form progress
        const savedFormData = loadFormData(user?.email, {});
        const hasActualProgress = hasAnyProgress(savedFormData, formSections);

        if (hasActualProgress) {
            const savedStep = loadFormStep(user?.email) || 1;
            console.log('📝 FormPage: Has progress, using saved step:', savedStep);
            return savedStep;
        } else {
            console.log('📝 FormPage: No progress, starting at step 1');
            return 1;
        }
    };

    const [currentStep, setCurrentStep] = useState(getInitialStep);
    const [formData, setFormData] = useState(defaultFormData);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // On first entry to evidence step, fetch AI suggestions if evidence exists and not already fetched
    useEffect(() => {
        if (currentStep === 12 && uploadedEvidence.length > 0 && !aiSuggestions && !aiLoading) {
            setAILoading(true);
            setAIError("");
            getAISuggestions(formData, user?.token)
                .then(res => setAISuggestions(res.suggestions))
                .catch(() => setAIError("Could not fetch AI suggestions"))
                .finally(() => setAILoading(false));
        }
    }, [currentStep, uploadedEvidence, aiSuggestions, aiLoading, formData, user?.token]);

    // Load data from database on component mount
    useEffect(() => {
        const loadFormDataFromDatabase = async () => {
            if (!user?.token) {
                setIsLoadingData(false);
                return;
            }

            const freshParam = searchParams.get('fresh');
            const stepParam = searchParams.get('step');

            console.log('📝 FormPage: Loading data with params:', { freshParam, stepParam });

            // If this is a fresh application, clear existing data and start over
            if (freshParam === 'true') {
                console.log('📝 FormPage: Fresh application - clearing all existing data');
                // Clear all localStorage data
                clearFormData(user?.email);
                clearSectionProgress(user?.email);
                // Set clean state
                setFormData(defaultFormData);
                setCurrentStep(1);
                // Save clean defaults to localStorage 
                saveFormData(user?.email, defaultFormData);
                saveFormStep(user?.email, 1);
                setIsLoadingData(false);
                return;
            }

            try {
                // Always try to load existing data first
                const savedData = await getResumeData(user.token);
                let loadedFormData = defaultFormData;

                if (savedData && savedData.formData) {
                    loadedFormData = { ...defaultFormData, ...savedData.formData };
                    console.log('📝 FormPage: Loading existing data from database:', loadedFormData);
                } else {
                    // Fallback to localStorage
                    loadedFormData = loadFormData(user?.email, defaultFormData);
                    console.log('📝 FormPage: Loading data from localStorage:', loadedFormData);
                }
                // Debug: show all keys with non-empty values
                const nonEmpty = Object.fromEntries(Object.entries(loadedFormData).filter(([k, v]) => v && v !== "" && (!Array.isArray(v) || v.length > 0)));
                console.log('[FORM LOAD] Non-empty loaded formData:', nonEmpty);

                setFormData(loadedFormData);
                // Also save to localStorage for offline access
                saveFormData(user?.email, loadedFormData);

                // If navigating to specific step (from Review page), set the step after data is loaded
                if (stepParam && !isNaN(parseInt(stepParam))) {
                    const targetStep = parseInt(stepParam);
                    console.log('📝 FormPage: Setting step after data load:', targetStep);
                    setCurrentStep(targetStep);
                    saveFormStep(user?.email, targetStep);
                }

            } catch (error) {
                console.warn('📝 FormPage: No saved data found in database, using localStorage');
                // Fallback to localStorage
                const localData = loadFormData(user?.email, defaultFormData);
                setFormData(localData);

                // Set step for navigation even with localStorage data
                if (stepParam && !isNaN(parseInt(stepParam))) {
                    const targetStep = parseInt(stepParam);
                    console.log('📝 FormPage: Setting step with localStorage data:', targetStep);
                    setCurrentStep(targetStep);
                    saveFormStep(user?.email, targetStep);
                }
            } finally {
                setIsLoadingData(false);
            }
        };

        loadFormDataFromDatabase();
    }, [user?.token, user?.email, searchParams]);

    // Save form data to localStorage whenever it changes (but only after initial load)
    useEffect(() => {
        // Don't save if we're still loading initial data
        if (isLoadingData) return;

        console.log('[FORM SAVE] Saving form data to localStorage:', formData);
        saveFormData(user?.email, formData);
        // Do NOT update section/task completion here. Only update on explicit user save/submit.
    }, [formData, user?.email, isLoadingData]);

    // Save current step to localStorage whenever it changes
    useEffect(() => {
        saveFormStep(user?.email, currentStep);
    }, [currentStep, user?.email]);

    // Check if user should be redirected to task list
    useEffect(() => {
        const freshParam = searchParams.get('fresh');
        console.log('📝 FormPage redirect check:', {
            userEmail: user?.email,
            stepParam: searchParams.get('step'),
            freshParam,
            currentStep,
            pathname: location.pathname
        }); // Debug log

        // Don't redirect if this is a fresh application
        if (freshParam === 'true') {
            console.log('📝 FormPage: Fresh application, skipping redirect to tasks');
            return;
        }

        // Only redirect if user is actually on the /form route and not fresh
        if (user?.email && !searchParams.get('step') && location.pathname === '/form') {
            const savedData = loadFormData(user?.email, {});
            const hasProgress = hasAnyProgress(savedData, formSections);
            console.log('📝 FormPage progress check:', { hasProgress, currentStep }); // Debug log

            if (hasProgress && currentStep === 1) {
                console.log('📝 FormPage redirecting to tasks'); // Debug log
                // User has progress and isn't coming from a specific step, show task list
                navigate('/tasks');
                return;
            }
        }
    }, [user?.email, searchParams, currentStep, navigate, location.pathname]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (type === 'checkbox') {
            if (name === 'evidence' || name === 'benefitsReceived' || name === 'partnerBenefitsReceived' ||
                name === 'householdBenefits' || name === 'disabilityBenefits') {
                const currentValues = formData[name] || [];
                const newValue = checked
                    ? [...currentValues, value]
                    : currentValues.filter(v => v !== value);
                setFormData(prev => ({ ...prev, [name]: newValue }));
            } else {
                // For boolean checkboxes like declarations
                setFormData(prev => ({ ...prev, [name]: checked }));
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }

        // Clear error when user types
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const validateStep = (step) => {
        const stepErrors = {};
        if (step === 1) {
            if (!formData.evidence || formData.evidence.length === 0) {
                stepErrors.evidence = "Select at least one document you can provide";
            }
        }
        if (step === 2) {
            if (!formData.firstName) stepErrors.firstName = "Enter your first name";
            if (!formData.lastName) stepErrors.lastName = "Enter your last name";
            if (!formData.dateOfBirth) stepErrors.dateOfBirth = "Enter your date of birth";
            if (!formData.nationalInsuranceNumber) stepErrors.nationalInsuranceNumber = "Enter your National Insurance number";
            else if (!validateNINO(formData.nationalInsuranceNumber)) stepErrors.nationalInsuranceNumber = "Enter a valid National Insurance number";
        }
        if (step === 3) {
            if (!formData.addressLine1) stepErrors.addressLine1 = "Enter your address line 1";
            if (!formData.town) stepErrors.town = "Enter your town or city";
            if (!formData.postcode) stepErrors.postcode = "Enter your postcode";
            else if (!validatePostcode(formData.postcode)) stepErrors.postcode = "Enter a valid UK postcode";
            if (!formData.phoneNumber) stepErrors.phoneNumber = "Enter your phone number";
            else if (!validatePhoneNumber(formData.phoneNumber)) stepErrors.phoneNumber = "Enter a valid phone number";
            if (!formData.email) stepErrors.email = "Enter your email address";
            else if (!validateEmail(formData.email)) stepErrors.email = "Enter a valid email address";
        }

        if (step === 4) {
            if (!formData.hasPartner) stepErrors.hasPartner = "Select whether the person who died had a partner";

            // Only validate partner details if they have a partner
            if (formData.hasPartner === 'yes') {
                if (!formData.partnerFirstName) stepErrors.partnerFirstName = "Enter the partner's first name";
                if (!formData.partnerLastName) stepErrors.partnerLastName = "Enter the partner's last name";
                if (!formData.partnerDateOfBirth) stepErrors.partnerDateOfBirth = "Enter the partner's date of birth";
                if (!formData.partnerNationalInsuranceNumber) stepErrors.partnerNationalInsuranceNumber = "Enter the partner's National Insurance number";
            }
        }

        if (step === 5) {
            if (!formData.hasChildren) stepErrors.hasChildren = "Select whether you have children";
            if (formData.hasChildren === 'yes' && !formData.numberOfChildren) {
                stepErrors.numberOfChildren = "Enter the number of children";
            }
            if (formData.hasChildren === 'yes' && !formData.childrenDetails) {
                stepErrors.childrenDetails = "Provide details about your children";
            }
            if (!formData.householdSize) stepErrors.householdSize = "Enter your household size";
        }

        if (step === 6) {
            // Enhanced benefits is optional but if household benefits selected, need details
            if (formData.householdBenefits?.includes('Income Support') && !formData.incomeSupportDetails) {
                stepErrors.incomeSupportDetails = "Please provide details about Income Support";
            }
            // If carer's allowance is yes, need details
            if (formData.carersAllowance === 'yes' && !formData.carersAllowanceDetails) {
                stepErrors.carersAllowanceDetails = "Please provide details about who you care for";
            }
        }

        if (step === 7) {
            if (!formData.deceasedFirstName) stepErrors.deceasedFirstName = "Enter the deceased person's first name";
            if (!formData.deceasedLastName) stepErrors.deceasedLastName = "Enter the deceased person's last name";
            if (!formData.deceasedDateOfBirth) stepErrors.deceasedDateOfBirth = "Enter the deceased person's date of birth";
            if (!formData.deceasedDateOfDeath) stepErrors.deceasedDateOfDeath = "Enter the deceased person's date of death";
            if (!formData.relationshipToDeceased) stepErrors.relationshipToDeceased = "Select your relationship to the deceased";
        }

        if (step === 8) {
            if (!formData.deceasedAddressLine1) stepErrors.deceasedAddressLine1 = "Enter the deceased person's address line 1";
            if (!formData.deceasedTown) stepErrors.deceasedTown = "Enter the deceased person's town or city";
            if (!formData.deceasedPostcode) stepErrors.deceasedPostcode = "Enter the deceased person's postcode";
            else if (!validatePostcode(formData.deceasedPostcode)) stepErrors.deceasedPostcode = "Enter a valid UK postcode";
        }

        if (step === 9) {
            if (!formData.responsibilityReason) stepErrors.responsibilityReason = "Select why you are responsible for the funeral";
        }

        if (step === 10) {
            if (!formData.funeralDirector) stepErrors.funeralDirector = "Enter the funeral director's name";
            if (!formData.funeralCost) stepErrors.funeralCost = "Enter the funeral cost";
            if (!formData.burialOrCremation) stepErrors.burialOrCremation = "Select burial or cremation";
        }

        if (step === 11) {
            // Estate and assets - mostly optional but validate if estate value is high
            if (formData.estateValue === 'over-5000' && !formData.propertyOwned) {
                stepErrors.propertyOwned = "Please specify if property is owned";
            }
            // If property is owned, need details
            if (formData.propertyOwned === 'yes' && !formData.propertyDetails) {
                stepErrors.propertyDetails = "Please provide details about the property owned";
            }
            // If will exists, need details
            if (formData.willExists === 'yes' && !formData.willDetails) {
                stepErrors.willDetails = "Please provide details about the will";
            }
        }

        if (step === 12) {
            if (!formData.benefitsReceived || formData.benefitsReceived.length === 0) {
                stepErrors.benefitsReceived = "Select at least one benefit you receive or 'None of these'";
            }
            if (!formData.savings) stepErrors.savings = "Select whether you have more than £16,000 in savings";
            // If high savings, need approximate amount
            if (formData.savings === 'yes' && !formData.savingsAmount) {
                stepErrors.savingsAmount = "Please provide an approximate amount of your savings";
            }
        }

        if (step === 13) {
            if (!formData.informationCorrect) stepErrors.informationCorrect = "You must confirm the information is correct";
            if (!formData.notifyChanges) stepErrors.notifyChanges = "You must agree to notify of changes";
            if (!formData.declarationAgreed) stepErrors.declarationAgreed = "You must agree to the terms and conditions";
        }

        setErrors(stepErrors);
        return Object.keys(stepErrors).length === 0;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            // Check if we came from the review page
            const returnTo = searchParams.get('returnTo');

            if (returnTo === 'review') {
                // Auto-save to database before returning to review
                autoSaveToDatabase();
                console.log('📝 FormPage: Returning to review page after saving section');
                navigate("/review");
            } else if (currentStep < 13) {
                // Normal progression to next step
                autoSaveToDatabase();
                setCurrentStep(currentStep + 1);
            }
        }
    };

    const handlePrevious = () => {
        // Check if we came from the review page
        const returnTo = searchParams.get('returnTo');

        if (returnTo === 'review') {
            // Return to review page without saving (user is going back)
            console.log('📝 FormPage: Returning to review page (going back)');
            navigate("/review");
        } else if (currentStep > 1) {
            // Normal progression to previous step
            autoSaveToDatabase();
            setCurrentStep(currentStep - 1);
        }
    };

    // Auto-save function to database
    const autoSaveToDatabase = async () => {
        // Don't auto-save if we're still loading initial data or user not authenticated
        if (!user?.token || isLoadingData) return;

        try {
            await autoSaveForm(formData, user.token);
            console.log('Form auto-saved to database');
            // Do NOT update section/task completion here. Only update on explicit user save/submit.
        } catch (error) {
            console.warn('Auto-save to database failed:', error.message);
            // Continue using localStorage as fallback
        }
    };

    const handleSubmit = async () => {
        if (validateStep(currentStep)) {
            setLoading(true);
            try {
                // Auto-save current progress before redirecting to review
                await autoSaveToDatabase();
                // Update section/task completion status ONLY on explicit save/submit
                if (user?.email) {
                    const sectionStatuses = getAllSectionStatuses(formData, formSections);
                    saveSectionProgress(user?.email, sectionStatuses);
                }
                // Navigate to review page
                navigate("/review");
            } catch (error) {
                console.error('Error saving form data:', error);
                setErrors({ general: "Failed to save form data. Please try again." });
            } finally {
                setLoading(false);
            }
        }
    };

    const hasErrors = Object.keys(errors).length > 0;

    // Show loading state while fetching data from database
    if (isLoadingData) {
        return (
            <div className="govuk-width-container">
                <main className="govuk-main-wrapper" id="main-content" role="main">
                    <div className="govuk-grid-row">
                        <div className="govuk-grid-column-two-thirds">
                            <h1 className="govuk-heading-xl">Loading your application...</h1>
                            <p className="govuk-body">Please wait while we retrieve your saved progress.</p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <>
            {showUpdatedFieldsPopup && (
                <div style={{
                    position: 'fixed',
                    top: 30,
                    right: 30,
                    zIndex: 9999,
                    background: '#222',
                    color: '#fff',
                    padding: '18px 28px',
                    borderRadius: 10,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
                    fontSize: 16,
                    maxWidth: 600,
                    minWidth: 350
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <b>AI Document Ingest Results</b>
                        <button
                            onClick={() => setShowUpdatedFieldsPopup(false)}
                            style={{
                                background: 'transparent',
                                color: '#fff',
                                border: 'none',
                                fontSize: 20,
                                cursor: 'pointer',
                                marginLeft: 16
                            }}
                            aria-label="Close popup"
                        >
                            ×
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: 32, marginTop: 12 }}>
                        <div>
                            <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Extracted Data Fields & Reasoning</div>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'disc inside' }}>
                                {extractedFields && Object.keys(extractedFields).length > 0 ? (
                                    Object.entries(extractedFields).map(([field, info]) => (
                                        <li key={field}>
                                            <strong>{field}:</strong> {info.value}
                                            <br />
                                            <span style={{ color: '#888', fontSize: '0.95em' }}><em>{info.reasoning}</em></span>
                                        </li>
                                    ))
                                ) : <li style={{ color: '#aaa' }}>None</li>}
                            </ul>
                        </div>
                        <div>
                            <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Form Fields Updated</div>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'disc inside' }}>
                                {updatedFields.length > 0 ? updatedFields.map(f => <li key={f}>{f}</li>) : <li style={{ color: '#aaa' }}>None</li>}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
            <div className="govuk-width-container">
                <main className="govuk-main-wrapper" id="main-content" role="main">
                    <div className="govuk-grid-row">
                        <div className="govuk-grid-column-two-thirds">
                            {/* Breadcrumbs removed as requested */}
                            <span className="govuk-caption-xl">Step {currentStep} of 13</span>
                            <h1 className="govuk-heading-xl">Apply for funeral expenses payment</h1>

                            {hasErrors && (
                                <div className="govuk-error-summary" aria-labelledby="error-summary-title" role="alert" data-module="govuk-error-summary">
                                    <h2 className="govuk-error-summary__title" id="error-summary-title">
                                        There is a problem
                                    </h2>
                                    <div className="govuk-error-summary__body">
                                        <ul className="govuk-list govuk-error-summary__list">
                                            {Object.entries(errors).map(([field, error]) => (
                                                <li key={field}>
                                                    <a href={`#${field}`}>{error}</a>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            <form>
                                {/* Dynamically render the correct section based on formSections */}
                                {(() => {
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
                                                />
                                                {evidenceUploading && <p className="govuk-body">Uploading...</p>}
                                                {evidenceError && <p className="govuk-error-message">{evidenceError}</p>}
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
                                    return (
                                        <>
                                            <h2 className="govuk-heading-l">{section.title}</h2>
                                            {section.fields.map(field => {
                                                // Render input based on field type (simplified for demo)
                                                if (field.type === 'text' || field.type === 'date' || field.type === 'number' || field.type === 'email' || field.type === 'tel') {
                                                    return (
                                                        <div className="govuk-form-group" key={field.name}>
                                                            <label className="govuk-label" htmlFor={field.name}>{field.label}</label>
                                                            <input
                                                                className="govuk-input"
                                                                id={field.name}
                                                                name={field.name}
                                                                type={field.type}
                                                                value={formData[field.name] || ''}
                                                                onChange={handleChange}
                                                            />
                                                        </div>
                                                    );
                                                }
                                                if (field.type === 'checkbox') {
                                                    return (
                                                        <div className="govuk-form-group" key={field.name}>
                                                            <fieldset className="govuk-fieldset">
                                                                <legend className="govuk-fieldset__legend">{field.label}</legend>
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
                                                        <div className="govuk-form-group" key={field.name}>
                                                            <fieldset className="govuk-fieldset">
                                                                <legend className="govuk-fieldset__legend">{field.label}</legend>
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
                                                                            />
                                                                            <label className="govuk-label govuk-radios__label" htmlFor={`${field.name}-${opt.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}>{opt}</label>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </fieldset>
                                                        </div>
                                                    );
                                                }
                                                if (field.type === 'textarea') {
                                                    return (
                                                        <div className="govuk-form-group" key={field.name}>
                                                            <label className="govuk-label" htmlFor={field.name}>{field.label}</label>
                                                            <textarea
                                                                className="govuk-textarea"
                                                                id={field.name}
                                                                name={field.name}
                                                                value={formData[field.name] || ''}
                                                                onChange={handleChange}
                                                            />
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })}
                                        </>
                                    );
                                })()}

                                <div className="govuk-button-group">
                                    {currentStep < 13 && (
                                        <button
                                            type="button"
                                            className="govuk-button"
                                            onClick={handleNext}
                                            disabled={loading}
                                        >
                                            {searchParams.get('returnTo') === 'review' ? 'Save and return to summary' : 'Save and continue'}
                                        </button>
                                    )}

                                    {currentStep === 13 && (
                                        <button
                                            type="button"
                                            className="govuk-button"
                                            onClick={handleSubmit}
                                            disabled={loading}
                                        >
                                            {loading ? "Saving..." : "Continue to review"}
                                        </button>
                                    )}

                                    {(currentStep > 1 || searchParams.get('returnTo') === 'review') && (
                                        <button
                                            type="button"
                                            className="govuk-button govuk-button--secondary"
                                            onClick={handlePrevious}
                                            disabled={loading}
                                        >
                                            {searchParams.get('returnTo') === 'review' ? 'Back to summary' : 'Previous'}
                                        </button>
                                    )}
                                </div>
                            </form>

                            {/* Bottom links for navigation and sign out */}
                            <div className="dashboard-bottom-links" style={{ marginTop: 40, display: 'flex', alignItems: 'center' }}>
                                <Link to="/dashboard" className="govuk-link govuk-!-margin-right-4">
                                    Return to dashboard
                                </Link>
                                <a
                                    href="/"
                                    className="govuk-link dashboard-signout-link"
                                    style={{ marginLeft: 'auto' }}
                                    onClick={e => {
                                        e.preventDefault();
                                        if (window.confirm('Are you sure you want to sign out? Unsaved changes may be lost.')) {
                                            window.localStorage.removeItem('user');
                                            window.location.href = '/';
                                        }
                                    }}
                                >
                                    Sign out
                                </a>
                            </div>
                            <ChatbotWidget />
                        </div> {/* end govuk-grid-column-two-thirds */}
                    </div> {/* end govuk-grid-row */}
                </main>
            </div>
        </>
    );
};

export default FormPage;
