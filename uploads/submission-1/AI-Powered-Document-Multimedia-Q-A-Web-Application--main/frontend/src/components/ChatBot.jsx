// frontend/src/components/ChatBot.jsx
import React, { useState, useRef, useEffect } from 'react'
import { chatAPI } from '../services/api'
import { Send, Loader2, Clock, Play, ChevronDown, MessageSquare } from 'lucide-react'
import ReactPlayer from 'react-player'
import toast from 'react-hot-toast'

function ChatBot({ documentId }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showTimestampPlayer, setShowTimestampPlayer] = useState(false)
  const [currentTimestamp, setCurrentTimestamp] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = { role: 'user', content: input, timestamps: [] }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Add placeholder bot message
    const botMessageId = Date.now()
    setMessages(prev => [...prev, { 
      id: botMessageId, 
      role: 'bot', 
      content: '', 
      timestamps: [],
      streaming: true 
    }])

    try {
      let fullResponse = ''
      let timestamps = []

      await chatAPI.askQuestionStream(documentId, input, (chunk) => {
        fullResponse += chunk
        setMessages(prev => prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, content: fullResponse, streaming: true }
            : msg
        ))
      })

      // Get final response with timestamps
      const finalResponse = await chatAPI.askQuestion(documentId, input)
      timestamps = finalResponse.data.timestamps || []

      // Update final message
      setMessages(prev => prev.map(msg => 
        msg.id === botMessageId 
          ? { ...msg, content: fullResponse, timestamps, streaming: false }
          : msg
      ))

    } catch (error) {
      setMessages(prev => prev.map(msg => 
        msg.id === botMessageId 
          ? { ...msg, content: 'Sorry, an error occurred. Please try again.', streaming: false }
          : msg
      ))
      toast.error('Failed to get response')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const playTimestamp = (timestamp) => {
    setCurrentTimestamp(timestamp)
    setShowTimestampPlayer(true)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">Start a conversation</h3>
              <p className="text-gray-500">Ask questions about your document and get AI-powered answers.</p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={msg.id || idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
            >
              <div className={msg.role === 'user' ? 'chat-message-user' : 'chat-message-bot'}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.streaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                )}
                
                {/* Timestamps */}
                {msg.timestamps && msg.timestamps.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-300">
                    <div className="flex items-center gap-1 text-xs font-medium mb-2">
                      <Clock className="w-3 h-3" />
                      <span>Relevant timestamps:</span>
                    </div>
                    <div className="space-y-1">
                      {msg.timestamps.map((ts, i) => (
                        <button
                          key={i}
                          onClick={() => playTimestamp(ts.timestamp)}
                          className="flex items-center gap-2 text-xs bg-white bg-opacity-20 hover:bg-opacity-30 rounded px-2 py-1 transition w-full"
                        >
                          <Play className="w-3 h-3" />
                          <span className="font-mono">{formatTime(ts.timestamp)}</span>
                          <span className="truncate flex-1">{ts.text.substring(0, 50)}...</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Timestamp Player Modal */}
      {showTimestampPlayer && currentTimestamp !== null && (
        <div className="fixed bottom-24 right-6 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-slide-up">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">Playing at {formatTime(currentTimestamp)}</span>
            </div>
            <button
              onClick={() => setShowTimestampPlayer(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3">
            <ReactPlayer
              url={`/uploads/${documentId}/media`}
              playing={true}
              controls={true}
              width="100%"
              height="200px"
              config={{
                file: {
                  attributes: {
                    controlsList: 'nodownload',
                  },
                },
              }}
              onReady={(player) => {
                player.seekTo(currentTimestamp)
              }}
            />
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your document..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows="1"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          AI answers based only on your uploaded document content
        </p>
      </div>
    </div>
  )
}

function formatTime(seconds) {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default ChatBot