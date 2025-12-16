'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Image from 'next/image'

export default function PhotoPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [submissionData, setSubmissionData] = useState<any>(null)
  const [fileSize, setFileSize] = useState<number | null>(null)

  useEffect(() => {
    const data = sessionStorage.getItem('submissionData')
    if (!data) {
      router.push('/submit')
      return
    }
    setSubmissionData(JSON.parse(data))
  }, [router])

  // Compress image to reduce file size
  const compressImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1920, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          // Calculate new dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width
              width = maxWidth
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height
              height = maxHeight
            }
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Could not get canvas context'))
            return
          }

          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'))
                return
              }
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              })
              resolve(compressedFile)
            },
            'image/jpeg',
            quality
          )
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Check file size (4MB limit for Vercel)
      const maxSize = 4 * 1024 * 1024 // 4MB in bytes
      
      if (selectedFile.size > maxSize) {
        console.log('File too large, compressing...', { originalSize: selectedFile.size })
        try {
          // Compress the image
          const compressedFile = await compressImage(selectedFile)
          console.log('Image compressed:', { 
            originalSize: selectedFile.size, 
            compressedSize: compressedFile.size,
            reduction: `${Math.round((1 - compressedFile.size / selectedFile.size) * 100)}%`
          })
          
          // If still too large after compression, compress more aggressively
          if (compressedFile.size > maxSize) {
            const moreCompressed = await compressImage(selectedFile, 1280, 1280, 0.6)
            setFile(moreCompressed)
            const reader = new FileReader()
            reader.onloadend = () => {
              setPreview(reader.result as string)
            }
            reader.readAsDataURL(moreCompressed)
          } else {
            setFile(compressedFile)
            setFileSize(compressedFile.size)
            const reader = new FileReader()
            reader.onloadend = () => {
              setPreview(reader.result as string)
            }
            reader.readAsDataURL(compressedFile)
          }
        } catch (error) {
          console.error('Error compressing image:', error)
          alert('Error processing image. Please try a smaller image or text your score to 502-200-1044.')
          return
        }
      } else {
        setFile(selectedFile)
        setFileSize(selectedFile.size)
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreview(reader.result as string)
        }
        reader.readAsDataURL(selectedFile)
      }
    }
  }

  const logError = (step: string, error: any, context?: any) => {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      step,
      error: error?.message || String(error),
      errorStack: error?.stack,
      context: {
        ...context,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
        hasFile: !!file,
        hasSubmissionData: !!submissionData,
        playersCount: submissionData?.players?.length || 0,
      }
    }
    console.error('SUBMISSION_ERROR:', JSON.stringify(errorInfo, null, 2))
    return errorInfo
  }

  const handleSubmit = async () => {
    if (!file || !submissionData) {
      const error = logError('PRE_SUBMIT_VALIDATION', new Error('Missing file or submission data'), { file: !!file, submissionData: !!submissionData })
      alert('Error: Missing required data. Please go back and try again.')
      return
    }

    setUploading(true)
    const startTime = Date.now()

    try {
      console.log('SUBMISSION_START:', {
        timestamp: new Date().toISOString(),
        fileSize: file.size,
        fileType: file.type,
        playersCount: submissionData.players.length
      })

      // Upload photo with timeout
      const formData = new FormData()
      formData.append('file', file)
      
      const uploadController = new AbortController()
      const uploadTimeout = setTimeout(() => uploadController.abort(), 30000) // 30 second timeout
      
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: uploadController.signal
      }).finally(() => clearTimeout(uploadTimeout))
      
      if (!uploadRes.ok) {
        let errorMessage = 'Failed to upload image'
        let errorDetails: any = {}
        try {
          const error = await uploadRes.json()
          errorMessage = error.error || errorMessage
          errorDetails = error
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = uploadRes.statusText || errorMessage
          errorDetails = { status: uploadRes.status, statusText: uploadRes.statusText }
        }
        
        // Handle 413 Payload Too Large error specifically
        if (uploadRes.status === 413) {
          errorMessage = 'Image file is too large. Please try taking a new photo or use a smaller image. If this continues, text your score to 502-200-1044.'
        }
        
        const errorInfo = logError('UPLOAD_FAILED', new Error(errorMessage), {
          status: uploadRes.status,
          statusText: uploadRes.statusText,
          errorDetails,
          fileSize: file.size,
          fileType: file.type
        })
        throw new Error(`${errorMessage} Error ID: ${Date.now()}`)
      }
      
      const uploadData = await uploadRes.json()
      console.log('SUBMISSION_UPLOAD_SUCCESS:', {
        timestamp: new Date().toISOString(),
        url: uploadData.url,
        uploadTime: Date.now() - startTime
      })
      
      if (!uploadData.url) {
        throw new Error('No URL returned from upload')
      }

      // Use weekId directly from submission data
      const weekId = submissionData.weekId

      if (!weekId) {
        throw new Error('Week ID is missing from submission data')
      }

      // Submit all scores
      const allScores = JSON.parse(sessionStorage.getItem('allScores') || '[]')
      
      if (!Array.isArray(allScores) || allScores.length === 0) {
        throw new Error('No scores found in submission data')
      }
      
      if (allScores.length !== submissionData.players.length) {
        throw new Error('Number of score sets does not match number of players')
      }
      
      for (let i = 0; i < submissionData.players.length; i++) {
        const playerId = submissionData.players[i]
        if (!playerId) {
          throw new Error(`Missing player ID at index ${i}`)
        }

        const playerScores = allScores[i]
        if (!playerScores) {
          throw new Error(`Missing scores for player at index ${i}`)
        }

        // Validate and sanitize scores - ensure all are numbers
        const front9 = (playerScores.front9 || []).map((s: any) => {
          const num = typeof s === 'number' ? s : parseInt(String(s).replace(/[^0-9]/g, ''), 10)
          return isNaN(num) || !isFinite(num) || num < 0 ? 0 : Math.floor(num)
        })
        const back9 = (playerScores.back9 || []).map((s: any) => {
          const num = typeof s === 'number' ? s : parseInt(String(s).replace(/[^0-9]/g, ''), 10)
          return isNaN(num) || !isFinite(num) || num < 0 ? 0 : Math.floor(num)
        })
        const combinedScores = [...front9, ...back9]
        
        if (combinedScores.length === 0) {
          throw new Error(`No scores found for player at index ${i}`)
        }

        const scoreController = new AbortController()
        const scoreTimeout = setTimeout(() => scoreController.abort(), 30000) // 30 second timeout
        
        const scoreRes = await fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId,
            weekId: weekId,
            scores: combinedScores,
            scorecardImage: uploadData.url // All players share the same scorecard image
          }),
          signal: scoreController.signal
        }).finally(() => clearTimeout(scoreTimeout))
        
        if (!scoreRes.ok) {
          let errorMessage = 'Failed to save score'
          let errorDetails: any = {}
          try {
            const error = await scoreRes.json()
            errorMessage = error.error || errorMessage
            errorDetails = error
          } catch (e) {
            // If response is not JSON, use status text
            errorMessage = scoreRes.statusText || errorMessage
            errorDetails = { status: scoreRes.status, statusText: scoreRes.statusText }
          }
          const errorInfo = logError('SCORE_SAVE_FAILED', new Error(errorMessage), {
            playerId,
            playerIndex: i,
            weekId,
            scoresLength: combinedScores.length,
            status: scoreRes.status,
            errorDetails
          })
          throw new Error(`${errorMessage} (Player ${i + 1}). If this persists, please text your score to 502-200-1044. Error ID: ${Date.now()}`)
        }
        
        const savedScore = await scoreRes.json()
        console.log(`SUBMISSION_SCORE_SAVED:`, {
          playerId,
          playerIndex: i,
          scoreId: savedScore.id,
          timestamp: new Date().toISOString()
        })
      }
      
      console.log('SUBMISSION_COMPLETE:', {
        timestamp: new Date().toISOString(),
        totalTime: Date.now() - startTime,
        playersCount: submissionData.players.length
      })

      // Clear session storage
      sessionStorage.removeItem('submissionData')
      sessionStorage.removeItem('allScores')

      router.push('/submit/success')
    } catch (error: any) {
      const errorInfo = logError('SUBMISSION_FAILED', error, {
        elapsedTime: Date.now() - startTime,
        isAbortError: error?.name === 'AbortError',
        isNetworkError: !error?.response && error?.message?.includes('fetch')
      })
      
      let errorMessage = error?.message || 'Error submitting scores. Please try again.'
      
      // Provide more helpful error messages
      if (error?.name === 'AbortError') {
        errorMessage = 'Request timed out. Please check your internet connection and try again. If this persists, text your score to 502-200-1044.'
      } else if (error?.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again. If this persists, text your score to 502-200-1044.'
      }
      
      alert(`Error: ${errorMessage}\n\nError ID: ${Date.now()}\n\nPlease note this error ID if contacting support.`)
    } finally {
      setUploading(false)
    }
  }

  const handleNoPhoto = () => {
    setShowModal(true)
  }

  const handleCloseModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (!uploading) {
      setShowModal(false)
    }
  }

  const handleSubmitWithoutPhoto = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    console.log('handleSubmitWithoutPhoto called', { uploading, hasSubmissionData: !!submissionData })

    // Prevent double-clicks
    if (uploading) {
      console.log('Already uploading, ignoring click')
      return
    }

    if (!submissionData) {
      console.error('No submission data found')
      alert('Error: Missing submission data. Please go back and try again.')
      return
    }

    console.log('SUBMISSION_START_NO_PHOTO:', {
      timestamp: new Date().toISOString(),
      playersCount: submissionData.players.length
    })
    setUploading(true)
    const startTime = Date.now()

    try {
      // Use weekId directly from submission data
      const weekId = submissionData.weekId

      if (!weekId) {
        const errorInfo = logError('NO_PHOTO_WEEK_ID_MISSING', new Error('Week ID is missing'), { submissionData })
        throw new Error('Week ID is missing from submission data')
      }

      // Submit all scores
      const allScores = JSON.parse(sessionStorage.getItem('allScores') || '[]')
      
      if (!Array.isArray(allScores) || allScores.length === 0) {
        throw new Error('No scores found in submission data')
      }

      for (let i = 0; i < submissionData.players.length; i++) {
        const playerId = submissionData.players[i]
        if (!playerId) {
          console.error(`Missing player ID at index ${i}`)
          continue
        }

        const playerScores = allScores[i]
        if (!playerScores) {
          console.error(`Missing scores for player at index ${i}`)
          continue
        }

        // Validate and sanitize scores - ensure all are numbers
        const front9 = (playerScores.front9 || []).map((s: any) => {
          const num = typeof s === 'number' ? s : parseInt(String(s).replace(/[^0-9]/g, ''), 10)
          return isNaN(num) || !isFinite(num) || num < 0 ? 0 : Math.floor(num)
        })
        const back9 = (playerScores.back9 || []).map((s: any) => {
          const num = typeof s === 'number' ? s : parseInt(String(s).replace(/[^0-9]/g, ''), 10)
          return isNaN(num) || !isFinite(num) || num < 0 ? 0 : Math.floor(num)
        })
        const combinedScores = [...front9, ...back9]

        if (combinedScores.length === 0) {
          console.error(`No scores found for player ${playerId}`)
          continue
        }

        const scoreController = new AbortController()
        const scoreTimeout = setTimeout(() => scoreController.abort(), 30000) // 30 second timeout
        
        const scoreRes = await fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId,
            weekId: weekId,
            scores: combinedScores,
            scorecardImage: null
          }),
          signal: scoreController.signal
        }).finally(() => clearTimeout(scoreTimeout))
        
        if (!scoreRes.ok) {
          let errorMessage = `Failed to save score for player ${playerId}`
          let errorDetails: any = {}
          try {
            const error = await scoreRes.json()
            errorMessage = error.error || errorMessage
            errorDetails = error
          } catch (e) {
            errorDetails = { status: scoreRes.status, statusText: scoreRes.statusText }
          }
          const errorInfo = logError('NO_PHOTO_SCORE_SAVE_FAILED', new Error(errorMessage), {
            playerId,
            playerIndex: i,
            weekId,
            scoresLength: combinedScores.length,
            status: scoreRes.status,
            errorDetails
          })
          throw new Error(`${errorMessage} (Player ${i + 1}). If this persists, please text your score to 502-200-1044. Error ID: ${Date.now()}`)
        }
        
        console.log(`SUBMISSION_NO_PHOTO_SCORE_SAVED:`, {
          playerId,
          playerIndex: i,
          timestamp: new Date().toISOString()
        })
      }
      
      console.log('SUBMISSION_NO_PHOTO_COMPLETE:', {
        timestamp: new Date().toISOString(),
        totalTime: Date.now() - startTime,
        playersCount: submissionData.players.length
      })

      // Clear session storage
      sessionStorage.removeItem('submissionData')
      sessionStorage.removeItem('allScores')

      // Close modal and navigate only after successful submission
      setShowModal(false)
      router.push('/submit/success')
    } catch (error: any) {
      const errorInfo = logError('NO_PHOTO_SUBMISSION_FAILED', error, {
        elapsedTime: Date.now() - startTime,
        isAbortError: error?.name === 'AbortError',
        isNetworkError: !error?.response && error?.message?.includes('fetch')
      })
      
      let errorMessage = error?.message || 'Error submitting scores. Please try again.'
      
      // Provide more helpful error messages
      if (error?.name === 'AbortError') {
        errorMessage = 'Request timed out. Please check your internet connection and try again. If this persists, text your score to 502-200-1044.'
      } else if (error?.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again. If this persists, text your score to 502-200-1044.'
      }
      
      alert(`Error: ${errorMessage}\n\nError ID: ${Date.now()}\n\nPlease note this error ID if contacting support.`)
      // Keep modal open on error so user can try again
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50 relative">
      {/* Full-page loading overlay */}
      {uploading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <svg className="animate-spin h-12 w-12 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg font-semibold text-gray-800">Submitting scores...</p>
            <p className="text-sm text-gray-600">Please wait, this may take a moment.</p>
          </div>
        </div>
      )}
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/submit')}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold mb-8 text-black">
          Submit a photo of your scorecard
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-700">
              Upload Photo
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              id="photo-upload"
              style={{ display: 'none' }}
            />
            <label
              htmlFor="photo-upload"
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg cursor-pointer text-center bg-white hover:bg-gray-50 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              Choose Photo from Library or Take Photo
            </label>
            {preview && (
              <div className="mt-4">
                <Image
                  src={preview}
                  alt="Scorecard preview"
                  width={800}
                  height={600}
                  className="max-w-full h-auto rounded-lg border border-gray-300"
                  unoptimized
                />
                {fileSize && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    File size: {(fileSize / 1024 / 1024).toFixed(2)} MB
                    {fileSize > 4 * 1024 * 1024 && (
                      <span className="text-orange-600 ml-2">(Large file - may take longer to upload)</span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!file || uploading}
            className={`w-full mb-4 py-3 px-6 rounded-lg font-semibold text-lg transition-colors flex items-center justify-center gap-2 ${
              file && !uploading
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {uploading && (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {uploading ? 'Submitting...' : 'Submit'}
          </button>

          <button
            onClick={handleNoPhoto}
            type="button"
            className="w-full py-3 px-6 bg-gray-200 text-gray-700 rounded-lg font-semibold text-lg hover:bg-gray-300 transition-colors"
          >
            I don&apos;t have one
          </button>
          <p className="text-sm text-gray-600 mt-4 text-center">
            In the event of an issue text your score to <a href="tel:5022001044" className="text-blue-600 hover:underline">502-200-1044</a>
          </p>
        </div>

        {/* Modal */}
        {showModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={(e) => {
              if (!uploading && e.target === e.currentTarget) {
                handleCloseModal(e as any)
              }
            }}
          >
            <div 
              className="bg-white rounded-lg p-6 max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                No Scorecard Photo
              </h2>
              <p className="text-gray-600 mb-6">
                In the future, please be sure to take a picture of your scorecard.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleCloseModal(e)
                  }}
                  disabled={uploading}
                  type="button"
                  className={`flex-1 py-3 px-6 rounded-lg font-semibold text-lg transition-colors ${
                    uploading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSubmitWithoutPhoto(e)
                  }}
                  disabled={uploading}
                  type="button"
                  className={`flex-1 py-3 px-6 rounded-lg font-semibold text-lg transition-colors flex items-center justify-center gap-2 ${
                    uploading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {uploading && (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {uploading ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

