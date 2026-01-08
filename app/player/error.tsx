'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PlayerError({ 
  error, 
  reset 
}: { 
  error: Error & { digest?: string }
  reset: () => void 
}) {
  const router = useRouter()

  useEffect(() => {
    // Log detailed error information
    console.error('Player Page Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      digest: error.digest,
      timestamp: new Date().toISOString()
    })
  }, [error])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full">
        <h2 className="text-2xl font-bold mb-4 text-red-600">Something went wrong on the player page!</h2>
        <div className="mb-4 p-4 bg-red-50 rounded-lg">
          <p className="font-semibold text-gray-800 mb-2">Error Details:</p>
          <p className="text-sm text-gray-700 font-mono">{error.message}</p>
          {error.stack && (
            <details className="mt-2">
              <summary className="text-sm text-gray-600 cursor-pointer">Stack Trace</summary>
              <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-60 p-2 bg-gray-100 rounded">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try again
          </button>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          >
            Go Back
          </button>
        </div>
        <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>For debugging:</strong> Please check the browser console (F12) for more detailed error information.
            The error details above should help identify which part of the code is failing.
          </p>
        </div>
      </div>
    </main>
  )
}

