// src/api/aiAgent.js
export async function getAISuggestions(formData, token) {
  const res = await fetch("/api/ai-agent/suggest", {
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
