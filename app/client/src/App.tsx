import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router'
import { api } from './lib/eden-api'
import { LiveComponentsProvider, LiveDebugger } from '@/core/client'
import { FormDemo } from './live/FormDemo'
import { CounterDemo } from './live/CounterDemo'
import { UploadDemo } from './live/UploadDemo'
import { ChatDemo } from './live/ChatDemo'
import { RoomChatDemo } from './live/RoomChatDemo'
import { AuthDemo } from './live/AuthDemo'
import { AppLayout } from './components/AppLayout'
import { DemoPage } from './components/DemoPage'
import { HomePage } from './pages/HomePage'
import { ApiTestPage } from './pages/ApiTestPage'

function AppContent() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [apiResponse, setApiResponse] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    checkApiStatus()
  }, [])

  const checkApiStatus = async () => {
    try {
      const { error } = await api.health.get()
      setApiStatus(error ? 'offline' : 'online')
    } catch {
      setApiStatus('offline')
    }
  }

  const testHealthCheck = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await api.health.get()
      setApiResponse(JSON.stringify(error ?? data, null, 2))
    } catch (e) {
      setApiResponse(`Error: ${e}`)
    }
    setIsLoading(false)
  }

  const testGetUsers = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await api.users.get()
      setApiResponse(JSON.stringify(error ?? data, null, 2))
    } catch (e) {
      setApiResponse(`Error: ${e}`)
    }
    setIsLoading(false)
  }

  const testCreateUser = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await api.users.post({
        name: `Test User ${Date.now()}`,
        email: `test${Date.now()}@example.com`
      })
      setApiResponse(JSON.stringify(error ?? data, null, 2))
    } catch (e) {
      setApiResponse(`Error: ${e}`)
    }
    setIsLoading(false)
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage apiStatus={apiStatus} />} />
        <Route
          path="/api-test"
          element={
            <ApiTestPage
              apiResponse={apiResponse}
              isLoading={isLoading}
              onHealth={testHealthCheck}
              onGetUsers={testGetUsers}
              onCreateUser={testCreateUser}
            />
          }
        />
        <Route
          path="/form"
          element={
            <DemoPage
              note={<>? Este formul?rio usa <code className="text-purple-400">Live.use()</code> - cada campo sincroniza automaticamente com o servidor!</>}
            >
              <FormDemo />
            </DemoPage>
          }
        />
        <Route
          path="/counter"
          element={
            <DemoPage>
              <CounterDemo />
            </DemoPage>
          }
        />
        <Route
          path="/upload"
          element={
            <DemoPage>
              <UploadDemo />
            </DemoPage>
          }
        />
        <Route
          path="/chat"
          element={
            <DemoPage>
              <ChatDemo />
            </DemoPage>
          }
        />
        <Route
          path="/room-chat"
          element={
            <DemoPage
              note={<>🚀 Chat com múltiplas salas usando o novo sistema <code className="text-purple-400">$room</code>!</>}
            >
              <RoomChatDemo />
            </DemoPage>
          }
        />
        <Route
          path="/auth"
          element={
            <DemoPage
              note={<>🔒 Sistema de autenticação declarativo para Live Components com <code className="text-purple-400">$auth</code>!</>}
            >
              <AuthDemo />
            </DemoPage>
          }
        />
        <Route path="*" element={<HomePage apiStatus={apiStatus} />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <LiveComponentsProvider
      autoConnect={true}
      reconnectInterval={1000}
      maxReconnectAttempts={5}
      heartbeatInterval={30000}
      debug={false}
    >
      <AppContent />
      {import.meta.env.DEV && <LiveDebugger />}
    </LiveComponentsProvider>
  )
}

export default App
