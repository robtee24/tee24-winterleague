'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

function ReviewPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const playerIndex = parseInt(searchParams.get('playerIndex') || '0')

  const [allScores, setAllScores] = useState<number[]>([])
  const [submissionData, setSubmissionData] = useState<any>(null)
  const [playerName, setPlayerName] = useState<string>('')

  useEffect(() => {
    const data = sessionStorage.getItem('submissionData')
    const scoresData = sessionStorage.getItem('allScores')
    
    if (!data || !scoresData) {
      router.push('/submit')
      return
    }

    const parsed = JSON.parse(data)
    setSubmissionData(parsed)

    const parsedScores = JSON.parse(scoresData)
    if (parsedScores[playerIndex]) {
      const front9 = parsedScores[playerIndex].front9 || []
      const back9 = parsedScores[playerIndex].back9 || []
      setAllScores([...front9, ...back9])
    }

    // Get player name
    fetch(`/api/players?leagueId=${parsed.leagueId}`)
      .then(res => res.json())
      .then(players => {
        const player = players.find((p: any) => p.id === parsed.players[playerIndex])
        if (player) setPlayerName(player.firstName)
      })
  }, [playerIndex, router])

  const front9Total = allScores.slice(0, 9).reduce((sum, score) => sum + score, 0)
  const back9Total = allScores.slice(9, 18).reduce((sum, score) => sum + score, 0)
  const total = front9Total + back9Total

  const handleConfirm = () => {
    // Store confirmed scores
    const scoresData = sessionStorage.getItem('allScores')
    const parsedScores = scoresData ? JSON.parse(scoresData) : []
    if (!parsedScores[playerIndex]) {
      parsedScores[playerIndex] = {}
    }
    parsedScores[playerIndex].confirmed = true
    sessionStorage.setItem('allScores', JSON.stringify(parsedScores))

    // Check if all players are done
    const data = JSON.parse(sessionStorage.getItem('submissionData') || '{}')
    const allConfirmed = data.players && data.players.every((_: any, idx: number) => 
      parsedScores[idx]?.confirmed
    )

    if (allConfirmed) {
      router.push('/submit/photo')
    } else {
      // Move to next player
      const nextIndex = playerIndex + 1
      router.push(`/submit/front9?playerIndex=${nextIndex}`)
    }
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push(`/submit/back9?playerIndex=${playerIndex}`)}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold mb-8 text-black">
          Review Scores - {playerName}
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="grid grid-cols-9 md:grid-cols-18 gap-2 mb-6">
            {Array.from({ length: 18 }, (_, i) => (
              <div key={i} className="text-center">
                <div className="text-xs font-semibold text-gray-600 mb-1">
                  H{i + 1}
                </div>
                <div className="px-2 py-2 bg-gray-50 rounded border border-gray-200">
                  {allScores[i] || '-'}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-700">Front 9:</span>
              <span className="text-xl font-bold text-green-600">{front9Total}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-700">Back 9:</span>
              <span className="text-xl font-bold text-green-600">{back9Total}</span>
            </div>
            <div className="flex justify-between items-center border-t pt-3">
              <span className="text-xl font-bold text-gray-800">Total (18 Holes):</span>
              <span className="text-2xl font-bold text-green-600">{total}</span>
            </div>
          </div>

          <button
            onClick={handleConfirm}
            className="w-full mt-6 py-3 px-6 bg-green-600 text-white rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors"
          >
            These scores match my scorecard
          </button>
        </div>
      </div>
    </main>
  )
}

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen p-8 bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </main>
    }>
      <ReviewPageContent />
    </Suspense>
  )
}
