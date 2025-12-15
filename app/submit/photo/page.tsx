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

  useEffect(() => {
    const data = sessionStorage.getItem('submissionData')
    if (!data) {
      router.push('/submit')
      return
    }
    setSubmissionData(JSON.parse(data))
  }, [router])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(selectedFile)
    }
  }

  const handleSubmit = async () => {
    if (!file || !submissionData) return

    setUploading(true)

    try {
      // Upload photo
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      if (!uploadRes.ok) {
        let errorMessage = 'Failed to upload image'
        try {
          const error = await uploadRes.json()
          errorMessage = error.error || errorMessage
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = uploadRes.statusText || errorMessage
        }
        console.error('Upload error:', errorMessage)
        throw new Error(errorMessage)
      }
      
      const uploadData = await uploadRes.json()
      console.log('Upload successful, URL:', uploadData.url)
      
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

        const scoreRes = await fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId,
            weekId: weekId,
            scores: combinedScores,
            scorecardImage: uploadData.url // All players share the same scorecard image
          })
        })
        
        if (!scoreRes.ok) {
          let errorMessage = 'Failed to save score'
          try {
            const error = await scoreRes.json()
            errorMessage = error.error || errorMessage
          } catch (e) {
            // If response is not JSON, use status text
            errorMessage = scoreRes.statusText || errorMessage
          }
          console.error('Score creation error:', errorMessage)
          throw new Error(errorMessage)
        }
        
        const savedScore = await scoreRes.json()
        console.log(`Score saved for player ${playerId}`)
        console.log(`Image URL sent: ${uploadData.url}`)
        console.log(`Image URL saved in DB: ${savedScore.scorecardImage}`)
      }

      // Clear session storage
      sessionStorage.removeItem('submissionData')
      sessionStorage.removeItem('allScores')

      router.push('/submit/success')
    } catch (error: any) {
      console.error('Error submitting scores:', error)
      const errorMessage = error?.message || 'Error submitting scores. Please try again.'
      alert(`Error: ${errorMessage}`)
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

    console.log('Starting submission without photo')
    setUploading(true)

    try {
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

        const scoreRes = await fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId,
            weekId: weekId,
            scores: combinedScores,
            scorecardImage: null
          })
        })
        
        if (!scoreRes.ok) {
          const error = await scoreRes.json()
          throw new Error(error.error || `Failed to save score for player ${playerId}`)
        }
      }

      // Clear session storage
      sessionStorage.removeItem('submissionData')
      sessionStorage.removeItem('allScores')

      // Close modal and navigate only after successful submission
      setShowModal(false)
      router.push('/submit/success')
    } catch (error: any) {
      console.error('Error submitting scores:', error)
      const errorMessage = error?.message || 'Error submitting scores. Please try again.'
      alert(`Error: ${errorMessage}`)
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

