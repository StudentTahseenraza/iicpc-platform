// frontend/src/components/Dashboard.jsx
import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useDocumentStore } from '../store/documentStore'
import FileUploader from './FileUploader'
import ChatBot from './ChatBot'
import Summarizer from './Summarizer'
import MediaPlayer from './MediaPlayer'
import { LogOut, FileText, MessageSquare, Sparkles, Menu, X } from 'lucide-react'

function Dashboard() {
  const { user, logout } = useAuthStore()
  const { documents, selectedDocument, fetchDocuments, selectDocument, clearSelected } = useDocumentStore()
  const [activeTab, setActiveTab] = useState('chat')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    fetchDocuments()
  }, [])

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            {sidebarOpen && <span className="font-semibold text-gray-800">AI Document Q&A</span>}
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-gray-100 rounded">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* User Info */}
        {sidebarOpen && (
          <div className="p-4 border-b border-gray-200">
            <p className="text-sm text-gray-600">Logged in as</p>
            <p className="font-medium text-gray-900">{user?.full_name || user?.email}</p>
          </div>
        )}

        {/* Upload Section */}
        <div className="p-4 border-b border-gray-200">
          <FileUploader onUploadComplete={() => fetchDocuments()} compact={!sidebarOpen} />
        </div>

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto p-4">
          {sidebarOpen && <h3 className="text-sm font-medium text-gray-500 mb-3">Your Documents</h3>}
          <div className="space-y-2">
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => selectDocument(doc)}
                className={`w-full text-left p-3 rounded-lg transition ${
                  selectedDocument?.id === doc.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className={`w-4 h-4 ${sidebarOpen ? '' : 'mx-auto'}`} />
                  {sidebarOpen && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                      <p className="text-xs text-gray-500 capitalize">{doc.file_type}</p>
                    </div>
                  )}
                </div>
              </button>
            ))}
            {documents.length === 0 && sidebarOpen && (
              <p className="text-sm text-gray-500 text-center py-4">No documents yet. Upload one!</p>
            )}
          </div>
        </div>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {selectedDocument && (
          <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{selectedDocument.filename}</h1>
              <p className="text-sm text-gray-500">Ready for Q&A</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  activeTab === 'chat' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Chat
              </button>
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  activeTab === 'summary' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Summary
              </button>
            </div>
            <button
              onClick={clearSelected}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!selectedDocument ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-700 mb-2">No Document Selected</h2>
                <p className="text-gray-500">Upload a document or select one from the sidebar to start asking questions.</p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'chat' && <ChatBot documentId={selectedDocument.id} />}
              {activeTab === 'summary' && <Summarizer documentId={selectedDocument.id} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard