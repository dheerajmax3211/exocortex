'use client'

import { useState, useRef, useEffect } from 'react'
import BottomSheet from '../ui/BottomSheet'
import ReviewSheet from './ReviewSheet'

interface AddMemorySheetProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddMemorySheet({ isOpen, onClose }: AddMemorySheetProps) {
  const [text, setText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [extractedData, setExtractedData] = useState<any>(null)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen && textareaRef.current && !showReview) {
      setTimeout(() => textareaRef.current?.focus(), 300)
    }
  }, [isOpen, showReview])

  const toggleMic = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.lang = 'en-IN'
    recognition.continuous = true
    recognition.interimResults = true

    if (isListening) {
      setIsListening(false)
      recognition.stop()
    } else {
      setIsListening(true)
      recognition.start()

      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        setText(transcript)
      }

      recognition.onerror = () => setIsListening(false)
      recognition.onend = () => setIsListening(false)
    }
  }

  const handleSubmit = async () => {
    if (!text.trim()) return
    setIsProcessing(true)

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      
      if (!res.ok) {
        throw new Error('Failed to ingest memory')
      }
      
      const data = await res.json()

      const isAutoSave = typeof window !== 'undefined' && localStorage.getItem('autoSave') === 'true'
      const extraction = data?.extraction
      const hasQuestions = extraction?.questions && extraction.questions.length > 0
      const hasAmbiguousEntities = (extraction?.entities || []).some((ent: any) => 
        ent.match === null && (data?.candidates || []).length > 1
      )

      if (isAutoSave && !hasQuestions && !hasAmbiguousEntities) {
        const commitRes = await fetch('/api/ingest/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry_id: data.entry_id,
            entities: extraction?.entities || [],
            edges: extraction?.edges || [],
            facts: extraction?.facts || [],
            event_date: extraction?.event_date || null
          })
        })
        if (commitRes.ok) {
          setText('')
          onClose()
          window.location.reload()
          return
        }
      }

      setExtractedData(data)
      setShowReview(true)
    } catch (err) {
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  if (showReview) {
    return (
      <ReviewSheet 
        isOpen={isOpen} 
        onClose={onClose} 
        data={extractedData} 
        onEdit={() => setShowReview(false)} 
      />
    )
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col h-full space-y-4 pt-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What happened today?"
          className="w-full h-40 resize-none bg-transparent border-none outline-none text-xl md:text-2xl font-inter leading-relaxed placeholder-[var(--muted)] text-[var(--foreground)]"
          disabled={isProcessing}
        />

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={toggleMic}
            className={`p-3 rounded-full transition-colors ${isListening ? 'bg-red-500/20 text-red-500' : 'bg-[var(--border)] text-[var(--foreground)]'}`}
            aria-label="Toggle Microphone"
            disabled={isProcessing}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>

          <button
            onClick={handleSubmit}
            disabled={isProcessing || !text.trim()}
            className="px-6 py-2.5 rounded-full bg-[var(--accent)] text-white font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? <span>Processing...</span> : <span>Save Memory</span>}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
