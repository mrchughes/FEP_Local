// Form progress tracking utility
// Manages section completion status and validation

export const FORM_SECTIONS = {
    PERSONAL_DETAILS: {
        id: 'personal-details',
        title: 'Your personal details',
        step: 1,
        fields: ['firstName', 'lastName', 'dateOfBirth', 'nationalInsuranceNumber']
    },
    CONTACT_DETAILS: {
        id: 'contact-details', 
        title: 'Your contact details',
        step: 2,
        fields: ['address', 'postcode', 'phoneNumber', 'email']
    },
    PARTNER_DETAILS: {
        id: 'partner-details',
        title: 'Partner details',
        step: 3,
        fields: ['hasPartner', 'partnerFirstName', 'partnerLastName', 'partnerDateOfBirth', 'partnerNationalInsuranceNumber', 'partnerBenefitsReceived', 'partnerSavings']
    },
    FAMILY_COMPOSITION: {
        id: 'family-composition',
        title: 'Family composition and dependents',
        step: 4,
        fields: ['hasChildren', 'numberOfChildren', 'childrenDetails', 'hasDependents', 'dependentsDetails', 'householdSize', 'householdMembers']
    },
    ENHANCED_BENEFITS: {
        id: 'enhanced-benefits',
        title: 'Enhanced benefits information',
        step: 5,
        fields: ['householdBenefits', 'incomeSupportDetails', 'disabilityBenefits', 'carersAllowance', 'carersAllowanceDetails']
    },
    ABOUT_DECEASED: {
        id: 'about-deceased',
        title: 'About the person who died',
        step: 6,
        fields: ['deceasedFirstName', 'deceasedLastName', 'deceasedDateOfBirth', 'deceasedDateOfDeath', 'relationshipToDeceased']
    },
    DECEASED_ADDRESS: {
        id: 'deceased-address',
        title: 'Address of the person who died',
        step: 7,
        fields: ['deceasedAddress', 'deceasedPostcode', 'deceasedUsualAddress']
    },
    RESPONSIBILITY: {
        id: 'responsibility',
        title: 'Responsibility for funeral arrangements',
        step: 8,
        fields: ['responsibilityReason', 'nextOfKin', 'otherResponsiblePerson']
    },
    FUNERAL_DETAILS: {
        id: 'funeral-details',
        title: 'Funeral details',
        step: 9,
        fields: ['funeralDirector', 'funeralCost', 'funeralDate', 'funeralLocation', 'burialOrCremation']
    },
    ESTATE_ASSETS: {
        id: 'estate-assets',
        title: 'Estate and assets',
        step: 10,
        fields: ['estateValue', 'propertyOwned', 'propertyDetails', 'bankAccounts', 'investments', 'lifeInsurance', 'debtsOwed', 'willExists', 'willDetails']
    },
    FINANCIAL_CIRCUMSTANCES: {
        id: 'financial-circumstances',
        title: 'Your financial circumstances',
        step: 11,
        fields: ['benefitsReceived', 'employmentStatus', 'savings', 'savingsAmount', 'otherIncome']
    },
    EVIDENCE_DOCUMENTATION: {
        id: 'evidence-documentation',
        title: 'Evidence and documentation',
        step: 12,
        fields: ['evidence']
    },
    DECLARATION: {
        id: 'declaration',
        title: 'Declaration',
        step: 13,
        fields: ['declarationAgreed', 'informationCorrect', 'notifyChanges']
    }
};

// Status types
export const STATUS = {
    NOT_STARTED: 'not-started',
    IN_PROGRESS: 'in-progress', 
    COMPLETED: 'completed'
};

// Check if a section is completed based on required fields
export const getSectionStatus = (formData, section) => {
    const requiredFields = section.fields;
    const filledFields = requiredFields.filter(field => {
        const value = formData[field];
        if (Array.isArray(value)) {
            return value.length > 0;
        }
        return value && value.toString().trim() !== '';
    });

    if (filledFields.length === 0) {
        return STATUS.NOT_STARTED;
    } else if (filledFields.length === requiredFields.length) {
        return STATUS.COMPLETED;
    } else {
        return STATUS.IN_PROGRESS;
    }
};

// Get status for all sections
export const getAllSectionStatuses = (formData) => {
    const statuses = {};
    Object.values(FORM_SECTIONS).forEach(section => {
        statuses[section.id] = getSectionStatus(formData, section);
    });
    return statuses;
};

// Check if user has any progress (any field filled)
export const hasAnyProgress = (formData) => {
    if (!formData || typeof formData !== 'object') {
        console.log('🔍 hasAnyProgress: No formData or invalid format:', formData);
        return false;
    }
    
    const allFields = Object.values(FORM_SECTIONS).flatMap(section => section.fields);
    console.log('🔍 hasAnyProgress: Checking fields:', allFields);
    
    const hasProgress = allFields.some(field => {
        const value = formData[field];
        let hasValue = false;
        
        if (Array.isArray(value)) {
            hasValue = value.length > 0;
        } else {
            hasValue = value && value.toString().trim() !== '';
        }
        
        if (hasValue) {
            console.log('🔍 hasAnyProgress: Found value for field:', field, '=', value);
        }
        
        return hasValue;
    });
    
    console.log('🔍 hasAnyProgress: Result:', hasProgress);
    return hasProgress;
};

// Get overall progress percentage
export const getOverallProgress = (formData) => {
    const statuses = getAllSectionStatuses(formData);
    const completedSections = Object.values(statuses).filter(status => status === STATUS.COMPLETED).length;
    const totalSections = Object.keys(FORM_SECTIONS).length;
    return Math.round((completedSections / totalSections) * 100);
};

// Save section completion status to localStorage
export const saveSectionProgress = (userId, sectionStatuses) => {
    if (!userId) return;
    
    try {
        const key = `funeral_form_sections_${userId}`;
        localStorage.setItem(key, JSON.stringify(sectionStatuses));
    } catch (error) {
        console.warn('Failed to save section progress:', error);
    }
};

// Load section completion status from localStorage
export const loadSectionProgress = (userId) => {
    if (!userId) return {};
    
    try {
        const key = `funeral_form_sections_${userId}`;
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : {};
    } catch (error) {
        console.warn('Failed to load section progress:', error);
        return {};
    }
};

// Clear section progress from localStorage
export const clearSectionProgress = (userId) => {
    if (!userId) return;
    
    try {
        const key = `funeral_form_sections_${userId}`;
        localStorage.removeItem(key);
    } catch (error) {
        console.warn('Failed to clear section progress:', error);
    }
};

// Get section by step number
export const getSectionByStep = (stepNumber) => {
    return Object.values(FORM_SECTIONS).find(section => section.step === stepNumber);
};

// Get section by ID
export const getSectionById = (sectionId) => {
    return Object.values(FORM_SECTIONS).find(section => section.id === sectionId);
};
