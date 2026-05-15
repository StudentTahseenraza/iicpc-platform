// frontend/src/components/Summarizer.jsx
import React, { useState, useEffect } from 'react'
import { chatAPI } from '../services/api'
import { Sparkles, Loader2, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'

function Summarizer({ documentId }) {
  const [summary, setSummary] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchSummary()
  }, [documentId])

  const fetchSummary = async () => {
    setIsLoading(true)
    try {
      const response = await chatAPI.summarize(documentId)
      setSummary(response.data.summary)
    } catch (error) {
      toast.error('Failed to generate summary')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard')
  }

  const handleRegenerate = () => {
    fetchSummary()
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">AI Summary</h2>
              <p className="text-sm text-gray-500">Automatically generated content summary</p>
            </div>
          </div>
          
          {summary && (
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={handleRegenerate}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded-lg transition disabled:opacity-50"
              >
                Regenerate
              </button>
            </div>
          )}
        </div>

        {/* Summary Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
            <p className="text-gray-500">Generating summary...</p>
          </div>
        ) : summary ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="prose prose-sm max-w-none">
              {summary.split('\n').map((paragraph, idx) => (
                <p key={idx} className="text-gray-700 leading-relaxed mb-4">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No summary available yet.</p>
          </div>
        )}

        {/* Tips */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 mb-2">💡 Tips for better results</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Upload clear, text-based PDFs for best results</li>
            <li>• Audio/video files are automatically transcribed</li>
            <li>• Ask specific questions in the Chat tab for detailed answers</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Summarizer