import React, { useEffect, useMemo, useRef, useState } from 'react'
import { initializeApp } from 'firebase/app'
import {
  getDatabase,
  ref,
  push,
  onValue,
  set,
  off,
  onDisconnect,
  serverTimestamp,
  query,
  limitToLast
} from 'firebase/database'
import { firebaseConfig } from './firebaseConfig'

let appInstance = null
function initFirebaseIfNeeded() {
  if (!appInstance && firebaseConfig && Object.keys(firebaseConfig).length > 0) {
    appInstance = initializeApp(firebaseConfig)
    return true
  }
  return !!appInstance
}

function dmRoomId(a, b) {
  return [a, b].sort().join('__dm__')
}

export default function App({ initialRoom = 'lobby' }) {
  const [dbReady, setDbReady] = useState(false)
  const [db, setDb] = useState(null)

  const clientIdRef = useRef(
    useMemo(() => {
      const existing = localStorage.getItem('anon-chat-client-id')
      if (existing) return existing
      const id = 'u_' + Math.random().toString(36).slice(2, 10)
      localStorage.setItem('anon-chat-client-id', id)
      return id
    }, [])
  )

  const [room, setRoom] = useState(initialRoom)
  const [messages, setMessages] = useState([])
  const [inputName, setInputName] = useState('')
  const [inputText, setInputText] = useState('')
  const [online, setOnline] = useState({})
  const messagesRef = useRef(null)
  const [dmTarget, setDmTarget] = useState('')

  // --- Firebase setup ---
  useEffect(() => {
    const ok = initFirebaseIfNeeded()
    if (!ok) {
      console.warn('Firebase not initialized — paste your firebaseConfig to enable realtime.')
      return
    }
    const database = getDatabase()
    setDb(database)
    setDbReady(true)
  }, [])

  // --- Presence tracking ---
  useEffect(() => {
    if (!dbReady || !db) return
    const presenceRef = ref(db, `presence/${clientIdRef.current}`)
    set(presenceRef, { name: inputName || clientIdRef.current, lastOnline: serverTimestamp() })
    onDisconnect(presenceRef).remove()
    return () => set(presenceRef, null)
  }, [dbReady, db, inputName])

  // --- Load messages ---
  useEffect(() => {
    if (!dbReady || !db) return
    const roomId = dmTarget ? dmRoomId(clientIdRef.current, dmTarget) : room
    const messagesQuery = query(ref(db, `rooms/${roomId}/messages`), limitToLast(100))
    const unsub = onValue(messagesQuery, (snap) => {
      const data = snap.val() || {}
      const msgs = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => a.timestamp - b.timestamp)
      setMessages(msgs)
    })
    return () => off(ref(db, `rooms/${roomId}/messages`))
  }, [dbReady, db, room, dmTarget])

  // --- Online users ---
  useEffect(() => {
    if (!dbReady || !db) return
    const presenceRef = ref(db, 'presence')
    const unsub = onValue(presenceRef, (snap) => {
      setOnline(snap.val() || {})
    })
    return () => off(presenceRef)
  }, [dbReady, db])

  // --- Auto scroll ---
  useEffect(() => {
    if (messagesRef.current)
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages])

  // --- Send message ---
  const sendMessage = async () => {
    if (!inputText.trim()) return
    const name = inputName.trim() || 'Anonymous'
    const text = inputText.trim()
    const roomId = dmTarget ? dmRoomId(clientIdRef.current, dmTarget) : room
    const msgRef = ref(db, `rooms/${roomId}/messages`)
    await push(msgRef, {
      name,
      text,
      sender: clientIdRef.current,
      timestamp: Date.now()
    })
    setInputText('')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-6 px-4">
      <h1 className="text-2xl font-bold mb-2">🔥 Anonymous Chatroom</h1>
      <p className="mb-4 text-gray-400">All messages are public unless you DM someone.</p>

      <div className="flex gap-4 w-full max-w-5xl">
        {/* Left: Chat section */}
        <div className="flex flex-col flex-1 bg-gray-800 rounded-2xl shadow-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="font-semibold text-lg">
                {dmTarget ? `DM with ${dmTarget}` : `Room: ${room}`}
              </h2>
              {dmTarget && (
                <button
                  onClick={() => setDmTarget('')}
                  className="text-sm text-blue-400 hover:underline"
                >
                  ← Back to Lobby
                </button>
              )}
            </div>
          </div>

          <div
            ref={messagesRef}
            className="flex-1 overflow-y-auto bg-gray-700 rounded-lg p-3 mb-3"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`mb-2 p-2 rounded ${
                  m.sender === clientIdRef.current
                    ? 'bg-blue-600 text-white ml-auto max-w-[80%]'
                    : 'bg-gray-600 text-gray-100 mr-auto max-w-[80%]'
                }`}
              >
                <div className="text-xs text-gray-300 mb-1">{m.name}</div>
                <div>{m.text}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              className="flex-1 p-2 rounded-lg bg-gray-700 text-white"
              placeholder="Message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button
              onClick={sendMessage}
              className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg font-semibold"
            >
              Send
            </button>
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="w-64 bg-gray-800 rounded-2xl shadow-lg p-4 flex flex-col">
          <h2 className="font-semibold mb-2">Online users</h2>
          <ul className="flex-1 overflow-y-auto mb-4">
            {Object.keys(online).map((id) => (
              <li
                key={id}
                className={`p-2 rounded-lg mb-1 cursor-pointer ${
                  id === clientIdRef.current
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => {
                  if (id !== clientIdRef.current) setDmTarget(id)
                }}
              >
                {online[id]?.name || id}
              </li>
            ))}
          </ul>

          <div>
            <input
              className="w-full p-2 rounded-lg bg-gray-700 mb-2"
              placeholder="Display name"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
            />
            <button
              onClick={() => setInputName(inputName.trim())}
              className="w-full bg-blue-500 hover:bg-blue-600 py-2 rounded-lg"
            >
              Set Name
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
