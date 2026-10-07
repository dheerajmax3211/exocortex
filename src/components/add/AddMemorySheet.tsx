'use client'

import { useState, useRef, useEffect } from 'react'
import BottomSheet from '../ui/BottomSheet'
import ReviewSheet from './ReviewSheet'
import { AudioRecorder } from './AudioRecorder'

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
  const [isPolling, setIsPolling] = useState(false)
  const [pollStep, setPollStep] = useState(0)
  
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
      const res = await fetch('/api/ingest?async=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to ingest memory');
      }
      
      let data = await res.json()

      if (res.status === 202) {
        setIsPolling(true)
        let step = 0
        let consecutiveErrors = 0
        const maxPolls = 120
        let pollCount = 0

        while (pollCount < maxPolls) {
          pollCount++
          step++
          if (step > 3) step = 3
          setPollStep(step)
          await new Promise(r => setTimeout(r, 1000))
          
          let statusRes
          try {
            statusRes = await fetch(`/api/ingest/status/${data.entry_id}`)
          } catch {
            consecutiveErrors++
            if (consecutiveErrors > 6) throw new Error('Network error checking extraction status')
            continue
          }

          if (!statusRes.ok) {
            consecutiveErrors++
            if (consecutiveErrors > 6) {
              const errJson = await statusRes.json().catch(() => ({}))
              throw new Error(errJson.error || 'Failed to check status')
            }
            continue
          }
          consecutiveErrors = 0

          const statusData = await statusRes.json()
          
          if (statusData.status === 'ready' || statusData.status === 'draft') {
            data = {
              entry_id: data.entry_id,
              extraction: statusData.extraction || statusData.props?.extraction,
              candidates: statusData.candidates || statusData.props?.candidates
            }
            break
          } else if (statusData.status === 'error' || statusData.status === 'failed') {
            throw new Error(statusData.error || 'Extraction failed')
          }
        }

        if (pollCount >= maxPolls) {
          throw new Error('Extraction timed out. Memory was saved to drafts.')
        }
        setIsPolling(false)
      }

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

  if (isPolling) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose}>
        <div className="flex flex-col items-center justify-center h-full space-y-6 text-center pb-20">
          <div className="text-4xl animate-pulse">🧠</div>
          <h3 className="text-xl font-medium text-[var(--foreground)]">Neural Graph Extraction in progress...</h3>
          <div className="flex flex-col items-start space-y-3 text-sm text-[var(--muted)] w-64 mx-auto">
            <div className={`flex items-center space-x-3 transition-opacity duration-300 ${pollStep >= 1 ? 'text-[var(--foreground)] opacity-100' : 'opacity-40'}`}>
              <span className="text-lg">{pollStep >= 2 ? '✓' : '•'}</span>
              <span>Chunking text</span>
            </div>
            <div className={`flex items-center space-x-3 transition-opacity duration-300 ${pollStep >= 2 ? 'text-[var(--foreground)] opacity-100' : 'opacity-40'}`}>
              <span className="text-lg">{pollStep >= 3 ? '✓' : '•'}</span>
              <span>Extracting semantic entities</span>
            </div>
            <div className={`flex items-center space-x-3 transition-opacity duration-300 ${pollStep >= 3 ? 'text-[var(--foreground)] opacity-100' : 'opacity-40'}`}>
              <span className="text-lg text-[var(--accent)] animate-pulse">⏳</span>
              <span>Resolving candidates</span>
            </div>
          </div>
        </div>
      </BottomSheet>
    )
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
          <AudioRecorder
            onTranscription={(transcript) => setText(prev => prev ? `${prev} ${transcript}` : transcript)}
            isProcessing={isProcessing}
          />

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
