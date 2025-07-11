// Utility functions for evidence API

// Use backend API URL directly for production and dev
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5200/api";

export async function uploadEvidenceFile(file, token) {
  const formData = new FormData();
  formData.append("evidence", file);
  const res = await fetch(`${API_URL}/evidence/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return await res.json();
}


export async function deleteEvidenceFile(filename, token) {
  const res = await fetch(`${API_URL}/evidence/${encodeURIComponent(filename)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Delete failed");
  return await res.json();
}
