// frontend/src/services/api.js

import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

// =========================
// AUTH API
// =========================
export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),

  // FIXED LOGIN REQUEST
  login: (data) =>
    api.post('/api/auth/login', data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }),

  getMe: () => api.get('/api/auth/me'),
}

// =========================
// UPLOAD API
// =========================
export const uploadAPI = {
  uploadFile: (file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)

    return api.post('/api/upload/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },

      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          )

          onProgress(percentCompleted)
        }
      },
    })
  },
}

// =========================
// DOCUMENTS API
// =========================
export const documentsAPI = {
  getDocuments: () => api.get('/api/documents'),

  getDocument: (id) => api.get(`/api/documents/${id}`),

  deleteDocument: (id) => api.delete(`/api/documents/${id}`),
}

// =========================
// CHAT API
// =========================
export const chatAPI = {
  askQuestion: (documentId, question) =>
    api.post('/api/chat/ask', {
      document_id: documentId,
      question,
    }),

  askQuestionStream: async (documentId, question, onChunk) => {
    const token = useAuthStore.getState().token

    const response = await fetch(
      `${API_BASE_URL}/api/chat/ask-stream`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          document_id: documentId,
          question,
        }),
      }
    )

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      const chunk = decoder.decode(value)

      onChunk(chunk)
    }
  },

  summarize: (documentId) =>
    api.post('/api/chat/summarize', {
      document_id: documentId,
    }),
}

export default api