'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

function Back9PageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const playerIndex = parseInt(searchParams.get('playerIndex') || '0')

  const [scores, setScores] = useState<number[]>(Array(9).fill(0))
  const [front9Scores, setFront9Scores] = useState<number[]>([])
  const [submissionData, setSubmissionData] = useState<any>(null)
  const [playerName, setPlayerName] = useState<string>('')
  const [highScoreModal, setHighScoreModal] = useState<{ show: boolean; hole: number; score: number }>({ show: false, hole: 0, score: 0 })
  const [pendingScore, setPendingScore] = useState<{ index: number; value: number } | null>(null)

  useEffect(() => {
    const data = sessionStorage.getItem('submissionData')
    const allScores = sessionStorage.getItem('allScores')
    
    if (!data) {
      router.push('/submit')
      return
    }

    const parsed = JSON.parse(data)
    setSubmissionData(parsed)

    if (allScores) {
      const parsedScores = JSON.parse(allScores)
      if (parsedScores[playerIndex]?.front9) {
        setFront9Scores(parsedScores[playerIndex].front9)
      }
    }

    // Get player name
    fetch(`/api/players?leagueId=${parsed.leagueId}`)
      .then(res => res.json())
      .then(players => {
        const player = players.find((p: any) => p.id === parsed.players[playerIndex])
        if (player) setPlayerName(player.firstName)
      })
  }, [playerIndex, router])

  const handleScoreChange = (index: number, value: string) => {
    // Only allow numbers - remove any non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, '')
    
    if (numericValue === '') {
      const newScores = [...scores]
      newScores[index] = 0
      setScores(newScores)
      return
    }

    const score = parseInt(numericValue)
    
    // If score is over 15, show confirmation modal
    if (score > 15) {
      setPendingScore({ index, value: score })
      setHighScoreModal({ show: true, hole: index + 10, score })
      return
    }

    // Otherwise, update the score
    const newScores = [...scores]
    newScores[index] = score
    setScores(newScores)
  }

  const confirmHighScore = () => {
    if (pendingScore) {
      const newScores = [...scores]
      newScores[pendingScore.index] = pendingScore.value
      setScores(newScores)
      setPendingScore(null)
    }
    setHighScoreModal({ show: false, hole: 0, score: 0 })
  }

  const cancelHighScore = () => {
    setPendingScore(null)
    setHighScoreModal({ show: false, hole: 0, score: 0 })
  }

  const calculateBack9 = () => {
    return scores.reduce((sum, score) => sum + score, 0)
  }

  const handleNext = () => {
    // Store back 9 scores
    const allScores = sessionStorage.getItem('allScores')
    const parsedScores = allScores ? JSON.parse(allScores) : []
    if (!parsedScores[playerIndex]) parsedScores[playerIndex] = {}
    parsedScores[playerIndex].back9 = scores
    sessionStorage.setItem('allScores', JSON.stringify(parsedScores))

    router.push(`/submit/review?playerIndex=${playerIndex}`)
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push(`/submit/front9?playerIndex=${playerIndex}`)}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold mb-8 text-black">
          {playerName}'s Back 9
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="grid grid-cols-3 md:grid-cols-9 gap-4 mb-6">
            {Array.from({ length: 9 }, (_, i) => {
              const score = scores[i] || 0
              const isHighScore = score > 10
              const isVeryHighScore = score > 15
              
              return (
                <div key={i} className="text-center">
                  <label className="block text-sm font-semibold mb-2 text-gray-700">
                    Hole {i + 10}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={score || ''}
                    onChange={(e) => handleScoreChange(i, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-center focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                      isVeryHighScore 
                        ? 'border-red-500 bg-red-50' 
                        : isHighScore 
                        ? 'border-orange-400 bg-orange-50' 
                        : 'border-gray-300'
                    }`}
                    placeholder="0"
                  />
                  {isHighScore && !isVeryHighScore && (
                    <p className="text-xs text-orange-600 mt-1">High score</p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-xl font-semibold text-gray-700">Back 9 Score:</span>
              <span className="text-2xl font-bold text-green-600">{calculateBack9()}</span>
            </div>
          </div>

          <button
            onClick={handleNext}
            className="w-full mt-6 py-3 px-6 bg-green-600 text-white rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {/* High Score Confirmation Modal */}
      {highScoreModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              Whoah! That was a rough hole, just want to make sure.
            </h2>
            <p className="text-gray-600 mb-6">
              You entered a score of <strong>{highScoreModal.score}</strong> for Hole {highScoreModal.hole}. Is this correct?
            </p>
            <div className="flex gap-2">
              <button
                onClick={cancelHighScore}
                type="button"
                className="flex-1 py-3 px-6 bg-gray-200 text-gray-700 rounded-lg font-semibold text-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmHighScore}
                type="button"
                className="flex-1 py-3 px-6 bg-green-600 text-white rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default function Back9Page() {
  return (
    <Suspense fallback={
      <main className="min-h-screen p-8 bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </main>
    }>
      <Back9PageContent />
    </Suspense>
  )
}
