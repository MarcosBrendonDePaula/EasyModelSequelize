import { useParams, useNavigate } from 'react-router'
import { useMemo } from 'react'
import { Live } from '@/core/client'
import { LiveSchemaDesigner } from '@server/live/LiveSchemaDesigner'
import { DesignerHeader } from '../components/designer/DesignerHeader'
import { DesignerSidebar } from '../components/designer/DesignerSidebar'
import { DesignerCanvas } from '../components/designer/DesignerCanvas'
import { RightPanel } from '../components/designer/RightPanel'
import { StatusBar } from '../components/designer/StatusBar'

export function DesignerPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()

  const effectiveRoomId = useMemo(() => {
    if (roomId) return roomId
    const newId = crypto.randomUUID().slice(0, 8)
    navigate(`/${newId}`, { replace: true })
    return newId
  }, [roomId])

  const designer = Live.use(LiveSchemaDesigner, {
    room: `schema-${effectiveRoomId}`,
    persistState: false
  })

  const activeModel = designer.$state.models.find(
    (m: any) => m.id === designer.$state.activeModelId
  )

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden">
      <DesignerHeader designer={designer} roomId={effectiveRoomId} />

      <div className="flex-1 flex overflow-hidden">
        <DesignerSidebar designer={designer} />

        {/* Canvas is always visible */}
        <DesignerCanvas designer={designer} />

        {/* Right panel with tabs for Editor and Code */}
        <RightPanel designer={designer} activeModel={activeModel} />
      </div>

      <StatusBar designer={designer} />
    </div>
  )
}
