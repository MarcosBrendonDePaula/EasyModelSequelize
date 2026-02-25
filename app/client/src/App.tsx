import { Routes, Route, Navigate } from 'react-router'
import { LiveComponentsProvider, LiveDebugger } from '@/core/client'
import { DesignerPage } from './pages/DesignerPage'

function App() {
  return (
    <LiveComponentsProvider
      autoConnect={true}
      reconnectInterval={1000}
      maxReconnectAttempts={5}
      heartbeatInterval={30000}
      debug={false}
    >
      <Routes>
        <Route path="/:roomId?" element={<DesignerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {import.meta.env.DEV && <LiveDebugger />}
    </LiveComponentsProvider>
  )
}

export default App
