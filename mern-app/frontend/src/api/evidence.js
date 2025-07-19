// Utility functions for evidence API

// Use backend API URL directly for production and dev
const API_URL = process.env.REACT_APP_API_URL || "/api";

export async function uploadEvidenceFile(file, token, onProgress) {
  const formData = new FormData();
  formData.append("evidence", file);

  console.log(`[EVIDENCE API] Starting upload for file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

  // Use XMLHttpRequest to track upload progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Set up progress tracking
    if (onProgress && typeof onProgress === 'function') {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          console.log(`[EVIDENCE API] Upload progress for ${file.name}: ${percentComplete}%`);
          onProgress(percentComplete, file.name);
        }
      });
    }

    xhr.open('POST', `${API_URL}/evidence/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          console.log(`[EVIDENCE API] Upload successful for ${file.name}:`, response);
          resolve(response);
        } catch (e) {
          console.error(`[EVIDENCE API] Invalid JSON response for ${file.name}:`, e);
          reject(new Error('Invalid JSON response'));
        }
      } else {
        console.error(`[EVIDENCE API] Upload failed for ${file.name} with status: ${xhr.status}, response: ${xhr.responseText}`);
        reject(new Error(`Upload failed: ${xhr.responseText || 'Server error'}`));
      }
    };

    xhr.onerror = function () {
      console.error(`[EVIDENCE API] Network error during upload for ${file.name}`);
      reject(new Error('Network error during upload'));
    };

    xhr.send(formData);
  });
}


export async function deleteEvidenceFile(filename, token) {
  const res = await fetch(`${API_URL}/evidence/${encodeURIComponent(filename)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Delete failed");
  return await res.json();
}


export async function getEvidenceList(token) {
  console.log(`[EVIDENCE API] Getting list of uploaded evidence files`);

  try {
    const response = await fetch(`${API_URL}/evidence/list`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EVIDENCE API] List error: ${response.status}, ${errorText}`);
      throw new Error(`Failed to list evidence: ${errorText || 'Server error'}`);
    }

    const data = await response.json();
    console.log(`[EVIDENCE API] Retrieved ${data.files?.length || 0} evidence files`);
    return data.files || [];
  } catch (error) {
    console.error(`[EVIDENCE API] List error:`, error);
    throw error;
  }
}
