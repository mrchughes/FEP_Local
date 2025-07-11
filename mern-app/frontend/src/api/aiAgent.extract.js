// src/api/aiAgent.extract.js
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5200/api";

export async function getAISuggestions(formData, token) {
  const res = await fetch(`${API_URL}/ai-agent/suggest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ formData }),
  });
  if (!res.ok) throw new Error("AI suggestion failed");
  return await res.json();
}

export async function extractFormData(token) {
  const res = await fetch(`${API_URL}/ai-agent/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}), // Empty body for POST request
  });
  if (!res.ok) throw new Error("AI extraction failed");
  return await res.json();
}
