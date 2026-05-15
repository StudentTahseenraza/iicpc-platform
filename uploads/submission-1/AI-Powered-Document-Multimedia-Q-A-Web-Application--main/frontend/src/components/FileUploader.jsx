// frontend/src/components/FileUploader.jsx
import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { uploadAPI } from '../services/api'
import { Upload, Loader2, File, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

function FileUploader({ onUploadComplete, compact = false }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return

    setUploading(true)
    setProgress(0)

    try {
      await uploadAPI.uploadFile(file, (progress) => {
        setProgress(progress)
      })
      
      toast.success(`${file.name} uploaded successfully!`)
      onUploadComplete?.()
      setProgress(0)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [onUploadComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    disabled: uploading,
  })

  if (compact) {
    return (
      <div
        {...getRootProps()}
        className="flex items-center justify-center p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition"
      >
        <input {...getInputProps()} />
        {uploading ? (
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        ) : (
          <Upload className="w-5 h-5 text-gray-500" />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`upload-dropzone ${isDragActive ? 'border-blue-500 bg-blue-50' : ''}`}
      >
        <input {...getInputProps()} />
        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">
          {isDragActive ? 'Drop the file here' : 'Drag & drop or click to upload'}
        </p>
        <p className="text-xs text-gray-400 mt-2">
          PDF, MP3, WAV, MP4, WebM (Max 100MB)
        </p>
      </div>

      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Uploading...</span>
            <span className="text-gray-500">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default FileUploader