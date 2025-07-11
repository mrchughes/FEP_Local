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
        return;
    }
    const files = fs.readdirSync(EVIDENCE_UPLOADS);
    for (const file of files) {
        const src = path.join(EVIDENCE_UPLOADS, file);
        const dest = path.join(AI_AGENT_DOCS, file);
        try {
            fs.copyFileSync(src, dest);
            console.log(`[SYNC] Copied evidence file ${src} to shared volume ${dest}`);
        } catch (err) {
            console.error(`[SYNC ERROR] Failed to copy ${src} to ${dest}:`, err.message);
        }
    }
}

// POST /api/ai-agent/extract
// Calls the AI agent to extract form data from evidence files
async function extractFormData(req, res) {
    try {
        // Sync evidence files to AI agent docs dir
        syncEvidenceToAIAgent();

        // Call AI agent extraction endpoint using environment variable
        const aiAgentUrl = process.env.AI_AGENT_URL || "http://localhost:5100";
        const endpoint = `${aiAgentUrl}/ai-agent/extract-form-data`;
        console.log(`[AI EXTRACT] Calling AI agent at ${endpoint}`);
        try {
            const aiRes = await axios.post(endpoint, {}, {
                headers: {
                    "Content-Type": "application/json"
                },
                timeout: 30000 // 30 second timeout for extraction
            });
            console.log('[AI EXTRACT] AI agent response:', aiRes.data);
            res.json({ extracted: aiRes.data });
        } catch (err) {
            console.error("AI extraction error:", err.message);
            console.error("AI extraction error details:", err.stack);
            res.status(500).json({ error: `AI extraction failed: ${err.message}` });
        }
    } catch (err) {
        console.error("AI extraction error:", err.message);
        res.status(500).json({ error: err.message });
    }
}

module.exports.extractFormData = extractFormData;
