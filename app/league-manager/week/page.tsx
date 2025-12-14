'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

interface Player {
  id: number
  firstName: string
  lastName: string
}

interface Handicap {
  id: number
  playerId: number
  handicap: number
}

interface Score {
  id: number
  playerId: number
  hole1: number | null
  hole2: number | null
  hole3: number | null
  hole4: number | null
  hole5: number | null
  hole6: number | null
  hole7: number | null
  hole8: number | null
  hole9: number | null
  hole10: number | null
  hole11: number | null
  hole12: number | null
  hole13: number | null
  hole14: number | null
  hole15: number | null
  hole16: number | null
  hole17: number | null
  hole18: number | null
  front9: number | null
  back9: number | null
  total: number | null
  weightedScore: number | null
  scorecardImage: string | null
  player: Player
}

export default function WeekPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const weekNumber = searchParams.get('weekNumber')
  const leagueId = searchParams.get('leagueId')

  const [scores, setScores] = useState<Score[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [handicaps, setHandicaps] = useState<Handicap[]>([])
  const [currentWeekId, setCurrentWeekId] = useState<number | null>(null)
  const [courseName, setCourseName] = useState<string>('')
  const [editingCourseName, setEditingCourseName] = useState<string>('')
  const [editingScore, setEditingScore] = useState<{ playerId: number; score: Score | null } | null>(null)

  useEffect(() => {
    if (!weekNumber || !leagueId) {
      router.push('/league-manager')
      return
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekNumber, leagueId, router])

  const loadData = () => {
    if (!leagueId || !weekNumber) return

    fetch(`/api/players?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(data => setPlayers(data))
      .catch(err => console.error('Error fetching players:', err))

    // Fetch all scores for the league and filter by weekNumber
    fetch(`/api/scores?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(allScores => {
        // Filter scores by weekNumber (not weekId) to handle duplicate weeks
        const targetWeekNumber = weekNumber === 'championship' ? 'championship' : parseInt(weekNumber || '0')
        const weekScores = allScores.filter((s: any) => {
          if (weekNumber === 'championship') {
            return s.week?.isChampionship === true
          }
          return s.week?.weekNumber === targetWeekNumber
        })
        
        console.log(`Loaded ${weekScores.length} scores for week ${weekNumber}`)
        weekScores.forEach((s: any) => {
          if (s.scorecardImage) {
            console.log(`Score for player ${s.playerId} has image:`, s.scorecardImage)
          }
        })
        setScores(weekScores)
        
        // Get all unique weekIds from the filtered scores to fetch handicaps
        const weekIds = [...new Set(weekScores.map((s: any) => s.weekId))]
        
        // Fetch handicaps for all weeks that have scores
        Promise.all(weekIds.map(weekId => 
          fetch(`/api/handicaps?weekId=${weekId}`)
            .then(res => res.json())
            .catch(() => [])
        )).then(handicapArrays => {
          const allHandicaps = handicapArrays.flat()
          setHandicaps(allHandicaps)
        })
        
        // Set currentWeekId to the first week that has scores, or find/create one
        if (weekScores.length > 0) {
          setCurrentWeekId(weekScores[0].weekId)
        } else {
          // If no scores, find or create a week
          fetch(`/api/weeks?leagueId=${leagueId}`)
            .then(res => res.json())
            .then(weeks => {
              const matchingWeek = weeks.find((w: any) => 
                weekNumber === 'championship' 
                  ? w.isChampionship 
                  : w.weekNumber === targetWeekNumber
              )
              if (matchingWeek) {
                setCurrentWeekId(matchingWeek.id)
              }
            })
        }
      })
      .catch(err => console.error('Error fetching scores:', err))
    
    // Fetch course for this week
    fetch(`/api/courses?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(courses => {
        // Championship week is stored as week 12 in the database
        const targetWeekNumber = weekNumber === 'championship' ? 12 : parseInt(weekNumber || '0')
        const course = courses.find((c: any) => c.week === targetWeekNumber)
        if (course) {
          setCourseName(course.name)
          setEditingCourseName(course.name)
        } else {
          setCourseName('')
          setEditingCourseName('')
        }
      })
      .catch(err => console.error('Error fetching course:', err))
  }

  const getPlayerScore = (playerId: number): Score | undefined => {
    // Find all scores for this player
    const playerScores = scores.filter(s => s.playerId === playerId)
    
    if (playerScores.length === 0) return undefined
    
    // If multiple scores exist, prefer the one with an image, or the most recent one
    const scoreWithImage = playerScores.find(s => s.scorecardImage)
    if (scoreWithImage) {
      console.log(`Found score with image for player ${playerId}:`, scoreWithImage.scorecardImage)
      return scoreWithImage
    }
    
    // Otherwise return the most recent (highest ID)
    return playerScores.sort((a, b) => b.id - a.id)[0]
  }

  const getPlayerHandicap = (playerId: number): number => {
    return handicaps.find(h => h.playerId === playerId)?.handicap || 0
  }

  const exportToCSV = () => {
    const headers = [
      'Player',
      ...Array.from({ length: 9 }, (_, i) => `Hole ${i + 1}`),
      'Front 9',
      ...Array.from({ length: 9 }, (_, i) => `Hole ${i + 10}`),
      'Back 9',
      'Total',
      'Handicap',
      'Handicapped',
      'Scorecard'
    ]

    const rows = players.map(player => {
      const score = getPlayerScore(player.id)
      const row = [
        `${player.firstName} ${player.lastName}`,
        ...Array.from({ length: 9 }, (_, i) => {
          const holeNum = i + 1
          const field = `hole${holeNum}` as keyof Score
          return score?.[field] || ''
        }),
        score?.front9 || '',
        ...Array.from({ length: 9 }, (_, i) => {
          const holeNum = i + 10
          const field = `hole${holeNum}` as keyof Score
          return score?.[field] || ''
        }),
        score?.back9 || '',
        score?.total || '',
        getPlayerHandicap(player.id),
        score?.weightedScore !== null && score?.weightedScore !== undefined ? Math.round(score.weightedScore) : '',
        score?.scorecardImage ? 'Yes' : 'No'
      ]
      return row.join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `week-${weekNumber}-scores.csv`
    a.click()
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back
        </button>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-black">
            {weekNumber === 'championship' ? 'Championship' : `Week ${weekNumber}`} - Full League Scorecard
          </h1>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Export CSV
          </button>
        </div>

        {/* Course Name Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Course Name</h2>
          <div className="flex gap-4 items-center">
            <input
              type="text"
              value={editingCourseName}
              onChange={(e) => setEditingCourseName(e.target.value)}
              placeholder="Enter course name..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={async () => {
                if (!leagueId || !currentWeekId) return
                
                try {
                  const weekRes = await fetch(`/api/weeks?leagueId=${leagueId}`)
                  if (!weekRes.ok) throw new Error('Failed to fetch weeks')
                  const weeks = await weekRes.json()
                  const week = weeks.find((w: any) => 
                    weekNumber === 'championship' 
                      ? w.isChampionship 
                      : w.weekNumber === parseInt(weekNumber || '0')
                  )

                  if (!week) {
                    alert('Week not found')
                    return
                  }

                  // Check if course exists
                  const coursesRes = await fetch(`/api/courses?leagueId=${leagueId}`)
                  if (!coursesRes.ok) {
                    throw new Error('Failed to fetch courses')
                  }
                  const courses = await coursesRes.json()
                  
                  const existingCourse = courses.find((c: any) => c.week === week.weekNumber)

                  if (existingCourse) {
                    // Update existing course
                    const updateRes = await fetch(`/api/courses/${existingCourse.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: editingCourseName.trim() })
                    })
                    
                    if (!updateRes.ok) {
                      const errorData = await updateRes.json()
                      console.error('Update error response:', errorData)
                      console.error('Update status:', updateRes.status)
                      throw new Error(errorData.error || `Failed to update course (${updateRes.status})`)
                    }
                  } else {
                    // Create new course (even if empty name, to allow setting it later)
                    if (editingCourseName.trim()) {
                      const createRes = await fetch('/api/courses', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: editingCourseName.trim(),
                          week: week.weekNumber,
                          leagueId: parseInt(leagueId)
                        })
                      })
                      
                      if (!createRes.ok) {
                        const errorData = await createRes.json()
                        console.error('Create error response:', errorData)
                        console.error('Create status:', createRes.status)
                        throw new Error(errorData.error || `Failed to create course (${createRes.status})`)
                      }
                    }
                  }

                  // Reload course data to get the saved value
                  const coursesRes2 = await fetch(`/api/courses?leagueId=${leagueId}`)
                  if (coursesRes2.ok) {
                    const courses2 = await coursesRes2.json()
                    const course2 = courses2.find((c: any) => c.week === week.weekNumber)
                    if (course2) {
                      setCourseName(course2.name)
                      setEditingCourseName(course2.name)
                    } else {
                      setCourseName(editingCourseName.trim())
                      setEditingCourseName(editingCourseName.trim())
                    }
                  } else {
                    // If reload fails, at least keep what was entered
                    setCourseName(editingCourseName.trim())
                    setEditingCourseName(editingCourseName.trim())
                  }
                } catch (error: any) {
                  console.error('Error saving course name:', error)
                  alert(`Failed to save course name: ${error.message || 'Unknown error'}`)
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Course Name
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-2 text-left sticky left-0 bg-gray-100 z-10">
                  Player
                </th>
                {Array.from({ length: 9 }, (_, i) => (
                  <th key={i} className="border border-gray-300 px-2 py-2">
                    Hole {i + 1}
                  </th>
                ))}
                <th className="border border-gray-300 px-2 py-2 bg-green-100">Front 9</th>
                {Array.from({ length: 9 }, (_, i) => (
                  <th key={i + 9} className="border border-gray-300 px-2 py-2">
                    Hole {i + 10}
                  </th>
                ))}
                <th className="border border-gray-300 px-2 py-2 bg-green-100">Back 9</th>
                <th className="border border-gray-300 px-2 py-2 bg-blue-100">Total</th>
                <th className="border border-gray-300 px-2 py-2 bg-purple-100">Handicap</th>
                <th className="border border-gray-300 px-2 py-2 bg-yellow-100">Handicapped</th>
                <th className="border border-gray-300 px-2 py-2">Scorecard</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const score = getPlayerScore(player.id)
                return (
                  <tr key={player.id}>
                    <td className="border border-gray-300 px-2 py-2 sticky left-0 bg-white z-10">
                      <a
                        href={`/league-manager/player?playerId=${player.id}&leagueId=${leagueId}`}
                        className="text-blue-600 hover:underline"
                      >
                        {player.firstName} {player.lastName}
                      </a>
                    </td>
                    {Array.from({ length: 9 }, (_, i) => {
                      const holeNum = i + 1
                      const field = `hole${holeNum}` as keyof Score
                      const fieldValue = score?.[field]
                      const displayValue = typeof fieldValue === 'number' || typeof fieldValue === 'string' ? fieldValue : '-'
                      return (
                        <td key={i} className="border border-gray-300 px-2 py-2 text-center">
                          {displayValue}
                        </td>
                      )
                    })}
                    <td className="border border-gray-300 px-2 py-2 text-center font-semibold bg-green-50">
                      {score?.front9 || '-'}
                    </td>
                    {Array.from({ length: 9 }, (_, i) => {
                      const holeNum = i + 10
                      const field = `hole${holeNum}` as keyof Score
                      const fieldValue = score?.[field]
                      const displayValue = typeof fieldValue === 'number' || typeof fieldValue === 'string' ? fieldValue : '-'
                      return (
                        <td key={i + 9} className="border border-gray-300 px-2 py-2 text-center">
                          {displayValue}
                        </td>
                      )
                    })}
                    <td className="border border-gray-300 px-2 py-2 text-center font-semibold bg-green-50">
                      {score?.back9 || '-'}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center font-semibold bg-blue-50">
                      {score ? (
                        <button
                          onClick={() => setEditingScore({ playerId: player.id, score })}
                          className="text-blue-600 hover:underline cursor-pointer"
                        >
                          {score.total || '-'}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (!currentWeekId) return
                            const newScore = {
                              id: 0,
                              weekId: currentWeekId,
                              playerId: player.id,
                              hole1: null,
                              hole2: null,
                              hole3: null,
                              hole4: null,
                              hole5: null,
                              hole6: null,
                              hole7: null,
                              hole8: null,
                              hole9: null,
                              hole10: null,
                              hole11: null,
                              hole12: null,
                              hole13: null,
                              hole14: null,
                              hole15: null,
                              hole16: null,
                              hole17: null,
                              hole18: null,
                              front9: null,
                              back9: null,
                              total: null,
                              weightedScore: null,
                              scorecardImage: null,
                              player: player,
                              week: {
                                weekNumber: parseInt(weekNumber || '0')
                              }
                            } as Score
                            setEditingScore({ playerId: player.id, score: newScore })
                          }}
                          className="text-blue-600 hover:underline cursor-pointer"
                        >
                          -
                        </button>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center font-semibold bg-purple-50">
                      {getPlayerHandicap(player.id)}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center font-semibold bg-yellow-50">
                      {score?.weightedScore !== null && score?.weightedScore !== undefined ? Math.round(score.weightedScore) : '-'}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center">
                      {score?.scorecardImage ? (
                        <a
                          href={score.scorecardImage}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.preventDefault()
                            window.open(score.scorecardImage!, '_blank', 'noopener,noreferrer')
                          }}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                          title="Click to view scorecard image in new window"
                        >
                          📷 View Image
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Edit Score Modal */}
        {editingScore && editingScore.score && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
              <h2 className="text-2xl font-bold mb-4">
                Edit Scores - {players.find(p => p.id === editingScore.playerId)?.firstName} {players.find(p => p.id === editingScore.playerId)?.lastName} - Week {weekNumber === 'championship' ? 'Championship' : weekNumber}
              </h2>
              <div className="grid grid-cols-9 gap-2 mb-4">
                {Array.from({ length: 18 }, (_, i) => {
                  const holeNum = i + 1
                  const field = `hole${holeNum}` as keyof Score
                  const value = editingScore.score![field] as number | null
                  return (
                    <div key={i} className="text-center">
                      <label className="block text-xs mb-1">H{i + 1}</label>
                      <input
                        type="number"
                        value={value || ''}
                        onChange={(e) => {
                          const newScore = { ...editingScore.score! }
                          const value = parseInt(e.target.value) || null
                          ;(newScore as any)[field] = value
                          
                          // Auto-calculate front 9, back 9, and total
                          const front9 = Array.from({ length: 9 }, (_, i) => 
                            newScore[`hole${i + 1}` as keyof Score] as number || 0
                          ).reduce((a, b) => a + b, 0)
                          
                          const back9 = Array.from({ length: 9 }, (_, i) => 
                            newScore[`hole${i + 10}` as keyof Score] as number || 0
                          ).reduce((a, b) => a + b, 0)
                          
                          newScore.front9 = front9
                          newScore.back9 = back9
                          newScore.total = front9 + back9
                          
                          setEditingScore({ ...editingScore, score: newScore })
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-center"
                      />
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 mb-4">
                <div>
                  <label className="block text-sm mb-1">Front 9</label>
                  <input
                    type="number"
                    value={editingScore.score.front9 || ''}
                    onChange={(e) => {
                      setEditingScore({
                        ...editingScore,
                        score: { ...editingScore.score!, front9: parseInt(e.target.value) || null }
                      })
                    }}
                    className="px-2 py-1 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Back 9</label>
                  <input
                    type="number"
                    value={editingScore.score.back9 || ''}
                    onChange={(e) => {
                      setEditingScore({
                        ...editingScore,
                        score: { ...editingScore.score!, back9: parseInt(e.target.value) || null }
                      })
                    }}
                    className="px-2 py-1 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Total</label>
                  <input
                    type="number"
                    value={editingScore.score.total || ''}
                    onChange={(e) => {
                      setEditingScore({
                        ...editingScore,
                        score: { ...editingScore.score!, total: parseInt(e.target.value) || null }
                      })
                    }}
                    className="px-2 py-1 border border-gray-300 rounded"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={async () => {
                    if (!editingScore.score || !currentWeekId) return

                    // Calculate totals
                    const front9 = Array.from({ length: 9 }, (_, i) => 
                      editingScore.score![`hole${i + 1}` as keyof Score] as number || 0
                    ).reduce((a, b) => a + b, 0)
                    const back9 = Array.from({ length: 9 }, (_, i) => 
                      editingScore.score![`hole${i + 10}` as keyof Score] as number || 0
                    ).reduce((a, b) => a + b, 0)
                    const total = front9 + back9
                    
                    // Get handicap for this player and week
                    const handicap = getPlayerHandicap(editingScore.playerId) ?? 0
                    const weightedScore = Math.round(total - handicap)

                    // Collect all hole scores - ensure we have 18 values
                    const scores = Array.from({ length: 18 }, (_, i) => {
                      const holeNum = i + 1
                      const field = `hole${holeNum}` as keyof Score
                      const value = editingScore.score![field] as number | null
                      return value !== null && value !== undefined ? value : 0
                    })

                    // Validate that we have at least some scores entered
                    const hasScores = scores.some(score => score > 0)
                    if (!hasScores && total === 0) {
                      alert('Please enter at least one hole score before saving.')
                      return
                    }

                    // Validate that we have a valid weekId
                    if (!currentWeekId) {
                      alert('Error: Week ID is missing. Please try refreshing the page.')
                      return
                    }

                    try {
                      if (editingScore.score.id === 0) {
                        // Create new score
                        console.log('Creating score with:', { playerId: editingScore.playerId, weekId: currentWeekId, scores })
                        const createRes = await fetch('/api/scores', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            playerId: editingScore.playerId,
                            weekId: currentWeekId,
                            scores,
                            scorecardImage: editingScore.score.scorecardImage || null
                          })
                        })
                        
                        if (!createRes.ok) {
                          const error = await createRes.json()
                          console.error('Error response:', error)
                          throw new Error(error.error || 'Failed to create score')
                        }
                      } else {
                        // Update existing score - send only the fields that can be updated
                        const updateData: any = {
                          hole1: editingScore.score.hole1,
                          hole2: editingScore.score.hole2,
                          hole3: editingScore.score.hole3,
                          hole4: editingScore.score.hole4,
                          hole5: editingScore.score.hole5,
                          hole6: editingScore.score.hole6,
                          hole7: editingScore.score.hole7,
                          hole8: editingScore.score.hole8,
                          hole9: editingScore.score.hole9,
                          hole10: editingScore.score.hole10,
                          hole11: editingScore.score.hole11,
                          hole12: editingScore.score.hole12,
                          hole13: editingScore.score.hole13,
                          hole14: editingScore.score.hole14,
                          hole15: editingScore.score.hole15,
                          hole16: editingScore.score.hole16,
                          hole17: editingScore.score.hole17,
                          hole18: editingScore.score.hole18,
                          front9,
                          back9,
                          total
                        }
                        
                        const updateRes = await fetch(`/api/scores/${editingScore.score.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(updateData)
                        })
                        
                        if (!updateRes.ok) {
                          const error = await updateRes.json()
                          throw new Error(error.error || 'Failed to update score')
                        }
                      }
                      setEditingScore(null)
                      loadData()
                    } catch (error: any) {
                      console.error('Error saving score:', error)
                      alert(`Failed to save score: ${error.message || 'Unknown error'}`)
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Save
                </button>
                {editingScore.score.id === 0 && (
                  <button
                    onClick={async () => {
                      if (!editingScore.score || !currentWeekId) return

                      try {
                        // Calculate default score: roundLow + player's progressive handicap
                        // Get all scores for this week to find round low
                        const weekScores = scores.filter(s => s.total !== null && s.total !== undefined)
                        if (weekScores.length === 0) {
                          alert('No scores posted for this week yet. Cannot calculate default score.')
                          return
                        }

                        const roundLow = Math.min(...weekScores.map(s => s.total!))
                        const playerHandicap = getPlayerHandicap(editingScore.playerId)
                        const defaultTotal = roundLow + playerHandicap

                        // Distribute the total across 18 holes (roughly equal)
                        const avgPerHole = Math.round(defaultTotal / 18)
                        const defaultScores = Array.from({ length: 18 }, () => avgPerHole)
                        
                        // Adjust to make total exact
                        const currentTotal = defaultScores.reduce((a, b) => a + b, 0)
                        const difference = defaultTotal - currentTotal
                        if (difference !== 0) {
                          defaultScores[17] += difference
                        }

                        const front9 = defaultScores.slice(0, 9).reduce((a, b) => a + b, 0)
                        const back9 = defaultScores.slice(9, 18).reduce((a, b) => a + b, 0)

                        // Create score with default values
                        const createRes = await fetch('/api/scores', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            playerId: editingScore.playerId,
                            weekId: currentWeekId,
                            scores: defaultScores,
                            scorecardImage: null
                          })
                        })
                        
                        if (!createRes.ok) {
                          const error = await createRes.json()
                          throw new Error(error.error || 'Failed to create default score')
                        }

                        setEditingScore(null)
                        loadData()
                        alert(`Default score submitted: ${defaultTotal} (Round Low: ${roundLow} + Handicap: ${playerHandicap})`)
                      } catch (error: any) {
                        console.error('Error submitting default score:', error)
                        alert(`Failed to submit default score: ${error.message || 'Unknown error'}`)
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Submit Default Score
                  </button>
                )}
                <button
                  onClick={() => setEditingScore(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

