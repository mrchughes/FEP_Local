# Sample policy document text
POLICY_DOCUMENT = """
# Funeral Expenses Payment Policy

## Overview
The Funeral Expenses Payment can help pay for some of the costs of a funeral. 
The payment won't usually cover all of the costs of the funeral.

## Eligibility
You may be eligible for a Funeral Expenses Payment if all of the following apply:
- you get certain benefits or tax credits
- you meet the rules on your relationship with the deceased
- you're arranging a funeral in the UK, the European Economic Area (EEA) or Switzerland

## Benefits and tax credits that qualify
You (or your partner) must get one or more of the following:
- Income Support
- income-based Jobseeker's Allowance
- income-related Employment and Support Allowance
- Pension Credit
- Housing Benefit
- the disability or severe disability element of Working Tax Credit
- Child Tax Credit
- Universal Credit

## Required Documentation
You must provide the following documents:
- Death certificate
- Funeral bill or invoice
- Proof of benefits
- Proof of relationship to the deceased
- Proof of responsibility for the funeral arrangements

## How to apply
You can apply by phone or by post.

### By phone
Call the Bereavement Service helpline:
Telephone: 0800 731 0469
Welsh language: 0800 731 0453
Textphone: 0800 731 0464
Welsh language textphone: 0800 731 0456

### By post
Download and fill in the claim form. Submit it to your local Jobcentre Plus.

## What the payment covers
Funeral Expenses Payment can help pay for:
- burial fees for a particular plot
- cremation fees, including the cost of the doctor's certificate
- travel to arrange or go to the funeral
- the cost of moving the body within the UK, if it's being moved more than 50 miles
- death certificates or other documents
- up to £1,000 for any other funeral expenses, such as funeral director's fees, flowers or the coffin

The payment will not cover the cost of items and services such as flowers, the wake or funeral notice.
"""

# Sample chat queries and expected responses
CHAT_QUERIES = [
    {
        "query": "What documents do I need for a funeral payment claim?",
        "expected_keywords": ["death certificate", "funeral bill", "proof of benefits", 
                              "proof of relationship", "proof of responsibility"]
    },
    {
        "query": "Am I eligible for funeral expenses payment?",
        "expected_keywords": ["benefits", "tax credits", "relationship with the deceased", 
                              "funeral in the UK", "income support", "universal credit"]
    },
    {
        "query": "How much can I get for other funeral expenses?",
        "expected_keywords": ["£1,000", "funeral director's fees", "flowers", "coffin"]
    },
    {
        "query": "How do I apply for the payment?",
        "expected_keywords": ["phone", "post", "bereavement service helpline", 
                              "claim form", "jobcentre plus"]
    },
    {
        "query": "What costs are not covered by the payment?",
        "expected_keywords": ["flowers", "wake", "funeral notice"]
    }
]

# Sample document metadata
DOCUMENT_METADATA = [
    {
        "filename": "funeral_expenses_policy.pdf",
        "title": "Funeral Expenses Payment Policy",
        "date": "2023-06-15",
        "author": "Department for Work and Pensions",
        "pages": 12
    },
    {
        "filename": "application_process.pdf",
        "title": "Funeral Expenses Payment Application Process",
        "date": "2023-07-01",
        "author": "Department for Work and Pensions",
        "pages": 5
    },
    {
        "filename": "eligibility_criteria.pdf",
        "title": "Eligibility Criteria for Funeral Expenses Payment",
        "date": "2023-08-12",
        "author": "Department for Work and Pensions",
        "pages": 8
    }
]

# Sample user profiles for testing
USER_PROFILES = [
    {
        "id": "user1",
        "name": "John Smith",
        "benefits": ["Universal Credit"],
        "relationship": "spouse",
        "documents_submitted": ["Death Certificate", "Funeral Invoice"]
    },
    {
        "id": "user2",
        "name": "Mary Johnson",
        "benefits": ["Income Support", "Housing Benefit"],
        "relationship": "child",
        "documents_submitted": ["Death Certificate", "Proof of Relationship"]
    },
    {
        "id": "user3",
        "name": "David Williams",
        "benefits": ["Pension Credit"],
        "relationship": "parent",
        "documents_submitted": []
    }
]

# Sample API responses for mocking
API_RESPONSES = {
    "chat": {
        "success": {
            "response": "Based on the policy, you need to provide the following documents: Death certificate, Funeral bill or invoice, Proof of benefits, Proof of relationship to the deceased, and Proof of responsibility for the funeral arrangements."
        },
        "error": {
            "error": "Invalid request. The 'query' field is required."
        }
    },
    "upload": {
        "success": {
            "success": True,
            "message": "Document processed successfully and added to collection."
        },
        "error": {
            "success": False,
            "error": "Failed to process document. Invalid file format."
        }
    },
    "health": {
        "status": "ok",
        "version": "1.0.0"
    }
}

# Sample extraction results for evidence documents
EVIDENCE_EXTRACTION_RESULTS = {
    "Death_Certificate.docx": {
        "deceased_name": "Robert Johnson",
        "date_of_death": "2023-05-10",
        "place_of_death": "London General Hospital",
        "cause_of_death": "Heart Failure",
        "registration_district": "London",
        "registration_number": "DX123456"
    },
    "Funeral_Bill.docx": {
        "funeral_director": "Smith Funeral Services",
        "funeral_date": "2023-05-17",
        "total_cost": "£3,450.00",
        "services": [
            "Basic funeral director services: £1,800.00",
            "Coffin: £750.00",
            "Cremation fee: £650.00",
            "Flowers: £150.00",
            "Car hire: £100.00"
        ]
    },
    "Proof_of_Benefits.docx": {
        "benefit_type": "Universal Credit",
        "recipient_name": "Jane Johnson",
        "reference_number": "UC123456789",
        "payment_amount": "£865.42",
        "payment_frequency": "Monthly"
    }
}
