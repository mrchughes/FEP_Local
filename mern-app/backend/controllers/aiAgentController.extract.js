// backend/controllers/aiAgentController.js (append to existing file)
const axios = require("axios");
const path = require("path");
const fs = require("fs");

// Function to ensure the AI agent docs directory exists
function ensureAIAgentDocsDir() {
    const AI_AGENT_DOCS = path.join(__dirname, "../../../shared-evidence");
    console.log(`[AI EXTRACT] Using shared evidence path: ${AI_AGENT_DOCS}`);
    if (!fs.existsSync(AI_AGENT_DOCS)) {
        fs.mkdirSync(AI_AGENT_DOCS, { recursive: true });
        console.log(`[AI EXTRACT] Created shared evidence directory: ${AI_AGENT_DOCS}`);
    }
    return AI_AGENT_DOCS;
}

// Function to sync evidence files to AI agent docs directory
function syncEvidenceToAIAgent() {
    const AI_AGENT_DOCS = ensureAIAgentDocsDir();
    const EVIDENCE_UPLOADS = path.join(__dirname, "../uploads/evidence");

    if (!fs.existsSync(EVIDENCE_UPLOADS)) {
        fs.mkdirSync(EVIDENCE_UPLOADS, { recursive: true });
        console.log(`[AI EXTRACT] Created evidence uploads directory: ${EVIDENCE_UPLOADS}`);
        return;
    }

    const files = fs.readdirSync(EVIDENCE_UPLOADS);
    console.log(`[AI EXTRACT] Found ${files.length} files to sync to AI agent`);

    let syncCount = 0;
    for (const file of files) {
        const src = path.join(EVIDENCE_UPLOADS, file);
        const dest = path.join(AI_AGENT_DOCS, file);

        // Check if the file actually exists and is a file (not a directory)
        if (fs.existsSync(src) && fs.statSync(src).isFile()) {
            try {
                fs.copyFileSync(src, dest);
                console.log(`[SYNC] Copied evidence file ${src} to shared volume ${dest}`);
                syncCount++;
            } catch (err) {
                console.error(`[SYNC ERROR] Failed to copy ${src} to ${dest}:`, err.message);
            }
        } else {
            console.warn(`[SYNC WARN] Source file ${src} does not exist or is not a file`);
        }
    }

    console.log(`[AI EXTRACT] Successfully synced ${syncCount} of ${files.length} files to AI agent docs directory`);
    return syncCount;
}

// POST /api/ai-agent/extract
// Calls the AI agent to extract form data from evidence files
async function extractFormData(req, res) {
    try {
        // Sync evidence files to AI agent docs dir
        syncEvidenceToAIAgent();

        // Get list of evidence files
        const EVIDENCE_UPLOADS = path.join(__dirname, "../uploads/evidence");
        const files = fs.existsSync(EVIDENCE_UPLOADS) ? fs.readdirSync(EVIDENCE_UPLOADS) : [];

        if (files.length === 0) {
            console.log('[AI EXTRACT] No evidence files found to extract data from');
            return res.json({ extracted: {} });
        }

        console.log(`[AI EXTRACT] Found ${files.length} evidence files to process`);            // Call AI agent extraction endpoint using environment variable
        const aiAgentUrl = process.env.AI_AGENT_URL || "http://ai-agent:5050";
        const endpoint = `${aiAgentUrl}/ai-agent/extract-form-data`;
        console.log(`[AI EXTRACT] Calling AI agent at ${endpoint}`);
        try {
            // Send the list of files to extract data from
            console.log(`[AI EXTRACT] Sending request with files:`, files);

            const aiRes = await axios.post(endpoint, {
                files: files
            }, {
                headers: {
                    "Content-Type": "application/json"
                },
                timeout: 120000, // 120 second timeout for extraction (increased from 90s)
                validateStatus: null // Don't throw errors for non-2xx status codes
            });

            console.log(`[AI EXTRACT] AI agent response status: ${aiRes.status}`);

            // Check for invalid response
            if (!aiRes || aiRes.status !== 200) {
                const errorMsg = aiRes ?
                    `AI agent returned status ${aiRes.status}: ${JSON.stringify(aiRes.data)}` :
                    'No response from AI agent';
                console.error(`[AI EXTRACT] ${errorMsg}`);
                return res.status(500).json({ error: errorMsg });
            }

            // Debug the response
            console.log('[AI EXTRACT] AI agent response received');
            console.log('[AI EXTRACT] Response type:', typeof aiRes.data);
            console.log('[AI EXTRACT] Response structure:', aiRes.data ? Object.keys(aiRes.data) : 'null or undefined');

            // Validate response data
            if (!aiRes.data) {
                console.error('[AI EXTRACT] AI agent returned empty response');
                return res.status(500).json({ error: 'AI agent returned empty response' });
            }

            // Convert any string data to object if needed
            let extractedData = aiRes.data;
            if (typeof extractedData === 'string') {
                try {
                    console.log('[AI EXTRACT] Parsing string response as JSON');
                    extractedData = JSON.parse(extractedData);
                } catch (parseErr) {
                    console.error('[AI EXTRACT] Failed to parse response as JSON:', parseErr.message);
                    console.error('[AI EXTRACT] Raw response:', aiRes.data);
                    return res.status(500).json({ error: 'Failed to parse AI agent response' });
                }
            }

            // Return the extracted data
            console.log('[AI EXTRACT] Successfully extracted data from files');
            res.json({ extracted: extractedData });
        } catch (err) {
            console.error("[AI EXTRACT] Extraction error:", err.message);
            console.error("[AI EXTRACT] Error details:", err.stack);
            console.error("[AI EXTRACT] Error response:", err.response?.data);
            res.status(500).json({ error: `AI extraction failed: ${err.message}` });
        }
    } catch (err) {
        console.error("AI extraction error:", err.message);
        res.status(500).json({ error: err.message });
    }
}

module.exports.extractFormData = extractFormData;
