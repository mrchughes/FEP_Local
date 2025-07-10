// Utility functions for evidence API
export async function uploadEvidenceFile(file, token) {
  const formData = new FormData();
  formData.append("evidence", file);
  const res = await fetch("/api/evidence/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return await res.json();
}

export async function deleteEvidenceFile(filename, token) {
  const res = await fetch(`/api/evidence/${encodeURIComponent(filename)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Delete failed");
  return await res.json();
}
