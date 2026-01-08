'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function MatchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const matchId = searchParams.get('matchId')
  const leagueId = searchParams.get('leagueId')

  useEffect(() => {
    // Redirect to public match page
    if (matchId && leagueId) {
      router.push(`/match?matchId=${matchId}&leagueId=${leagueId}`)
    } else {
      router.push('/')
    }
  }, [matchId, leagueId, router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-600">Redirecting...</div>
    </main>
  )
}
