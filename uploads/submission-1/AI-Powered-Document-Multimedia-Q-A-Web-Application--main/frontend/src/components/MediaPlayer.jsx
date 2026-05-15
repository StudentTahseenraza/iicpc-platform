// frontend/src/components/MediaPlayer.jsx
import React, { useRef, useState, useEffect } from 'react'
import ReactPlayer from 'react-player'
import { Play, Pause, Volume2, VolumeX, Maximize, Clock } from 'lucide-react'

function MediaPlayer({ url, timestamps = [], onTimestampClick }) {
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [played, setPlayed] = useState(0)
  const [duration, setDuration] = useState(0)
  const playerRef = useRef(null)

  const handlePlayPause = () => {
    setPlaying(!playing)
  }

  const handleVolumeChange = (e) => {
    const value = parseFloat(e.target.value)
    setVolume(value)
    setMuted(value === 0)
  }

  const handleMute = () => {
    setMuted(!muted)
  }

  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value)
    setPlayed(seekTime / duration)
    playerRef.current?.seekTo(seekTime)
  }

  const handleProgress = (state) => {
    setPlayed(state.played)
  }

  const handleDuration = (duration) => {
    setDuration(duration)
  }

  const formatTime = (seconds) => {
    if (!seconds) return '0:00'
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleTimestampClick = (timestamp) => {
    playerRef.current?.seekTo(timestamp)
    setPlaying(true)
    if (onTimestampClick) {
      onTimestampClick(timestamp)
    }
  }

  return (
    <div className="bg-black rounded-lg overflow-hidden">
      <ReactPlayer
        ref={playerRef}
        url={url}
        playing={playing}
        volume={volume}
        muted={muted}
        onProgress={handleProgress}
        onDuration={handleDuration}
        width="100%"
        height="auto"
        config={{
          file: {
            attributes: {
              controlsList: 'nodownload',
            },
          },
        }}
      />
      
      {/* Custom Controls */}
      <div className="p-3 bg-gray-900">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={handlePlayPause} className="text-white hover:text-gray-300">
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          
          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={duration}
              value={played * duration}
              onChange={handleSeek}
              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${played * 100}%, #4b5563 ${played * 100}%, #4b5563 100%)`
              }}
            />
          </div>
          
          <span className="text-xs text-gray-400">
            {formatTime(played * duration)} / {formatTime(duration)}
          </span>
          
          <button onClick={handleMute} className="text-white hover:text-gray-300">
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        
        {/* Timestamps */}
        {timestamps && timestamps.length > 0 && (
          <div className="border-t border-gray-800 pt-2 mt-2">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
              <Clock className="w-3 h-3" />
              <span>Key moments:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {timestamps.map((ts, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTimestampClick(ts.timestamp)}
                  className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-white transition"
                >
                  {formatTime(ts.timestamp)} - {ts.label || 'Topic'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MediaPlayer