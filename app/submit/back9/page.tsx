'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function Back9Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const playerIndex = parseInt(searchParams.get('playerIndex') || '0')

  const [scores, setScores] = useState<number[]>(Array(9).fill(0))
  const [front9Scores, setFront9Scores] = useState<number[]>([])
  const [submissionData, setSubmissionData] = useState<any>(null)
  const [playerName, setPlayerName] = useState<string>('')

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
    const newScores = [...scores]
    newScores[index] = parseInt(value) || 0
    setScores(newScores)
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
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="text-center">
                <label className="block text-sm font-semibold mb-2 text-gray-700">
                  Hole {i + 10}
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={scores[i] || ''}
                  onChange={(e) => handleScoreChange(i, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            ))}
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
    </main>
  )
}

