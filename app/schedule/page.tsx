'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Image from 'next/image'

interface League {
  id: number
  name: string
}

interface Course {
  id: number
  name: string
  week: number
  leagueId: number
}

// Calculate date ranges for each week starting from December 15, 2024
const getWeekDateRange = (weekNumber: number): string => {
  const startDate = new Date(2024, 11, 15) // December 15, 2024 (month is 0-indexed)
  const daysToAdd = (weekNumber - 1) * 7
  const weekStart = new Date(startDate)
  weekStart.setDate(startDate.getDate() + daysToAdd)
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  
  const formatDate = (date: Date): string => {
    const month = date.toLocaleString('default', { month: 'short' })
    const day = date.getDate()
    return `${month} ${day}`
  }
  
  return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`
}

// Get the start and end dates for a week
const getWeekDates = (weekNumber: number): { start: Date; end: Date } => {
  const startDate = new Date(2024, 11, 15) // December 15, 2024 (month is 0-indexed)
  const daysToAdd = (weekNumber - 1) * 7
  const weekStart = new Date(startDate)
  weekStart.setDate(startDate.getDate() + daysToAdd)
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  
  return { start: weekStart, end: weekEnd }
}

// Calculate the current week number (1-12)
const getCurrentWeek = (): number | null => {
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Reset time to start of day
  
  const seasonStart = new Date(2024, 11, 15) // December 15, 2024
  
  // Check if we're before the season starts
  if (today < seasonStart) {
    return null
  }
  
  // Calculate days since season start
  const daysDiff = Math.floor((today.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24))
  const weekNumber = Math.floor(daysDiff / 7) + 1
  
  // Check if we're within a valid week (1-12)
  if (weekNumber >= 1 && weekNumber <= 12) {
    // Verify we're actually within the week's date range
    const weekDates = getWeekDates(weekNumber)
    if (today >= weekDates.start && today <= weekDates.end) {
      return weekNumber
    }
    // If we're past the current week's end date, we're in the next week
    if (today > weekDates.end && weekNumber < 12) {
      return weekNumber + 1
    }
  }
  
  // If we're past week 12, return null (season is over)
  return null
}

export default function SchedulePage() {
  const router = useRouter()
  const currentWeek = getCurrentWeek()
  const [leagues, setLeagues] = useState<League[]>([])
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null)
  const [courses, setCourses] = useState<Course[]>([])

  useEffect(() => {
    fetch('/api/leagues')
      .then(res => res.json())
      .then(data => {
        setLeagues(data)
        // Default to Clarksville if available
        const clarksville = data.find((l: League) => l.name === 'Clarksville')
        if (clarksville) {
          setSelectedLeagueId(clarksville.id)
        } else if (data.length > 0) {
          setSelectedLeagueId(data[0].id)
        }
      })
      .catch(err => console.error('Error fetching leagues:', err))
  }, [])

  useEffect(() => {
    if (!selectedLeagueId) return

    fetch(`/api/courses?leagueId=${selectedLeagueId}`)
      .then(res => res.json())
      .then(data => setCourses(data))
      .catch(err => console.error('Error fetching courses:', err))
  }, [selectedLeagueId])

  const getCourseName = (weekNumber: number): string | null => {
    const course = courses.find(c => c.week === weekNumber)
    return course?.name || null
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-center mb-2">
          <Image
            src="https://tee24.golf/wp-content/uploads/2023/03/Tee24-rv-2-02.png"
            alt="Tee24 Logo"
            width={100}
            height={33}
            className="object-contain opacity-80"
            unoptimized
          />
        </div>
        <button
          onClick={() => router.push('/')}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back
        </button>

        <h1 className="text-4xl font-bold mb-6 text-center text-black">League Schedule</h1>

        {/* League Selector Dropdown */}
        <div className="mb-6 flex justify-center">
          <select
            value={selectedLeagueId || ''}
            onChange={(e) => setSelectedLeagueId(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
          >
            {leagues.map(league => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="space-y-4">
            {/* Week 1 */}
            <div className={`border-b border-gray-200 pb-4 ${currentWeek === 1 ? 'bg-yellow-50 rounded-lg p-4 -mx-4 -my-2' : ''}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-800">Week 1</h3>
                <p className="text-gray-600">{getWeekDateRange(1)}</p>
              </div>
              {getCourseName(1) && (
                <>
                  <p className="text-gray-700 mt-2">{getCourseName(1)}</p>
                  <div className="text-sm text-gray-600 mt-1 ml-2">
                    <p className="font-semibold">Tees:</p>
                    <p>Under 65 years old = 2nd to last tees</p>
                    <p>Over 65 years old = 2nd to front</p>
                  </div>
                </>
              )}
            </div>

            {/* Week 2 */}
            <div className={`border-b border-gray-200 pb-4 ${currentWeek === 2 ? 'bg-yellow-50 rounded-lg p-4 -mx-4 -my-2' : ''}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-800">Week 2</h3>
                <p className="text-gray-600">{getWeekDateRange(2)}</p>
              </div>
              {getCourseName(2) && (
                <>
                  <p className="text-gray-700 mt-2">{getCourseName(2)}</p>
                  <div className="text-sm text-gray-600 mt-1 ml-2">
                    <p className="font-semibold">Tees:</p>
                    <p>Under 65 years old = 2nd to last tees</p>
                    <p>Over 65 years old = 2nd to front</p>
                  </div>
                </>
              )}
            </div>

            {/* Week 3 */}
            <div className={`border-b border-gray-200 pb-4 ${currentWeek === 3 ? 'bg-yellow-50 rounded-lg p-4 -mx-4 -my-2' : ''}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-800">Week 3</h3>
                <p className="text-gray-600">{getWeekDateRange(3)}</p>
              </div>
              {getCourseName(3) && (
                <>
                  <p className="text-gray-700 mt-2">{getCourseName(3)}</p>
                  <div className="text-sm text-gray-600 mt-1 ml-2">
                    <p className="font-semibold">Tees:</p>
                    <p>Under 65 years old = 2nd to last tees</p>
                    <p>Over 65 years old = 2nd to front</p>
                  </div>
                </>
              )}
            </div>

            {/* Baseline Handicaps Set / Teams Finalized */}
            <div className="border-b border-gray-200 pb-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-lg font-semibold text-blue-800 text-center">
                  Baseline Handicaps Set / Teams Finalized
                </p>
              </div>
            </div>

            {/* Week 4 */}
            <div className={`border-b border-gray-200 pb-4 ${currentWeek === 4 ? 'bg-yellow-50 rounded-lg p-4 -mx-4 -my-2' : ''}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-800">Week 4</h3>
                <p className="text-gray-600">{getWeekDateRange(4)}</p>
              </div>
              {getCourseName(4) && (
                <>
                  <p className="text-gray-700 mt-2">{getCourseName(4)}</p>
                  <div className="text-sm text-gray-600 mt-1 ml-2">
                    <p className="font-semibold">Tees:</p>
                    <p>Under 65 years old = 2nd to last tees</p>
                    <p>Over 65 years old = 2nd to front</p>
                  </div>
                </>
              )}
            </div>

            {/* Week 5 */}
            <div className={`border-b border-gray-200 pb-4 ${currentWeek === 5 ? 'bg-yellow-50 rounded-lg p-4 -mx-4 -my-2' : ''}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-800">Week 5</h3>
                <p className="text-gray-600">{getWeekDateRange(5)}</p>
              </div>
              {getCourseName(5) && (
                <>
                  <p className="text-gray-700 mt-2">{getCourseName(5)}</p>
                  <div className="text-sm text-gray-600 mt-1 ml-2">
                    <p className="font-semibold">Tees:</p>
                    <p>Under 65 years old = 2nd to last tees</p>
                    <p>Over 65 years old = 2nd to front</p>
                  </div>
                </>
              )}
            </div>

            {/* Week 6 */}
            <div className={`border-b border-gray-200 pb-4 ${currentWeek === 6 ? 'bg-yellow-50 rounded-lg p-4 -mx-4 -my-2' : ''}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-800">Week 6</h3>
                <p className="text-gray-600">{getWeekDateRange(6)}</p>
              </div>
              {getCourseName(6) && (
                <>
                  <p className="text-gray-700 mt-2">{getCourseName(6)}</p>
                  <div className="text-sm text-gray-600 mt-1 ml-2">
                    <p className="font-semibold">Tees:</p>
                    <p>Under 65 years old = 2nd to last tees</p>
                    <p>Over 65 years old = 2nd to front</p>
                  </div>
                </>
              )}
            </div>

            {/* Week 7 */}
            <div className={`border-b border-gray-200 pb-4 ${currentWeek === 7 ? 'bg-yellow-50 rounded-lg p-4 -mx-4 -my-2' : ''}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-800">Week 7</h3>
                <p className="text-gray-600">{getWeekDateRange(7)}</p>
              </div>
              {getCourseName(7) && (
                <>
                  <p className="text-gray-700 mt-2">{getCourseName(7)}</p>
                  <div className="text-sm text-gray-600 mt-1 ml-2">
                    <p className="font-semibold">Tees:</p>
                    <p>Under 65 years old = 2nd to last tees</p>
                    <p>Over 65 years old = 2nd to front</p>
                  </div>
                </>
              )}
            </div>

            {/* Week 8 */}
            <div className={`border-b border-gray-200 pb-4 ${currentWeek === 8 ? 'bg-yellow-50 rounded-lg p-4 -mx-4 -my-2' : ''}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-800">Week 8</h3>
                <p className="text-gray-600">{getWeekDateRange(8)}</p>
              </div>
              {getCourseName(8) && (
                <>
                  <p className="text-gray-700 mt-2">{getCourseName(8)}</p>
                  <div className="text-sm text-gray-600 mt-1 ml-2">
                    <p className="font-semibold">Tees:</p>
                    <p>Under 65 years old = 2nd to last tees</p>
                    <p>Over 65 years old = 2nd to front</p>
                  </div>
                </>
              )}
            </div>

            {/* Week 9 */}
            <div className={`border-b border-gray-200 pb-4 ${currentWeek === 9 ? 'bg-yellow-50 rounded-lg p-4 -mx-4 -my-2' : ''}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-800">Week 9</h3>
                <p className="text-gray-600">{getWeekDateRange(9)}</p>
              </div>
              {getCourseName(9) && (
                <>
                  <p className="text-gray-700 mt-2">{getCourseName(9)}</p>
                  <div className="text-sm text-gray-600 mt-1 ml-2">
                    <p className="font-semibold">Tees:</p>
                    <p>Under 65 years old = 2nd to last tees</p>
                    <p>Over 65 years old = 2nd to front</p>
                  </div>
                </>
              )}
            </div>

            {/* Week 10 */}
            <div className={`border-b border-gray-200 pb-4 ${currentWeek === 10 ? 'bg-yellow-50 rounded-lg p-4 -mx-4 -my-2' : ''}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-800">Week 10</h3>
                <p className="text-gray-600">{getWeekDateRange(10)}</p>
              </div>
              {getCourseName(10) && (
                <>
                  <p className="text-gray-700 mt-2">{getCourseName(10)}</p>
                  <div className="text-sm text-gray-600 mt-1 ml-2">
                    <p className="font-semibold">Tees:</p>
                    <p>Under 65 years old = 2nd to last tees</p>
                    <p>Over 65 years old = 2nd to front</p>
                  </div>
                </>
              )}
            </div>

            {/* Team Playoff Start */}
            <div className="border-b border-gray-200 pb-4">
              <div className="bg-yellow-50 rounded-lg p-4">
                <p className="text-lg font-semibold text-yellow-800 text-center">
                  Team Playoff Start
                </p>
              </div>
            </div>

            {/* Week 11 */}
            <div className={`border-b border-gray-200 pb-4 ${currentWeek === 11 ? 'bg-yellow-50 rounded-lg p-4 -mx-4 -my-2' : ''}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-800">Week 11</h3>
                <p className="text-gray-600">{getWeekDateRange(11)}</p>
              </div>
              {getCourseName(11) && (
                <>
                  <p className="text-gray-700 mt-2">{getCourseName(11)}</p>
                  <div className="text-sm text-gray-600 mt-1 ml-2">
                    <p className="font-semibold">Tees:</p>
                    <p>Under 65 years old = 2nd to last tees</p>
                    <p>Over 65 years old = 2nd to front</p>
                  </div>
                </>
              )}
              <p className="text-sm text-gray-600 mt-2 italic">
                League Championship for Individual Play
              </p>
            </div>

            {/* Week 12 / Championship */}
            <div className={`pb-4 ${currentWeek === 12 ? 'bg-yellow-50 rounded-lg p-4 -mx-4 -my-2' : ''}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-800">Championship</h3>
                <p className="text-gray-600">{getWeekDateRange(12)}</p>
              </div>
              {getCourseName(12) && (
                <>
                  <p className="text-gray-700 mt-2">{getCourseName(12)}</p>
                  <div className="text-sm text-gray-600 mt-1 ml-2">
                    <p className="font-semibold">Tees:</p>
                    <p>Under 65 years old = 2nd to last tees</p>
                    <p>Over 65 years old = 2nd to front</p>
                  </div>
                </>
              )}
              <p className="text-sm text-gray-600 mt-2 italic">
                League Championship for Individual Play / Championship Round for Team Play
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

