import React, { useState, useContext, useEffect } from "react";
import { useNavigate, useSearchParams, Link, useLocation } from "react-router-dom";
import AuthContext from "../auth/AuthContext";
import { saveFormData, loadFormData, saveFormStep, loadFormStep, clearFormData } from "../utils/formPersistence";
import { autoSaveForm, getResumeData } from "../api";
import { 
    FORM_SECTIONS, 
    getAllSectionStatuses, 
    hasAnyProgress,
    saveSectionProgress,
    clearSectionProgress 
} from "../utils/formProgress";

const FormPage = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    
    // Default form data structure
    const defaultFormData = {
        // Personal details
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        nationalInsuranceNumber: "",
        address: "",
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
        deceasedAddress: "",
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
        const hasActualProgress = hasAnyProgress(savedFormData);
        
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
        
        saveFormData(user?.email, formData);
        
        // Update section progress
        if (user?.email) {
            const sectionStatuses = getAllSectionStatuses(formData);
            saveSectionProgress(user?.email, sectionStatuses);
        }
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
            const hasProgress = hasAnyProgress(savedData);
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
            if (!formData.firstName) stepErrors.firstName = "Enter your first name";
            if (!formData.lastName) stepErrors.lastName = "Enter your last name";
            if (!formData.dateOfBirth) stepErrors.dateOfBirth = "Enter your date of birth";
            if (!formData.nationalInsuranceNumber) stepErrors.nationalInsuranceNumber = "Enter your National Insurance number";
        }
        
        if (step === 2) {
            if (!formData.address) stepErrors.address = "Enter your address";
            if (!formData.postcode) stepErrors.postcode = "Enter your postcode";
            if (!formData.phoneNumber) stepErrors.phoneNumber = "Enter your phone number";
            if (!formData.email) stepErrors.email = "Enter your email address";
        }
        
        if (step === 3) {
            if (!formData.hasPartner) stepErrors.hasPartner = "Select whether the person who died had a partner";
            
            // Only validate partner details if they have a partner
            if (formData.hasPartner === 'yes') {
                if (!formData.partnerFirstName) stepErrors.partnerFirstName = "Enter the partner's first name";
                if (!formData.partnerLastName) stepErrors.partnerLastName = "Enter the partner's last name";
                if (!formData.partnerDateOfBirth) stepErrors.partnerDateOfBirth = "Enter the partner's date of birth";
                if (!formData.partnerNationalInsuranceNumber) stepErrors.partnerNationalInsuranceNumber = "Enter the partner's National Insurance number";
            }
        }
        
        if (step === 4) {
            if (!formData.hasChildren) stepErrors.hasChildren = "Select whether you have children";
            if (formData.hasChildren === 'yes' && !formData.numberOfChildren) {
                stepErrors.numberOfChildren = "Enter the number of children";
            }
            if (formData.hasChildren === 'yes' && !formData.childrenDetails) {
                stepErrors.childrenDetails = "Provide details about your children";
            }
            if (!formData.householdSize) stepErrors.householdSize = "Enter your household size";
        }
        
        if (step === 5) {
            // Enhanced benefits is optional but if household benefits selected, need details
            if (formData.householdBenefits?.includes('Income Support') && !formData.incomeSupportDetails) {
                stepErrors.incomeSupportDetails = "Please provide details about Income Support";
            }
            // If carer's allowance is yes, need details
            if (formData.carersAllowance === 'yes' && !formData.carersAllowanceDetails) {
                stepErrors.carersAllowanceDetails = "Please provide details about who you care for";
            }
        }
        
        if (step === 6) {
            if (!formData.deceasedFirstName) stepErrors.deceasedFirstName = "Enter the deceased person's first name";
            if (!formData.deceasedLastName) stepErrors.deceasedLastName = "Enter the deceased person's last name";
            if (!formData.deceasedDateOfBirth) stepErrors.deceasedDateOfBirth = "Enter the deceased person's date of birth";
            if (!formData.deceasedDateOfDeath) stepErrors.deceasedDateOfDeath = "Enter the deceased person's date of death";
            if (!formData.relationshipToDeceased) stepErrors.relationshipToDeceased = "Select your relationship to the deceased";
        }
        
        if (step === 7) {
            if (!formData.deceasedAddress) stepErrors.deceasedAddress = "Enter the deceased person's address";
            if (!formData.deceasedPostcode) stepErrors.deceasedPostcode = "Enter the deceased person's postcode";
        }
        
        if (step === 8) {
            if (!formData.responsibilityReason) stepErrors.responsibilityReason = "Select why you are responsible for the funeral";
        }
        
        if (step === 9) {
            if (!formData.funeralDirector) stepErrors.funeralDirector = "Enter the funeral director's name";
            if (!formData.funeralCost) stepErrors.funeralCost = "Enter the funeral cost";
            if (!formData.burialOrCremation) stepErrors.burialOrCremation = "Select burial or cremation";
        }
        
        if (step === 10) {
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
        
        if (step === 11) {
            if (!formData.benefitsReceived || formData.benefitsReceived.length === 0) {
                stepErrors.benefitsReceived = "Select at least one benefit you receive or 'None of these'";
            }
            if (!formData.savings) stepErrors.savings = "Select whether you have more than £16,000 in savings";
            // If high savings, need approximate amount
            if (formData.savings === 'yes' && !formData.savingsAmount) {
                stepErrors.savingsAmount = "Please provide an approximate amount of your savings";
            }
        }
        
        if (step === 12) {
            if (!formData.evidence || formData.evidence.length === 0) {
                stepErrors.evidence = "Select at least one document you can provide";
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
            await autoSaveForm(formData);
            console.log('Form auto-saved to database');
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

    const renderStep1 = () => (
        <>
            <h2 className="govuk-heading-l">Your personal details</h2>
            <p className="govuk-body">We need some basic information about you.</p>
            
            <div className={`govuk-form-group ${errors.firstName ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="firstName">First name</label>
                {errors.firstName && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.firstName}
                    </p>
                )}
                <input 
                    className={`govuk-input ${errors.firstName ? 'govuk-input--error' : ''}`}
                    id="firstName"
                    name="firstName" 
                    type="text"
                    value={formData.firstName}
                    onChange={handleChange}
                    autoComplete="given-name"
                />
            </div>

            <div className={`govuk-form-group ${errors.lastName ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="lastName">Last name</label>
                {errors.lastName && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.lastName}
                    </p>
                )}
                <input 
                    className={`govuk-input ${errors.lastName ? 'govuk-input--error' : ''}`}
                    id="lastName"
                    name="lastName" 
                    type="text"
                    value={formData.lastName}
                    onChange={handleChange}
                    autoComplete="family-name"
                />
            </div>

            <div className={`govuk-form-group ${errors.dateOfBirth ? 'govuk-form-group--error' : ''}`}>
                <fieldset className="govuk-fieldset" role="group">
                    <legend className="govuk-fieldset__legend">
                        Date of birth
                    </legend>
                    <div className="govuk-hint">
                        For example, 31 3 1980
                    </div>
                    {errors.dateOfBirth && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.dateOfBirth}
                        </p>
                    )}
                    <input 
                        className={`govuk-input govuk-input--width-10 ${errors.dateOfBirth ? 'govuk-input--error' : ''}`}
                        id="dateOfBirth"
                        name="dateOfBirth" 
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={handleChange}
                        autoComplete="bday"
                    />
                </fieldset>
            </div>

            <div className={`govuk-form-group ${errors.nationalInsuranceNumber ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="nationalInsuranceNumber">
                    National Insurance number
                </label>
                <div className="govuk-hint">
                    It's on your National Insurance card, benefit letter, payslip or P60. For example, 'QQ 12 34 56 C'.
                </div>
                {errors.nationalInsuranceNumber && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.nationalInsuranceNumber}
                    </p>
                )}
                <input 
                    className={`govuk-input govuk-input--width-10 ${errors.nationalInsuranceNumber ? 'govuk-input--error' : ''}`}
                    id="nationalInsuranceNumber"
                    name="nationalInsuranceNumber" 
                    type="text"
                    value={formData.nationalInsuranceNumber}
                    onChange={handleChange}
                    spellCheck="false"
                />
            </div>
        </>
    );

    const renderStep2 = () => (
        <>
            <h2 className="govuk-heading-l">Your contact details</h2>
            <p className="govuk-body">We need your address and contact information.</p>
            
            <div className={`govuk-form-group ${errors.address ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="address">Address</label>
                {errors.address && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.address}
                    </p>
                )}
                <textarea 
                    className={`govuk-textarea ${errors.address ? 'govuk-textarea--error' : ''}`}
                    id="address"
                    name="address" 
                    rows="3"
                    value={formData.address}
                    onChange={handleChange}
                    autoComplete="street-address"
                />
            </div>

            <div className={`govuk-form-group ${errors.postcode ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="postcode">Postcode</label>
                {errors.postcode && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.postcode}
                    </p>
                )}
                <input 
                    className={`govuk-input govuk-input--width-10 ${errors.postcode ? 'govuk-input--error' : ''}`}
                    id="postcode"
                    name="postcode" 
                    type="text"
                    value={formData.postcode}
                    onChange={handleChange}
                    autoComplete="postal-code"
                />
            </div>

            <div className={`govuk-form-group ${errors.phoneNumber ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="phoneNumber">Phone number</label>
                {errors.phoneNumber && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.phoneNumber}
                    </p>
                )}
                <input 
                    className={`govuk-input govuk-input--width-20 ${errors.phoneNumber ? 'govuk-input--error' : ''}`}
                    id="phoneNumber"
                    name="phoneNumber" 
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    autoComplete="tel"
                />
            </div>

            <div className={`govuk-form-group ${errors.email ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="email">Email address</label>
                {errors.email && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.email}
                    </p>
                )}
                <input 
                    className={`govuk-input ${errors.email ? 'govuk-input--error' : ''}`}
                    id="email"
                    name="email" 
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="email"
                />
            </div>
        </>
    );

    const renderStep3 = () => (
        <>
            <h2 className="govuk-heading-l">Partner details</h2>
            <p className="govuk-body">Tell us about the partner of the person who died.</p>
            
            <div className={`govuk-form-group ${errors.hasPartner ? 'govuk-form-group--error' : ''}`}>
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend govuk-fieldset__legend--m">
                        Did the person who died have a partner?
                    </legend>
                    <div className="govuk-hint">
                        This includes a spouse, civil partner, or someone they lived with as a couple.
                    </div>
                    {errors.hasPartner && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.hasPartner}
                        </p>
                    )}
                    <div className="govuk-radios">
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="hasPartner-yes" 
                                name="hasPartner" 
                                type="radio" 
                                value="yes"
                                checked={formData.hasPartner === 'yes'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="hasPartner-yes">
                                Yes
                            </label>
                        </div>
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="hasPartner-no" 
                                name="hasPartner" 
                                type="radio" 
                                value="no"
                                checked={formData.hasPartner === 'no'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="hasPartner-no">
                                No
                            </label>
                        </div>
                    </div>
                </fieldset>
            </div>

            {formData.hasPartner === 'yes' && (
                <>
                    <h3 className="govuk-heading-m">Partner's personal details</h3>
                    
                    <div className={`govuk-form-group ${errors.partnerFirstName ? 'govuk-form-group--error' : ''}`}>
                        <label className="govuk-label" htmlFor="partnerFirstName">Partner's first name</label>
                        {errors.partnerFirstName && (
                            <p className="govuk-error-message">
                                <span className="govuk-visually-hidden">Error:</span> {errors.partnerFirstName}
                            </p>
                        )}
                        <input 
                            className={`govuk-input ${errors.partnerFirstName ? 'govuk-input--error' : ''}`}
                            id="partnerFirstName"
                            name="partnerFirstName" 
                            type="text"
                            value={formData.partnerFirstName}
                            onChange={handleChange}
                        />
                    </div>

                    <div className={`govuk-form-group ${errors.partnerLastName ? 'govuk-form-group--error' : ''}`}>
                        <label className="govuk-label" htmlFor="partnerLastName">Partner's last name</label>
                        {errors.partnerLastName && (
                            <p className="govuk-error-message">
                                <span className="govuk-visually-hidden">Error:</span> {errors.partnerLastName}
                            </p>
                        )}
                        <input 
                            className={`govuk-input ${errors.partnerLastName ? 'govuk-input--error' : ''}`}
                            id="partnerLastName"
                            name="partnerLastName" 
                            type="text"
                            value={formData.partnerLastName}
                            onChange={handleChange}
                        />
                    </div>

                    <div className={`govuk-form-group ${errors.partnerDateOfBirth ? 'govuk-form-group--error' : ''}`}>
                        <label className="govuk-label" htmlFor="partnerDateOfBirth">Partner's date of birth</label>
                        <div className="govuk-hint">For example, 27 3 1961</div>
                        {errors.partnerDateOfBirth && (
                            <p className="govuk-error-message">
                                <span className="govuk-visually-hidden">Error:</span> {errors.partnerDateOfBirth}
                            </p>
                        )}
                        <input 
                            className={`govuk-input govuk-input--width-10 ${errors.partnerDateOfBirth ? 'govuk-input--error' : ''}`}
                            id="partnerDateOfBirth"
                            name="partnerDateOfBirth" 
                            type="date"
                            value={formData.partnerDateOfBirth}
                            onChange={handleChange}
                        />
                    </div>

                    <div className={`govuk-form-group ${errors.partnerNationalInsuranceNumber ? 'govuk-form-group--error' : ''}`}>
                        <label className="govuk-label" htmlFor="partnerNationalInsuranceNumber">Partner's National Insurance number</label>
                        <div className="govuk-hint">It's on their National Insurance card, benefit letter, payslip or P60. For example, 'QQ 12 34 56 C'.</div>
                        {errors.partnerNationalInsuranceNumber && (
                            <p className="govuk-error-message">
                                <span className="govuk-visually-hidden">Error:</span> {errors.partnerNationalInsuranceNumber}
                            </p>
                        )}
                        <input 
                            className={`govuk-input govuk-input--width-10 ${errors.partnerNationalInsuranceNumber ? 'govuk-input--error' : ''}`}
                            id="partnerNationalInsuranceNumber"
                            name="partnerNationalInsuranceNumber" 
                            type="text"
                            value={formData.partnerNationalInsuranceNumber}
                            onChange={handleChange}
                        />
                    </div>

                    <h3 className="govuk-heading-m">Partner's benefits and savings</h3>
                    
                    <div className={`govuk-form-group ${errors.partnerBenefitsReceived ? 'govuk-form-group--error' : ''}`}>
                        <fieldset className="govuk-fieldset">
                            <legend className="govuk-fieldset__legend govuk-fieldset__legend--s">
                                What benefits does the partner receive?
                            </legend>
                            <div className="govuk-hint">Select all that apply</div>
                            {errors.partnerBenefitsReceived && (
                                <p className="govuk-error-message">
                                    <span className="govuk-visually-hidden">Error:</span> {errors.partnerBenefitsReceived}
                                </p>
                            )}
                            <div className="govuk-checkboxes govuk-checkboxes--small">
                                {[
                                    'Income Support',
                                    'Jobseeker\'s Allowance (income-based)',
                                    'Employment and Support Allowance (income-related)',
                                    'Pension Credit',
                                    'Universal Credit',
                                    'Housing Benefit',
                                    'Working Tax Credit',
                                    'Child Tax Credit',
                                    'None of these'
                                ].map((benefit) => (
                                    <div key={benefit} className="govuk-checkboxes__item">
                                        <input 
                                            className="govuk-checkboxes__input" 
                                            id={`partnerBenefitsReceived-${benefit.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                                            name="partnerBenefitsReceived" 
                                            type="checkbox" 
                                            value={benefit}
                                            checked={formData.partnerBenefitsReceived?.includes(benefit)}
                                            onChange={handleChange}
                                        />
                                        <label className="govuk-label govuk-checkboxes__label" htmlFor={`partnerBenefitsReceived-${benefit.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
                                            {benefit}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </fieldset>
                    </div>

                    <div className={`govuk-form-group ${errors.partnerSavings ? 'govuk-form-group--error' : ''}`}>
                        <fieldset className="govuk-fieldset">
                            <legend className="govuk-fieldset__legend govuk-fieldset__legend--s">
                                Does the partner have more than £16,000 in savings, investments or property?
                            </legend>
                            <div className="govuk-hint">
                                Do not include the home they live in or personal possessions.
                            </div>
                            {errors.partnerSavings && (
                                <p className="govuk-error-message">
                                    <span className="govuk-visually-hidden">Error:</span> {errors.partnerSavings}
                                </p>
                            )}
                            <div className="govuk-radios">
                                <div className="govuk-radios__item">
                                    <input 
                                        className="govuk-radios__input" 
                                        id="partnerSavings-yes" 
                                        name="partnerSavings" 
                                        type="radio" 
                                        value="yes"
                                        checked={formData.partnerSavings === 'yes'}
                                        onChange={handleChange}
                                    />
                                    <label className="govuk-label govuk-radios__label" htmlFor="partnerSavings-yes">
                                        Yes
                                    </label>
                                </div>
                                <div className="govuk-radios__item">
                                    <input 
                                        className="govuk-radios__input" 
                                        id="partnerSavings-no" 
                                        name="partnerSavings" 
                                        type="radio" 
                                        value="no"
                                        checked={formData.partnerSavings === 'no'}
                                        onChange={handleChange}
                                    />
                                    <label className="govuk-label govuk-radios__label" htmlFor="partnerSavings-no">
                                        No
                                    </label>
                                </div>
                            </div>
                        </fieldset>
                    </div>
                </>
            )}
        </>
    );

    const renderStep4 = () => (
        <>
            <h2 className="govuk-heading-l">Family composition and dependents</h2>
            <p className="govuk-body">Tell us about your family and any people who depend on you financially.</p>
            
            <div className={`govuk-form-group ${errors.hasChildren ? 'govuk-form-group--error' : ''}`}>
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend govuk-fieldset__legend--m">
                        Do you have any children?
                    </legend>
                    <div className="govuk-hint">
                        Include children under 16, or under 20 if they're in education or training.
                    </div>
                    {errors.hasChildren && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.hasChildren}
                        </p>
                    )}
                    <div className="govuk-radios">
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="hasChildren-yes" 
                                name="hasChildren" 
                                type="radio" 
                                value="yes"
                                checked={formData.hasChildren === 'yes'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="hasChildren-yes">
                                Yes
                            </label>
                        </div>
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="hasChildren-no" 
                                name="hasChildren" 
                                type="radio" 
                                value="no"
                                checked={formData.hasChildren === 'no'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="hasChildren-no">
                                No
                            </label>
                        </div>
                    </div>
                </fieldset>
            </div>

            {formData.hasChildren === 'yes' && (
                <>
                    <div className={`govuk-form-group ${errors.numberOfChildren ? 'govuk-form-group--error' : ''}`}>
                        <label className="govuk-label" htmlFor="numberOfChildren">
                            How many children do you have?
                        </label>
                        {errors.numberOfChildren && (
                            <p className="govuk-error-message">
                                <span className="govuk-visually-hidden">Error:</span> {errors.numberOfChildren}
                            </p>
                        )}
                        <input 
                            className={`govuk-input govuk-input--width-3 ${errors.numberOfChildren ? 'govuk-input--error' : ''}`}
                            id="numberOfChildren"
                            name="numberOfChildren" 
                            type="number"
                            min="1"
                            value={formData.numberOfChildren}
                            onChange={handleChange}
                        />
                    </div>

                    <div className={`govuk-form-group ${errors.childrenDetails ? 'govuk-form-group--error' : ''}`}>
                        <label className="govuk-label" htmlFor="childrenDetails">
                            Children's details
                        </label>
                        <div className="govuk-hint">
                            Please provide details about your children including their ages and any special circumstances.
                        </div>
                        {errors.childrenDetails && (
                            <p className="govuk-error-message">
                                <span className="govuk-visually-hidden">Error:</span> {errors.childrenDetails}
                            </p>
                        )}
                        <textarea 
                            className={`govuk-textarea ${errors.childrenDetails ? 'govuk-textarea--error' : ''}`}
                            id="childrenDetails"
                            name="childrenDetails" 
                            rows="4"
                            value={formData.childrenDetails}
                            onChange={handleChange}
                        />
                    </div>
                </>
            )}

            <div className={`govuk-form-group ${errors.hasDependents ? 'govuk-form-group--error' : ''}`}>
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend govuk-fieldset__legend--s">
                        Do you have any other people who depend on you financially?
                    </legend>
                    <div className="govuk-hint">
                        For example, elderly relatives, disabled family members, or other adults you support.
                    </div>
                    {errors.hasDependents && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.hasDependents}
                        </p>
                    )}
                    <div className="govuk-radios">
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="hasDependents-yes" 
                                name="hasDependents" 
                                type="radio" 
                                value="yes"
                                checked={formData.hasDependents === 'yes'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="hasDependents-yes">
                                Yes
                            </label>
                        </div>
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="hasDependents-no" 
                                name="hasDependents" 
                                type="radio" 
                                value="no"
                                checked={formData.hasDependents === 'no'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="hasDependents-no">
                                No
                            </label>
                        </div>
                    </div>
                </fieldset>
            </div>

            {formData.hasDependents === 'yes' && (
                <div className={`govuk-form-group ${errors.dependentsDetails ? 'govuk-form-group--error' : ''}`}>
                    <label className="govuk-label" htmlFor="dependentsDetails">
                        Details about your dependents
                    </label>
                    <div className="govuk-hint">
                        Please provide details about the people who depend on you, including their relationship to you and circumstances.
                    </div>
                    {errors.dependentsDetails && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.dependentsDetails}
                        </p>
                    )}
                    <textarea 
                        className={`govuk-textarea ${errors.dependentsDetails ? 'govuk-textarea--error' : ''}`}
                        id="dependentsDetails"
                        name="dependentsDetails" 
                        rows="4"
                        value={formData.dependentsDetails}
                        onChange={handleChange}
                    />
                </div>
            )}

            <div className={`govuk-form-group ${errors.householdSize ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="householdSize">
                    How many people live in your household?
                </label>
                <div className="govuk-hint">
                    Include yourself, your partner (if you have one), and anyone else who lives with you.
                </div>
                {errors.householdSize && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.householdSize}
                    </p>
                )}
                <input 
                    className={`govuk-input govuk-input--width-3 ${errors.householdSize ? 'govuk-input--error' : ''}`}
                    id="householdSize"
                    name="householdSize" 
                    type="number"
                    min="1"
                    value={formData.householdSize}
                    onChange={handleChange}
                />
            </div>

            <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="householdMembers">
                    Household members (optional)
                </label>
                <div className="govuk-hint">
                    Please provide details about other people who live with you, including their relationship to you.
                </div>
                <textarea 
                    className="govuk-textarea"
                    id="householdMembers"
                    name="householdMembers" 
                    rows="3"
                    value={formData.householdMembers}
                    onChange={handleChange}
                />
            </div>
        </>
    );

    const renderStep5 = () => (
        <>
            <h2 className="govuk-heading-l">Enhanced benefits information</h2>
            <p className="govuk-body">Tell us about any additional benefits that apply to your household.</p>
            
            <div className={`govuk-form-group ${errors.householdBenefits ? 'govuk-form-group--error' : ''}`}>
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend govuk-fieldset__legend--m">
                        Does anyone in your household receive any of these benefits?
                    </legend>
                    <div className="govuk-hint">Select all that apply</div>
                    {errors.householdBenefits && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.householdBenefits}
                        </p>
                    )}
                    <div className="govuk-checkboxes govuk-checkboxes--small">
                        {[
                            'Income Support',
                            'Jobseeker\'s Allowance (income-based)',
                            'Employment and Support Allowance (income-related)', 
                            'Pension Credit',
                            'Universal Credit',
                            'Housing Benefit',
                            'Council Tax Support',
                            'Working Tax Credit',
                            'Child Tax Credit',
                            'None of these'
                        ].map((benefit) => (
                            <div key={benefit} className="govuk-checkboxes__item">
                                <input 
                                    className="govuk-checkboxes__input" 
                                    id={`householdBenefits-${benefit.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                                    name="householdBenefits" 
                                    type="checkbox" 
                                    value={benefit}
                                    checked={formData.householdBenefits?.includes(benefit)}
                                    onChange={handleChange}
                                />
                                <label className="govuk-label govuk-checkboxes__label" htmlFor={`householdBenefits-${benefit.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
                                    {benefit}
                                </label>
                            </div>
                        ))}
                    </div>
                </fieldset>
            </div>

            {formData.householdBenefits?.includes('Income Support') && (
                <div className={`govuk-form-group ${errors.incomeSupportDetails ? 'govuk-form-group--error' : ''}`}>
                    <label className="govuk-label" htmlFor="incomeSupportDetails">
                        Please provide details about your Income Support
                    </label>
                    <div className="govuk-hint">For example, when you started receiving it, the amount, or any special circumstances</div>
                    {errors.incomeSupportDetails && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.incomeSupportDetails}
                        </p>
                    )}
                    <textarea 
                        className={`govuk-textarea ${errors.incomeSupportDetails ? 'govuk-textarea--error' : ''}`}
                        id="incomeSupportDetails"
                        name="incomeSupportDetails" 
                        rows="3"
                        value={formData.incomeSupportDetails}
                        onChange={handleChange}
                    />
                </div>
            )}

            <div className={`govuk-form-group ${errors.disabilityBenefits ? 'govuk-form-group--error' : ''}`}>
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend govuk-fieldset__legend--m">
                        Do you or anyone in your household receive any disability benefits?
                    </legend>
                    <div className="govuk-hint">Select all that apply</div>
                    {errors.disabilityBenefits && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.disabilityBenefits}
                        </p>
                    )}
                    <div className="govuk-checkboxes govuk-checkboxes--small">
                        {[
                            'Disability Living Allowance (DLA)',
                            'Personal Independence Payment (PIP)',
                            'Attendance Allowance',
                            'Carer\'s Allowance',
                            'Industrial Injuries Disablement Benefit',
                            'War Disablement Pension',
                            'None of these'
                        ].map((benefit) => (
                            <div key={benefit} className="govuk-checkboxes__item">
                                <input 
                                    className="govuk-checkboxes__input" 
                                    id={`disabilityBenefits-${benefit.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                                    name="disabilityBenefits" 
                                    type="checkbox" 
                                    value={benefit}
                                    checked={formData.disabilityBenefits?.includes(benefit)}
                                    onChange={handleChange}
                                />
                                <label className="govuk-label govuk-checkboxes__label" htmlFor={`disabilityBenefits-${benefit.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
                                    {benefit}
                                </label>
                            </div>
                        ))}
                    </div>
                </fieldset>
            </div>

            <div className={`govuk-form-group ${errors.carersAllowance ? 'govuk-form-group--error' : ''}`}>
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend govuk-fieldset__legend--s">
                        Do you receive Carer's Allowance for looking after someone?
                    </legend>
                    {errors.carersAllowance && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.carersAllowance}
                        </p>
                    )}
                    <div className="govuk-radios">
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="carersAllowance-yes" 
                                name="carersAllowance" 
                                type="radio" 
                                value="yes"
                                checked={formData.carersAllowance === 'yes'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="carersAllowance-yes">
                                Yes
                            </label>
                        </div>
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="carersAllowance-no" 
                                name="carersAllowance" 
                                type="radio" 
                                value="no"
                                checked={formData.carersAllowance === 'no'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="carersAllowance-no">
                                No
                            </label>
                        </div>
                    </div>
                </fieldset>
            </div>

            {formData.carersAllowance === 'yes' && (
                <div className={`govuk-form-group ${errors.carersAllowanceDetails ? 'govuk-form-group--error' : ''}`}>
                    <label className="govuk-label" htmlFor="carersAllowanceDetails">
                        Who do you care for?
                    </label>
                    <div className="govuk-hint">Please provide details about the person you care for and your caring responsibilities</div>
                    {errors.carersAllowanceDetails && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.carersAllowanceDetails}
                        </p>
                    )}
                    <textarea 
                        className={`govuk-textarea ${errors.carersAllowanceDetails ? 'govuk-textarea--error' : ''}`}
                        id="carersAllowanceDetails"
                        name="carersAllowanceDetails" 
                        rows="3"
                        value={formData.carersAllowanceDetails}
                        onChange={handleChange}
                    />
                </div>
            )}
        </>
    );

    const renderStep6 = () => (
        <>
            <h2 className="govuk-heading-l">About the person who died</h2>
            <p className="govuk-body">Tell us about the person whose funeral you're arranging.</p>
            
            <div className={`govuk-form-group ${errors.deceasedFirstName ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="deceasedFirstName">First name</label>
                {errors.deceasedFirstName && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.deceasedFirstName}
                    </p>
                )}
                <input 
                    className={`govuk-input ${errors.deceasedFirstName ? 'govuk-input--error' : ''}`}
                    id="deceasedFirstName"
                    name="deceasedFirstName" 
                    type="text"
                    value={formData.deceasedFirstName}
                    onChange={handleChange}
                />
            </div>

            <div className={`govuk-form-group ${errors.deceasedLastName ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="deceasedLastName">Last name</label>
                {errors.deceasedLastName && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.deceasedLastName}
                    </p>
                )}
                <input 
                    className={`govuk-input ${errors.deceasedLastName ? 'govuk-input--error' : ''}`}
                    id="deceasedLastName"
                    name="deceasedLastName" 
                    type="text"
                    value={formData.deceasedLastName}
                    onChange={handleChange}
                />
            </div>

            <div className={`govuk-form-group ${errors.deceasedDateOfBirth ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="deceasedDateOfBirth">Date of birth</label>
                {errors.deceasedDateOfBirth && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.deceasedDateOfBirth}
                    </p>
                )}
                <input 
                    className={`govuk-input govuk-input--width-10 ${errors.deceasedDateOfBirth ? 'govuk-input--error' : ''}`}
                    id="deceasedDateOfBirth"
                    name="deceasedDateOfBirth" 
                    type="date"
                    value={formData.deceasedDateOfBirth}
                    onChange={handleChange}
                />
            </div>

            <div className={`govuk-form-group ${errors.deceasedDateOfDeath ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="deceasedDateOfDeath">Date of death</label>
                {errors.deceasedDateOfDeath && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.deceasedDateOfDeath}
                    </p>
                )}
                <input 
                    className={`govuk-input govuk-input--width-10 ${errors.deceasedDateOfDeath ? 'govuk-input--error' : ''}`}
                    id="deceasedDateOfDeath"
                    name="deceasedDateOfDeath" 
                    type="date"
                    value={formData.deceasedDateOfDeath}
                    onChange={handleChange}
                />
            </div>

            <div className={`govuk-form-group ${errors.relationshipToDeceased ? 'govuk-form-group--error' : ''}`}>
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend">
                        What was your relationship to the deceased?
                    </legend>
                    {errors.relationshipToDeceased && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.relationshipToDeceased}
                        </p>
                    )}
                    <div className="govuk-radios">
                        {["Spouse or civil partner", "Child", "Parent", "Sibling", "Other family member", "Friend"].map(option => (
                            <div key={option} className="govuk-radios__item">
                                <input 
                                    className="govuk-radios__input"
                                    id={`relationship-${option.replace(/ /g, '-').toLowerCase()}`}
                                    name="relationshipToDeceased"
                                    type="radio"
                                    value={option}
                                    checked={formData.relationshipToDeceased === option}
                                    onChange={handleChange}
                                />
                                <label className="govuk-label govuk-radios__label" htmlFor={`relationship-${option.replace(/ /g, '-').toLowerCase()}`}>
                                    {option}
                                </label>
                            </div>
                        ))}
                    </div>
                </fieldset>
            </div>
        </>
    );

    const renderStep7 = () => (
        <>
            <h2 className="govuk-heading-l">Address of the person who died</h2>
            <p className="govuk-body">Enter the address where the person who died was living.</p>
            
            <div className={`govuk-form-group ${errors.deceasedAddress ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="deceasedAddress">
                    Address
                </label>
                {errors.deceasedAddress && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.deceasedAddress}
                    </p>
                )}
                <textarea
                    className={`govuk-textarea ${errors.deceasedAddress ? 'govuk-textarea--error' : ''}`}
                    id="deceasedAddress"
                    name="deceasedAddress"
                    rows="3"
                    value={formData.deceasedAddress}
                    onChange={handleChange}
                />
            </div>

            <div className={`govuk-form-group ${errors.deceasedPostcode ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="deceasedPostcode">
                    Postcode
                </label>
                {errors.deceasedPostcode && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.deceasedPostcode}
                    </p>
                )}
                <input
                    className={`govuk-input govuk-input--width-10 ${errors.deceasedPostcode ? 'govuk-input--error' : ''}`}
                    id="deceasedPostcode"
                    name="deceasedPostcode"
                    type="text"
                    value={formData.deceasedPostcode}
                    onChange={handleChange}
                />
            </div>

            <div className="govuk-form-group">
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend">
                        Was this their usual address?
                    </legend>
                    <div className="govuk-radios">
                        {["Yes", "No"].map(option => (
                            <div key={option} className="govuk-radios__item">
                                <input 
                                    className="govuk-radios__input"
                                    id={`usual-address-${option.toLowerCase()}`}
                                    name="deceasedUsualAddress"
                                    type="radio"
                                    value={option}
                                    checked={formData.deceasedUsualAddress === option}
                                    onChange={handleChange}
                                />
                                <label className="govuk-label govuk-radios__label" htmlFor={`usual-address-${option.toLowerCase()}`}>
                                    {option}
                                </label>
                            </div>
                        ))}
                    </div>
                </fieldset>
            </div>
        </>
    );

    const renderStep8 = () => (
        <>
            <h2 className="govuk-heading-l">Responsibility for funeral arrangements</h2>
            <p className="govuk-body">We need to understand your responsibility for the funeral.</p>
            
            <div className="govuk-form-group">
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend">
                        Why are you responsible for the funeral arrangements?
                    </legend>
                    <div className="govuk-radios">
                        {[
                            "I am the partner of the person who died",
                            "I am a close relative and no partner survives",
                            "I am a close friend and no partner or close relative can arrange the funeral",
                            "I am the parent of a baby who was stillborn or died as a child",
                            "Other"
                        ].map(reason => (
                            <div key={reason} className="govuk-radios__item">
                                <input 
                                    className="govuk-radios__input"
                                    id={`responsibility-${reason.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                                    name="responsibilityReason"
                                    type="radio"
                                    value={reason}
                                    checked={formData.responsibilityReason === reason}
                                    onChange={handleChange}
                                />
                                <label className="govuk-label govuk-radios__label" htmlFor={`responsibility-${reason.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}>
                                    {reason}
                                </label>
                            </div>
                        ))}
                    </div>
                </fieldset>
            </div>

            <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="nextOfKin">
                    Next of kin details (optional)
                </label>
                <div className="govuk-hint">
                    Provide details if there are other family members we should know about.
                </div>
                <textarea
                    className="govuk-textarea"
                    id="nextOfKin"
                    name="nextOfKin"
                    rows="3"
                    value={formData.nextOfKin || ''}
                    onChange={handleChange}
                />
            </div>

            <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="otherResponsiblePerson">
                    Other responsible person (optional)
                </label>
                <div className="govuk-hint">
                    Name and details of any other person responsible for the funeral arrangements.
                </div>
                <input
                    className="govuk-input"
                    id="otherResponsiblePerson"
                    name="otherResponsiblePerson"
                    type="text"
                    value={formData.otherResponsiblePerson || ''}
                    onChange={handleChange}
                />
            </div>
        </>
    );

    const renderStep9 = () => (
        <>
            <h2 className="govuk-heading-l">Funeral details</h2>
            <p className="govuk-body">Tell us about the funeral arrangements.</p>
            
            <div className={`govuk-form-group ${errors.funeralDirector ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="funeralDirector">
                    Name of funeral director or company
                </label>
                {errors.funeralDirector && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.funeralDirector}
                    </p>
                )}
                <input
                    className={`govuk-input ${errors.funeralDirector ? 'govuk-input--error' : ''}`}
                    id="funeralDirector"
                    name="funeralDirector"
                    type="text"
                    value={formData.funeralDirector}
                    onChange={handleChange}
                />
            </div>

            <div className={`govuk-form-group ${errors.funeralCost ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="funeralCost">
                    Total cost of the funeral (in pounds)
                </label>
                {errors.funeralCost && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.funeralCost}
                    </p>
                )}
                <div className="govuk-input__wrapper">
                    <div className="govuk-input__prefix" aria-hidden="true">£</div>
                    <input
                        className={`govuk-input govuk-input--width-10 ${errors.funeralCost ? 'govuk-input--error' : ''}`}
                        id="funeralCost"
                        name="funeralCost"
                        type="text"
                        value={formData.funeralCost}
                        onChange={handleChange}
                    />
                </div>
            </div>

            <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="funeralDate">
                    Date of funeral (optional)
                </label>
                <div className="govuk-hint">
                    If you know when the funeral will take place, enter the date.
                </div>
                <input
                    className="govuk-input govuk-input--width-10"
                    id="funeralDate"
                    name="funeralDate"
                    type="date"
                    value={formData.funeralDate || ''}
                    onChange={handleChange}
                />
            </div>

            <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="funeralLocation">
                    Location of funeral (optional)
                </label>
                <div className="govuk-hint">
                    For example, the name of the church, crematorium, or cemetery.
                </div>
                <input
                    className="govuk-input"
                    id="funeralLocation"
                    name="funeralLocation"
                    type="text"
                    value={formData.funeralLocation || ''}
                    onChange={handleChange}
                />
            </div>

            <div className="govuk-form-group">
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend">
                        Will this be a burial or cremation?
                    </legend>
                    <div className="govuk-radios">
                        {["Burial", "Cremation"].map(type => (
                            <div key={type} className="govuk-radios__item">
                                <input 
                                    className="govuk-radios__input"
                                    id={`burial-type-${type.toLowerCase()}`}
                                    name="burialOrCremation"
                                    type="radio"
                                    value={type}
                                    checked={formData.burialOrCremation === type}
                                    onChange={handleChange}
                                />
                                <label className="govuk-label govuk-radios__label" htmlFor={`burial-type-${type.toLowerCase()}`}>
                                    {type}
                                </label>
                            </div>
                        ))}
                    </div>
                </fieldset>
            </div>
        </>
    );

    const renderStep10 = () => (
        <>
            <h2 className="govuk-heading-l">Estate and assets</h2>
            <p className="govuk-body">Tell us about the deceased person's estate, property and financial assets.</p>
            
            <div className={`govuk-form-group ${errors.estateValue ? 'govuk-form-group--error' : ''}`}>
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend govuk-fieldset__legend--m">
                        What is the estimated total value of the deceased person's estate?
                    </legend>
                    <div className="govuk-hint">
                        Include property, savings, investments, and personal possessions, minus any debts.
                    </div>
                    {errors.estateValue && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.estateValue}
                        </p>
                    )}
                    <div className="govuk-radios">
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="estateValue-under-5000" 
                                name="estateValue" 
                                type="radio" 
                                value="under-5000"
                                checked={formData.estateValue === 'under-5000'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="estateValue-under-5000">
                                Under £5,000
                            </label>
                        </div>
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="estateValue-over-5000" 
                                name="estateValue" 
                                type="radio" 
                                value="over-5000"
                                checked={formData.estateValue === 'over-5000'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="estateValue-over-5000">
                                £5,000 or more
                            </label>
                        </div>
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="estateValue-unknown" 
                                name="estateValue" 
                                type="radio" 
                                value="unknown"
                                checked={formData.estateValue === 'unknown'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="estateValue-unknown">
                                Don't know
                            </label>
                        </div>
                    </div>
                </fieldset>
            </div>

            <div className={`govuk-form-group ${errors.propertyOwned ? 'govuk-form-group--error' : ''}`}>
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend govuk-fieldset__legend--s">
                        Did the deceased person own any property?
                    </legend>
                    <div className="govuk-hint">Include the home they lived in, second homes, or buy-to-let properties</div>
                    {errors.propertyOwned && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.propertyOwned}
                        </p>
                    )}
                    <div className="govuk-radios">
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="propertyOwned-yes" 
                                name="propertyOwned" 
                                type="radio" 
                                value="yes"
                                checked={formData.propertyOwned === 'yes'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="propertyOwned-yes">
                                Yes
                            </label>
                        </div>
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="propertyOwned-no" 
                                name="propertyOwned" 
                                type="radio" 
                                value="no"
                                checked={formData.propertyOwned === 'no'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="propertyOwned-no">
                                No
                            </label>
                        </div>
                    </div>
                </fieldset>
            </div>

            {formData.propertyOwned === 'yes' && (
                <div className={`govuk-form-group ${errors.propertyDetails ? 'govuk-form-group--error' : ''}`}>
                    <label className="govuk-label" htmlFor="propertyDetails">
                        Property details
                    </label>
                    <div className="govuk-hint">
                        Please provide details about the property owned, including type (house, flat, etc.), location, and estimated value if known.
                    </div>
                    {errors.propertyDetails && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.propertyDetails}
                        </p>
                    )}
                    <textarea 
                        className={`govuk-textarea ${errors.propertyDetails ? 'govuk-textarea--error' : ''}`}
                        id="propertyDetails"
                        name="propertyDetails" 
                        rows="3"
                        value={formData.propertyDetails}
                        onChange={handleChange}
                    />
                </div>
            )}

            <div className={`govuk-form-group ${errors.bankAccounts ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="bankAccounts">
                    Bank accounts and building society accounts
                </label>
                <div className="govuk-hint">
                    Tell us about any bank accounts, building society accounts, or other savings the deceased person had.
                </div>
                {errors.bankAccounts && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.bankAccounts}
                    </p>
                )}
                <textarea 
                    className={`govuk-textarea ${errors.bankAccounts ? 'govuk-textarea--error' : ''}`}
                    id="bankAccounts"
                    name="bankAccounts" 
                    rows="3"
                    value={formData.bankAccounts}
                    onChange={handleChange}
                />
            </div>

            <div className={`govuk-form-group ${errors.investments ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="investments">
                    Investments and shares
                </label>
                <div className="govuk-hint">
                    Tell us about any investments, shares, or other financial assets the deceased person had.
                </div>
                {errors.investments && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.investments}
                    </p>
                )}
                <textarea 
                    className={`govuk-textarea ${errors.investments ? 'govuk-textarea--error' : ''}`}
                    id="investments"
                    name="investments" 
                    rows="3"
                    value={formData.investments}
                    onChange={handleChange}
                />
            </div>

            <div className={`govuk-form-group ${errors.lifeInsurance ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="lifeInsurance">
                    Life insurance and pensions
                </label>
                <div className="govuk-hint">
                    Tell us about any life insurance policies or pension schemes the deceased person had.
                </div>
                {errors.lifeInsurance && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.lifeInsurance}
                    </p>
                )}
                <textarea 
                    className={`govuk-textarea ${errors.lifeInsurance ? 'govuk-textarea--error' : ''}`}
                    id="lifeInsurance"
                    name="lifeInsurance" 
                    rows="3"
                    value={formData.lifeInsurance}
                    onChange={handleChange}
                />
            </div>

            <div className={`govuk-form-group ${errors.debtsOwed ? 'govuk-form-group--error' : ''}`}>
                <label className="govuk-label" htmlFor="debtsOwed">
                    Debts and liabilities
                </label>
                <div className="govuk-hint">
                    Tell us about any debts, loans, or other money the deceased person owed.
                </div>
                {errors.debtsOwed && (
                    <p className="govuk-error-message">
                        <span className="govuk-visually-hidden">Error:</span> {errors.debtsOwed}
                    </p>
                )}
                <textarea 
                    className={`govuk-textarea ${errors.debtsOwed ? 'govuk-textarea--error' : ''}`}
                    id="debtsOwed"
                    name="debtsOwed" 
                    rows="3"
                    value={formData.debtsOwed}
                    onChange={handleChange}
                />
            </div>

            <div className={`govuk-form-group ${errors.willExists ? 'govuk-form-group--error' : ''}`}>
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend govuk-fieldset__legend--s">
                        Did the deceased person leave a will?
                    </legend>
                    {errors.willExists && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.willExists}
                        </p>
                    )}
                    <div className="govuk-radios">
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="willExists-yes" 
                                name="willExists" 
                                type="radio" 
                                value="yes"
                                checked={formData.willExists === 'yes'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="willExists-yes">
                                Yes
                            </label>
                        </div>
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="willExists-no" 
                                name="willExists" 
                                type="radio" 
                                value="no"
                                checked={formData.willExists === 'no'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="willExists-no">
                                No
                            </label>
                        </div>
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input" 
                                id="willExists-unknown" 
                                name="willExists" 
                                type="radio" 
                                value="unknown"
                                checked={formData.willExists === 'unknown'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="willExists-unknown">
                                Don't know
                            </label>
                        </div>
                    </div>
                </fieldset>
            </div>

            {formData.willExists === 'yes' && (
                <div className={`govuk-form-group ${errors.willDetails ? 'govuk-form-group--error' : ''}`}>
                    <label className="govuk-label" htmlFor="willDetails">
                        Will details
                    </label>
                    <div className="govuk-hint">
                        Please tell us if you are the executor of the will, a beneficiary, or have any other relationship to the will.
                    </div>
                    {errors.willDetails && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.willDetails}
                        </p>
                    )}
                    <textarea 
                        className={`govuk-textarea ${errors.willDetails ? 'govuk-textarea--error' : ''}`}
                        id="willDetails"
                        name="willDetails" 
                        rows="3"
                        value={formData.willDetails}
                        onChange={handleChange}
                    />
                </div>
            )}
        </>
    );

    const renderStep11 = () => (
        <>
            <h2 className="govuk-heading-l">Your financial circumstances</h2>
            <p className="govuk-body">We need to check if you're eligible for funeral expenses payment.</p>
            
            <div className={`govuk-form-group ${errors.benefitsReceived ? 'govuk-form-group--error' : ''}`}>
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend govuk-fieldset__legend--m">
                        Which benefits do you receive?
                    </legend>
                    <div className="govuk-hint">Select all that apply</div>
                    {errors.benefitsReceived && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.benefitsReceived}
                        </p>
                    )}
                    <div className="govuk-checkboxes govuk-checkboxes--small">
                        {[
                            "Income Support",
                            "Income-based Jobseeker's Allowance", 
                            "Income-related Employment and Support Allowance",
                            "Pension Credit",
                            "Universal Credit",
                            "Child Tax Credit",
                            "Working Tax Credit",
                            "None of these"
                        ].map(benefit => (
                            <div key={benefit} className="govuk-checkboxes__item">
                                <input 
                                    className="govuk-checkboxes__input"
                                    id={`benefit-${benefit.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                                    name="benefitsReceived"
                                    type="checkbox"
                                    value={benefit}
                                    checked={formData.benefitsReceived?.includes(benefit)}
                                    onChange={handleChange}
                                />
                                <label className="govuk-label govuk-checkboxes__label" htmlFor={`benefit-${benefit.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}>
                                    {benefit}
                                </label>
                            </div>
                        ))}
                    </div>
                </fieldset>
            </div>

            <div className={`govuk-form-group ${errors.savings ? 'govuk-form-group--error' : ''}`}>
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend govuk-fieldset__legend--s">
                        Do you have more than £16,000 in savings, investments or property?
                    </legend>
                    <div className="govuk-hint">
                        Do not include the home you live in or personal possessions.
                    </div>
                    {errors.savings && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.savings}
                        </p>
                    )}
                    <div className="govuk-radios">
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input"
                                id="savings-yes"
                                name="savings"
                                type="radio"
                                value="yes"
                                checked={formData.savings === 'yes'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="savings-yes">
                                Yes
                            </label>
                        </div>
                        <div className="govuk-radios__item">
                            <input 
                                className="govuk-radios__input"
                                id="savings-no"
                                name="savings"
                                type="radio"
                                value="no"
                                checked={formData.savings === 'no'}
                                onChange={handleChange}
                            />
                            <label className="govuk-label govuk-radios__label" htmlFor="savings-no">
                                No
                            </label>
                        </div>
                    </div>
                </fieldset>
            </div>

            {formData.savings === 'yes' && (
                <div className={`govuk-form-group ${errors.savingsAmount ? 'govuk-form-group--error' : ''}`}>
                    <label className="govuk-label" htmlFor="savingsAmount">
                        Approximate amount of savings
                    </label>
                    <div className="govuk-hint">
                        Please provide an estimate of your total savings, investments and property value (excluding your main home).
                    </div>
                    {errors.savingsAmount && (
                        <p className="govuk-error-message">
                            <span className="govuk-visually-hidden">Error:</span> {errors.savingsAmount}
                        </p>
                    )}
                    <input 
                        className={`govuk-input govuk-input--width-10 ${errors.savingsAmount ? 'govuk-input--error' : ''}`}
                        id="savingsAmount"
                        name="savingsAmount" 
                        type="text"
                        value={formData.savingsAmount}
                        onChange={handleChange}
                        placeholder="e.g. £25,000"
                    />
                </div>
            )}

            <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="employmentStatus">
                    Employment status (optional)
                </label>
                <div className="govuk-hint">
                    For example, employed, self-employed, unemployed, retired.
                </div>
                <input
                    className="govuk-input"
                    id="employmentStatus"
                    name="employmentStatus"
                    type="text"
                    value={formData.employmentStatus || ''}
                    onChange={handleChange}
                />
            </div>

            <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="otherIncome">
                    Other income (optional)
                </label>
                <div className="govuk-hint">
                    Include any other income you receive, such as pensions or part-time work.
                </div>
                <textarea
                    className="govuk-textarea"
                    id="otherIncome"
                    name="otherIncome"
                    rows="2"
                    value={formData.otherIncome || ''}
                    onChange={handleChange}
                />
            </div>
        </>
    );

    const renderStep12 = () => (
        <>
            <h2 className="govuk-heading-l">Evidence and documentation</h2>
            <p className="govuk-body">You'll need to provide evidence to support your claim.</p>
            
            <div className="govuk-form-group">
                <fieldset className="govuk-fieldset">
                    <legend className="govuk-fieldset__legend">
                        Which documents can you provide? Select all that apply.
                    </legend>
                    <div className="govuk-checkboxes">
                        {[
                            "Death certificate",
                            "Funeral bill or estimate",
                            "Proof of benefits",
                            "Proof of relationship to deceased",
                            "Proof of responsibility for funeral"
                        ].map(doc => (
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

            <div className="govuk-inset-text">
                <p className="govuk-body">You can upload your documents after submitting this application.</p>
            </div>
        </>
    );

    const renderStep13 = () => (
        <>
            <h2 className="govuk-heading-l">Declaration</h2>
            <p className="govuk-body">Please read and agree to the following statements.</p>
            
            <div className="govuk-form-group">
                <div className="govuk-checkboxes">
                    <div className="govuk-checkboxes__item">
                        <input 
                            className="govuk-checkboxes__input"
                            id="declaration-correct"
                            name="informationCorrect"
                            type="checkbox"
                            checked={formData.informationCorrect}
                            onChange={handleChange}
                        />
                        <label className="govuk-label govuk-checkboxes__label" htmlFor="declaration-correct">
                            I declare that the information I have given is true and complete
                        </label>
                    </div>
                    
                    <div className="govuk-checkboxes__item">
                        <input 
                            className="govuk-checkboxes__input"
                            id="declaration-notify"
                            name="notifyChanges"
                            type="checkbox"
                            checked={formData.notifyChanges}
                            onChange={handleChange}
                        />
                        <label className="govuk-label govuk-checkboxes__label" htmlFor="declaration-notify">
                            I understand that I must notify DWP if my circumstances change
                        </label>
                    </div>
                    
                    <div className="govuk-checkboxes__item">
                        <input 
                            className="govuk-checkboxes__input"
                            id="declaration-agreed"
                            name="declarationAgreed"
                            type="checkbox"
                            checked={formData.declarationAgreed}
                            onChange={handleChange}
                        />
                        <label className="govuk-label govuk-checkboxes__label" htmlFor="declaration-agreed">
                            I agree to the terms and conditions
                        </label>
                    </div>
                </div>
            </div>

            <div className="govuk-warning-text">
                <span className="govuk-warning-text__icon" aria-hidden="true">!</span>
                <strong className="govuk-warning-text__text">
                    <span className="govuk-warning-text__assistive">Warning</span>
                    You may be prosecuted if you deliberately give wrong or incomplete information.
                </strong>
            </div>
        </>
    );

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
        <div className="govuk-width-container">
            <main className="govuk-main-wrapper" id="main-content" role="main">
                <div className="govuk-grid-row">
                    <div className="govuk-grid-column-two-thirds">
                        <nav className="govuk-breadcrumbs" aria-label="Breadcrumb">
                            <ol className="govuk-breadcrumbs__list">
                                <li className="govuk-breadcrumbs__list-item">
                                    <Link className="govuk-breadcrumbs__link" to="/dashboard">Your applications</Link>
                                </li>
                                <li className="govuk-breadcrumbs__list-item">
                                    <Link className="govuk-breadcrumbs__link" to="/tasks">Apply for funeral expenses payment</Link>
                                </li>
                                <li className="govuk-breadcrumbs__list-item">
                                    Complete section
                                </li>
                            </ol>
                        </nav>

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
                            {currentStep === 1 && renderStep1()}
                            {currentStep === 2 && renderStep2()}
                            {currentStep === 3 && renderStep3()}
                            {currentStep === 4 && renderStep4()}
                            {currentStep === 5 && renderStep5()}
                            {currentStep === 6 && renderStep6()}
                            {currentStep === 7 && renderStep7()}
                            {currentStep === 8 && renderStep8()}
                            {currentStep === 9 && renderStep9()}
                            {currentStep === 10 && renderStep10()}
                            {currentStep === 11 && renderStep11()}
                            {currentStep === 12 && renderStep12()}
                            {currentStep === 13 && renderStep13()}

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
                    </div>
                </div>
            </main>
        </div>
    );
};

export default FormPage;
