import { useEffect, useState } from 'react'
import {
  registerAdminWsReconnectListener,
  sendAdminWs,
  subscribeAdminWs,
} from './adminWebSocket'

function normalizeEntityType(entityType) {
  const normalized = String(entityType || '').trim().toUpperCase()
  return normalized === 'ORDER' || normalized === 'PRODUCT' ? normalized : ''
}

function buildPresenceTopic(entityType, entityId) {
  return `/topic/admin/presence/${entityType.toLowerCase()}/${encodeURIComponent(entityId)}`
}

export function useAdminPresence(entityType, entityId) {
  const [activeAdminCount, setActiveAdminCount] = useState(0)

  useEffect(() => {
    const type = normalizeEntityType(entityType)
    const id = entityId != null ? String(entityId).trim() : ''
    if (!type || !id) {
      return undefined
    }

    const topic = buildPresenceTopic(type, id)
    const command = { action: 'JOIN', entityType: type, entityId: id }
    const leaveCommand = { action: 'LEAVE', entityType: type, entityId: id }
    const unsubscribe = subscribeAdminWs(topic, (event) => {
      if (String(event?.entityType || '') !== type || String(event?.entityId || '') !== id) return
      const count = Number(event?.activeAdminCount)
      setActiveAdminCount(Number.isFinite(count) && count >= 0 ? count : 0)
    })
    const removeReconnectListener = registerAdminWsReconnectListener(() => {
      sendAdminWs('/app/admin/presence', command)
    })

    // If the shared socket is already connected, this sends immediately. If it is
    // still connecting, the reconnect listener sends the join after CONNECTED.
    sendAdminWs('/app/admin/presence', command)

    return () => {
      removeReconnectListener()
      sendAdminWs('/app/admin/presence', leaveCommand)
      unsubscribe()
      setActiveAdminCount(0)
    }
  }, [entityId, entityType])

  return { activeAdminCount, hasOtherAdmin: activeAdminCount > 1 }
}
