import type { ReactNode } from 'react'
import { BackButton } from './BackButton'

export function DemoPage({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-56px)] sm:min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-3 sm:px-4 py-6 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <BackButton />
      </div>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-center">
        {children}
      </div>
      {note && (
        <p className="mt-4 sm:mt-6 text-gray-400 text-xs sm:text-sm max-w-md text-center px-2">
          {note}
        </p>
      )}
    </div>
  )
}
