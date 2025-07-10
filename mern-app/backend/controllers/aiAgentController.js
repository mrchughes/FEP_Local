// backend/controllers/aiAgentController.js
const axios = require("axios");
const path = require("path");
const fs = require("fs");

// Path to AI agent docs dir (adjust if needed)
const AI_AGENT_DOCS = path.join(__dirname, "../../../python-app/app/ai_agent/docs");
const EVIDENCE_UPLOADS = path.join(__dirname, "../../uploads/evidence");

// Copy new evidence files to AI agent docs dir
function syncEvidenceToAIAgent() {
    if (!fs.existsSync(AI_AGENT_DOCS)) fs.mkdirSync(AI_AGENT_DOCS, { recursive: true });
    const files = fs.readdirSync(EVIDENCE_UPLOADS);
    for (const file of files) {
        const src = path.join(EVIDENCE_UPLOADS, file);
        const dest = path.join(AI_AGENT_DOCS, file);
        if (!fs.existsSync(dest)) {
            fs.copyFileSync(src, dest);
        }
    }
}

// POST /api/ai-agent/suggest
// { formData: {...} }
async function getSuggestions(req, res) {
    try {
        syncEvidenceToAIAgent();
        // Optionally trigger re-ingest in AI agent (could call /ai-agent/ingest endpoint if exposed)
        // Call AI agent to get suggestions
        const aiRes = await axios.post("http://localhost:5050/ai-agent/check-form", {
            content: JSON.stringify(req.body.formData)
        });
        res.json({ suggestions: aiRes.data.response });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = { getSuggestions };
