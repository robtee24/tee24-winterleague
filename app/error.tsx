'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong!</h2>
        <p className="text-gray-700 mb-4">
          {error.message || 'An unexpected error occurred'}
        </p>
        <div className="space-y-2">
          <button
            onClick={reset}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Go to home page
          </button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-500">Error details</summary>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

