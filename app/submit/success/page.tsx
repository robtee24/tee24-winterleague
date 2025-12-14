'use client'

import { useRouter } from 'next/navigation'

export default function SuccessPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold mb-4 text-black">
          Thanks for submitting!
        </h1>
        <p className="text-gray-600 mb-6">
          Your scores have been successfully submitted.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => router.push('/leaderboard')}
            className="w-full py-3 px-6 bg-green-600 text-white rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors"
          >
            See Leaderboard
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 px-6 bg-gray-300 text-gray-700 rounded-lg font-semibold text-lg hover:bg-gray-400 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  )
}

