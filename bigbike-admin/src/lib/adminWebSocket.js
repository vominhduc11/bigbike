// Minimal STOMP-over-WebSocket client for admin push notifications.
// Implements only the subset needed: CONNECT, SUBSCRIBE, UNSUBSCRIBE, receive MESSAGE.
// No external dependencies — native WebSocket only.

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000
// STOMP ERROR frame bodies thrown by WebSocketConfig's interceptor for a rejected admin —
// these are permanent (bad/expired token, inactive account, missing permission), not a
// transient network blip, so reconnecting on a fixed timer would just hammer the server.
const AUTH_REJECTION_PATTERN = /Admin (JWT required|role required|account is not active)|Invalid or expired token|Not permitted to subscribe/i

function parseFrame(raw) {
  const nullIdx = raw.indexOf('\0')
  const text = nullIdx >= 0 ? raw.slice(0, nullIdx) : raw
  const lines = text.split('\n')
  const command = lines[0].trim()
  const headers = {}
  let i = 1
  while (i < lines.length && lines[i].trim() !== '') {
    const colon = lines[i].indexOf(':')
    if (colon >= 0) {
      headers[lines[i].slice(0, colon).trim()] = lines[i].slice(colon + 1).trim()
    }
    i++
  }
  const bodyLines = lines.slice(i + 1)
  const body = bodyLines.join('\n').replace(/\0+$/, '')
  return { command, headers, body }
}

function buildFrame(command, headers, body) {
  let frame = command + '\n'
  for (const [k, v] of Object.entries(headers)) frame += `${k}:${v}\n`
  frame += '\n'
  if (body) frame += body
  return frame + '\0'
}

// ── Singleton state ───────────────────────────────────────────────────────────

let ws = null
let alive = false
let getToken = null
let subscriptions = {}   // destination → Set<handler>
let subIdMap = {}        // destination → subId string (e.g. 'sub-0')
let subCounter = 0
let reconnectTimer = null
let reconnectAttempt = 0
let authRejected = false
let onReconnect = null   // callback fired on every CONNECTED (initial + reconnect)
let onAuthRejected = null
const reconnectListeners = new Set()

function clearReconnect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
}

function scheduleReconnect() {
  clearReconnect()
  if (authRejected) return // permanent rejection — wait for an explicit connectAdminWs() call
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS)
  reconnectAttempt++
  reconnectTimer = setTimeout(openConnection, delay)
}

function openConnection() {
  clearReconnect()
  if (!alive || typeof getToken !== 'function') return

  const token = getToken()
  if (!token) { scheduleReconnect(); return }

  const apiBase = (import.meta.env.VITE_ADMIN_API_BASE || 'http://localhost:8080/api/v1').replace(/\/$/, '')
  const origin = apiBase.replace(/\/api\/v1$/, '')
  const wsUrl = origin.replace(/^http/, 'ws') + '/ws'

  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    ws.send(buildFrame('CONNECT', {
      'accept-version': '1.2,1.1,1.0',
      'heart-beat': '0,0',
      'Authorization': `Bearer ${token}`,
    }))
  }

  ws.onmessage = (e) => {
    const frame = parseFrame(e.data)

    if (frame.command === 'CONNECTED') {
      reconnectAttempt = 0
      authRejected = false
      // Re-subscribe all active topics after (re-)connect, preserving stable subIds
      for (const dest of Object.keys(subscriptions)) {
        if (subscriptions[dest] && subscriptions[dest].size > 0) {
          if (!subIdMap[dest]) subIdMap[dest] = `sub-${subCounter++}`
          ws.send(buildFrame('SUBSCRIBE', { destination: dest, id: subIdMap[dest] }))
        }
      }
      // Notify caller so stale React Query caches can be invalidated after any (re-)connect
      if (typeof onReconnect === 'function') onReconnect()
      reconnectListeners.forEach((listener) => {
        try { listener() } catch { /* a screen listener must not break the shared connection */ }
      })
    }

    if (frame.command === 'MESSAGE') {
      const dest = frame.headers['destination']
      const handlers = subscriptions[dest]
      if (handlers && frame.body) {
        try {
          const payload = JSON.parse(frame.body)
          handlers.forEach((h) => h(payload))
        } catch { /* malformed JSON — ignore */ }
      }
    }

    if (frame.command === 'ERROR') {
      console.warn('[AdminWS] STOMP ERROR:', frame.body)
      if (AUTH_REJECTION_PATTERN.test(frame.body || '')) {
        authRejected = true
        if (typeof onAuthRejected === 'function') {
          try { onAuthRejected() } catch { /* auth recovery must not break socket cleanup */ }
        }
      }
      ws.close()
    }
  }

  ws.onclose = () => {
    ws = null
    if (alive) scheduleReconnect()
  }

  ws.onerror = () => ws && ws.close()
}

// ── Public API ────────────────────────────────────────────────────────────────

export function connectAdminWs(tokenGetter) {
  alive = true
  reconnectAttempt = 0
  authRejected = false
  getToken = tokenGetter
  openConnection()
}

export function disconnectAdminWs() {
  alive = false
  clearReconnect()
  getToken = null
  onReconnect = null
  onAuthRejected = null
  reconnectListeners.clear()
  if (ws) { ws.close(); ws = null }
}

export function setWsReconnectCallback(fn) {
  onReconnect = fn
}

export function setWsAuthRejectedCallback(fn) {
  onAuthRejected = typeof fn === 'function' ? fn : null
}

export function registerAdminWsReconnectListener(listener) {
  if (typeof listener !== 'function') return () => {}
  reconnectListeners.add(listener)
  return () => reconnectListeners.delete(listener)
}

export function sendAdminWs(destination, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !destination) return false
  try {
    ws.send(buildFrame('SEND', {
      destination,
      'content-type': 'application/json',
    }, JSON.stringify(payload)))
    return true
  } catch {
    return false
  }
}

export function subscribeAdminWs(destination, handler) {
  if (!subscriptions[destination]) subscriptions[destination] = new Set()
  subscriptions[destination].add(handler)

  // If already connected, send SUBSCRIBE immediately (only for first handler on this destination)
  if (ws && ws.readyState === WebSocket.OPEN) {
    if (!subIdMap[destination]) {
      subIdMap[destination] = `sub-${subCounter++}`
      ws.send(buildFrame('SUBSCRIBE', { destination, id: subIdMap[destination] }))
    }
  }

  return () => {
    subscriptions[destination]?.delete(handler)
    // Send UNSUBSCRIBE when the last handler on this destination is removed
    if (subscriptions[destination] && subscriptions[destination].size === 0) {
      if (ws && ws.readyState === WebSocket.OPEN && subIdMap[destination]) {
        ws.send(buildFrame('UNSUBSCRIBE', { id: subIdMap[destination] }))
      }
      delete subscriptions[destination]
      delete subIdMap[destination]
    }
  }
}
