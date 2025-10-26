import React, { useEffect, useMemo, useRef, useState } from 'react'
import Peer from 'peerjs'

/*
  P2P Anonymous Chat using PeerJS cloud signalling (0.peerjs.com).
  - Each peer's id is prefixed with the room: `${room}__${random}`
  - We call peer.listAllPeers() to get all peers connected to the PeerServer,
    then connect to those that share our room prefix.
  - Messages are exchanged over PeerJS DataConnections (wrapping WebRTC DataChannels).

  Notes:
  - Because peer.listAllPeers() queries the PeerServer, it's used here for room discovery.
  - PeerJS uses the public PeerServer by default (0.peerjs.com). See docs.
*/

function makeId() {
  return 'u_' + Math.random().toString(36).slice(2, 10)
}

export default function App() {
  const [room, setRoom] = useState(() => {
    // Room default or from hash
    try {
      const m = window.location.hash.match(/room=([^&]+)/)
      return m ? decodeURIComponent(m[1]) : 'lobby'
    } catch (e) {
      return 'lobby'
    }
  })

  const [name, setName] = useState('')
  const [connectedPeers, setConnectedPeers] = useState([]) // peer ids connected
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('init') // init | ready
  const peerRef = useRef(null)
  const peersRef = useRef({}) // id -> DataConnection
  const localIdRef = useRef(null)

  // Initialize peer
  useEffect(() => {
    const myId = `${room}__${makeId()}`
    localIdRef.current = myId

    // Create Peer — uses PeerJS cloud by default (host 0.peerjs.com)
    const peer = new Peer(myId, {
      debug: 0,
      // You can add config here (host, port) if you self-host PeerServer later
      // For STUN/TURN override, pass 'config' with iceServers if needed.
    })
    peerRef.current = peer

    peer.on('open', () => {
      setStatus('ready')
      console.log('peer open', myId)
      // Discover peers in room and connect
      refreshAndConnect(peer, room)
    })

    // Someone is connecting to us
    peer.on('connection', (conn) => {
      setupConnectionHandlers(conn)
    })

    peer.on('error', (err) => {
      console.error('peer error', err)
    })

    // Periodically refresh peer list to discover new peers
    const interval = setInterval(() => {
      if (peer && peer.open) refreshAndConnect(peer, room)
    }, 5000)

    return () => {
      clearInterval(interval)
      try {
        Object.values(peersRef.current).forEach((c) => c.close && c.close())
        peer.destroy && peer.destroy()
      } catch (e) {}
    }
  }, [room])

  // Refresh peer list and connect to those in same room
  async function refreshAndConnect(peer, roomName) {
    if (!peer || !peer.open) return
    try {
      // listAllPeers queries the PeerServer for all known peers
      const all = await peer.listAllPeers()
      const peersInRoom = (all || []).filter((id) => id.startsWith(roomName + '__') && id !== peer.id)
      // connect to any we don't already have
      for (const id of peersInRoom) {
        if (!peersRef.current[id]) {
          const conn = peer.connect(id, { reliable: true })
          setupConnectionHandlers(conn)
        }
      }
      setConnectedPeers(Object.keys(peersRef.current))
    } catch (e) {
      console.warn('could not list peers', e)
    }
  }

  function setupConnectionHandlers(conn) {
    const id = conn.peer
    peersRef.current[id] = conn

    conn.on('open', () => {
      setConnectedPeers(Object.keys(peersRef.current))
      // announce presence
      sendRaw({ t: 'presence', from: localIdRef.current, name: name || 'Anonymous' }, conn)
    })

    conn.on('data', (data) => {
      // data is an object { t: type, ... }
      if (!data) return
      if (data.t === 'chat') {
        setMessages((m) => [...m, { id: Math.random().toString(36).slice(2), from: data.from, name: data.name, text: data.text, ts: data.ts }])
      } else if (data.t === 'presence') {
        // optional: show online names
        setMessages((m) => [...m, { id: Math.random().toString(36).slice(2), from: data.from, name: data.name, text: `— joined (${data.from})`, ts: Date.now() }])
      }
    })

    conn.on('close', () => {
      delete peersRef.current[id]
      setConnectedPeers(Object.keys(peersRef.current))
      setMessages((m) => [...m, { id: Math.random().toString(36).slice(2), from: id, name: 'system', text: `— ${id} left`, ts: Date.now() }])
    })

    conn.on('error', (err) => {
      console.warn('conn error', err)
    })
  }

  function broadcast(payload) {
    // send to all open connections
    for (const c of Object.values(peersRef.current)) {
      if (c.open) {
        try {
          c.send(payload)
        } catch (e) {
          console.warn('send failed', e)
        }
      }
    }
  }

  function sendRaw(payload, conn) {
    try {
      if (conn) {
        if (conn.open) conn.send(payload)
      } else {
        broadcast(payload)
      }
    } catch (e) {}
  }

  function sendMessage() {
    if (!input.trim()) return
    const payload = {
      t: 'chat',
      from: localIdRef.current,
      name: name.trim() || 'Anonymous',
      text: input.trim(),
      ts: Date.now()
    }
    // local echo
    setMessages((m) => [...m, { id: Math.random().toString(36).slice(2), ...payload }])
    sendRaw(payload)
    setInput('')
  }

  // Join a new room (update URL hash)
  function joinRoom(newRoom) {
    window.location.hash = `room=${encodeURIComponent(newRoom)}`
    // Clean up existing connections and recreate peer by changing state
    // Simpler approach: reload the page (keeps code small)
    window.location.href = window.location.pathname + window.location.search + `#room=${encodeURIComponent(newRoom)}`
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-5xl mx-auto bg-slate-800 rounded-2xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold">P2P Anonymous Chat</h1>
            <div className="text-sm text-slate-300">Room: <span className="font-mono">{room}</span></div>
          </div>
          <div className="text-sm">
            Status: <span className="font-semibold">{status}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3">
            <div className="bg-slate-700 p-3 rounded h-96 overflow-y-auto mb-3">
              {messages.map((m) => (
                <div key={m.id} className={`mb-2 p-2 rounded ${m.from === localIdRef.current ? 'bg-sky-600 ml-auto max-w-[80%]' : 'bg-slate-600'}`}>
                  <div className="text-xs text-slate-200">{m.name} <span className="font-mono text-[10px]">— {m.from}</span></div>
                  <div>{m.text}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e)=> e.key==='Enter' && sendMessage()} placeholder="Message..." className="flex-1 p-2 rounded bg-slate-700" />
              <button onClick={sendMessage} className="px-4 py-2 rounded bg-sky-500">Send</button>
            </div>
          </div>

          <div className="md:col-span-1 bg-slate-700 p-3 rounded">
            <div className="mb-3">
              <label className="block text-sm mb-1">Display name</label>
              <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Anonymous" className="w-full p-2 rounded bg-slate-600" />
            </div>

            <div className="mb-3">
              <label className="block text-sm mb-1">Connected peers</label>
              <ul className="text-sm">
                {Object.keys(peersRef.current).length === 0 && <li className="text-slate-300">No peers yet</li>}
                {Object.keys(peersRef.current).map((id) => (
                  <li key={id} className="break-all">{id}</li>
                ))}
              </ul>
            </div>

            <div className="mb-3">
              <label className="block text-sm mb-1">Join room</label>
              <input defaultValue={room} className="w-full p-2 rounded bg-slate-600 mb-2" id="roomInput" />
              <button onClick={() => {
                const v = document.getElementById('roomInput').value.trim()
                if (v) joinRoom(v)
              }} className="w-full bg-sky-500 py-2 rounded">Go</button>
            </div>

            <div className="text-xs text-slate-300">
              Your peer id: <div className="font-mono break-all text-[12px]">{localIdRef.current}</div>
              <div className="mt-2">Tip: share the room name with others. This page uses the PeerJS public server for signalling and discovery.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
