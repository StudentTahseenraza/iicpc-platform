// frontend/src/store/documentStore.js
import { create } from 'zustand'
import { documentsAPI } from '../services/api'
import toast from 'react-hot-toast'

export const useDocumentStore = create((set, get) => ({
  documents: [],
  selectedDocument: null,
  isLoading: false,
  
  fetchDocuments: async () => {
    set({ isLoading: true })
    try {
      const response = await documentsAPI.getDocuments()
      set({ documents: response.data, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      toast.error('Failed to fetch documents')
    }
  },
  
  selectDocument: (document) => {
    set({ selectedDocument: document })
  },
  
  deleteDocument: async (id) => {
    try {
      await documentsAPI.deleteDocument(id)
      const { documents } = get()
      set({ documents: documents.filter(d => d.id !== id) })
      toast.success('Document deleted')
    } catch (error) {
      toast.error('Failed to delete document')
    }
  },
  
  clearSelected: () => {
    set({ selectedDocument: null })
  },
}))