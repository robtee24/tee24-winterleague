'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

function Front9PageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const playerIndex = parseInt(searchParams.get('playerIndex') || '0')

  const [scores, setScores] = useState<number[]>(Array(9).fill(0))
  const [submissionData, setSubmissionData] = useState<any>(null)
  const [playerName, setPlayerName] = useState<string>('')
  const [highScoreModal, setHighScoreModal] = useState<{ show: boolean; hole: number; score: number }>({ show: false, hole: 0, score: 0 })
  const [pendingScore, setPendingScore] = useState<{ index: number; value: number } | null>(null)

  useEffect(() => {
    const data = sessionStorage.getItem('submissionData')
    if (!data) {
      router.push('/submit')
      return
    }

    const parsed = JSON.parse(data)
    setSubmissionData(parsed)

    // Get player name
    fetch(`/api/players?leagueId=${parsed.leagueId}`)
      .then(res => res.json())
      .then(players => {
        const player = players.find((p: any) => p.id === parsed.players[playerIndex])
        if (player) {
          const fullName = player.lastName 
            ? `${player.firstName} ${player.lastName}` 
            : player.firstName
          setPlayerName(fullName)
        }
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
      setHighScoreModal({ show: true, hole: index + 1, score })
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

  const calculateFront9 = () => {
    return scores.reduce((sum, score) => sum + score, 0)
  }

  const handleNext = () => {
    // Store front 9 scores
    const allScores = sessionStorage.getItem('allScores')
    const parsedScores = allScores ? JSON.parse(allScores) : []
    parsedScores[playerIndex] = { front9: scores }
    sessionStorage.setItem('allScores', JSON.stringify(parsedScores))

    router.push(`/submit/back9?playerIndex=${playerIndex}`)
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/submit')}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold mb-8 text-black">
          {playerName}'s Front 9
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
                    Hole {i + 1}
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
              <span className="text-xl font-semibold text-gray-700">Front 9 Score:</span>
              <span className="text-2xl font-bold text-green-600">{calculateFront9()}</span>
            </div>
          </div>

          <button
            onClick={handleNext}
            className="w-full mt-6 py-3 px-6 bg-green-600 text-white rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors"
          >
            Back 9
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

export default function Front9Page() {
  return (
    <Suspense fallback={
      <main className="min-h-screen p-8 bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </main>
    }>
      <Front9PageContent />
    </Suspense>
  )
}
