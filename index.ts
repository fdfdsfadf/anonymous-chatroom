/*
Anonymous Chatroom — single-file React component + usage instructions

What this is
- A single-file React component (default export) you can drop into a Vite/React app.
- Uses Firebase Realtime Database for realtime messaging and presence.
- Features:
  - One global "Lobby" chatroom (everyone sees messages)
  - Create/shareable one-to-one private chat rooms (via generated room link/id)
  - When posting a message you can set any display name (fully anonymous per-message signing)
  - Minimal UI built with Tailwind (drop-in) and small utility functions

What you need to run
1) Create a Firebase project at https://console.firebase.google.com/
2) Enable Realtime Database (in test mode while developing) and set rules appropriately before going public.
3) Create a web app inside the Firebase project and copy the config object.
4) Install dependencies (in your project):
   - react, react-dom
   - firebase (v9+ modular)
   - tailwindcss (or include Tailwind CDN for quick prototype)

How to use quickly with Vite (example):
- npm create vite@latest my-chat -- --template react
- cd my-chat
- npm install
- npm i firebase
- Add Tailwind following the Tailwind docs or include CDN in index.html for quick test
- Replace App.jsx content with this file (or import it) and paste your firebaseConfig into the placeholder below.

Security note
- This example is for prototyping and learning. If you deploy publicly you MUST:
  - Add authentication or rate-limits to prevent spam/abuse
  - Harden your Realtime Database rules and validate message shapes
  - Add moderation/logging as needed

*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
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
  limitToLast,
} from "firebase/database";

// --------- PASTE YOUR FIREBASE CONFIG BELOW ---------
const firebaseConfig = {
  // apiKey: "YOUR_API_KEY",
  // authDomain: "your-app.firebaseapp.com",
  // databaseURL: "https://your-app-default-rtdb.firebaseio.com",
  // projectId: "your-project-id",
  // storageBucket: "your-app.appspot.com",
  // messagingSenderId: "...",
  // appId: "..."
};
// ----------------------------------------------------

// If you leave firebaseConfig blank, the UI will render but real-time won't work until you fill it.

let appInstance = null;
function initFirebaseIfNeeded() {
  if (!appInstance && firebaseConfig && Object.keys(firebaseConfig).length > 0) {
    appInstance = initializeApp(firebaseConfig);
    return true;
  }
  return !!appInstance;
}

// Utility: create deterministic private room id for two peer ids (sort to be symmetric)
function dmRoomId(a, b) {
  return [a, b].sort().join("__dm__");
}

export default function AnonymousChatroom({ initialRoom = "lobby" }) {
  const [dbReady, setDbReady] = useState(false);
  const [db, setDb] = useState(null);

  // Local ephemeral client id — used to create DM ids and presence
  const clientIdRef = useRef(
    useMemo(() => {
      // Try to persist one across reloads in localStorage so others can find you for DM
      const existing = localStorage.getItem("anon-chat-client-id");
      if (existing) return existing;
      const id = "u_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("anon-chat-client-id", id);
      return id;
    }, [])
  );

  const [room, setRoom] = useState(initialRoom);
  const [messages, setMessages] = useState([]);
  const [inputName, setInputName] = useState(""); // per-message display name
  const [inputText, setInputText] = useState("");
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState({});
  const messagesRef = useRef(null);

  // UI: DM target id (the client id you want to DM)
  const [dmTarget, setDmTarget] = useState("");

  useEffect(() => {
    const ok = initFirebaseIfNeeded();
    if (!ok) {
      console.warn("Firebase not initialized — paste your firebaseConfig to enable realtime.");
      return;
    }
    const database = getDatabase();
    setDb(database);
    setDbReady(true);
  }, []);

  // subscribe to room messages
  useEffect(() => {
    if (!db) return;
    // attach listener
    const r = ref(db, `rooms/${room}/messages`);
    const q = query(r, limitToLast(200));
    const handle = onValue(q, (snap) => {
      const val = snap.val() || {};
      const arr = Object.keys(val).map((k) => ({ id: k, ...val[k] }));
      // sort by ts
      arr.sort((a, b) => (a.ts || 0) - (b.ts || 0));
      setMessages(arr);
      // scroll into view
      setTimeout(() => {
        if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }, 50);
    });

    messagesRef.current = r; // store to detach later
    return () => {
      off(q);
    };
  }, [db, room]);

  // presence (who's online) for quick demo
  useEffect(() => {
    if (!db) return;
    const presenceRef = ref(db, `presence/${clientIdRef.current}`);
    set(presenceRef, { lastSeen: serverTimestamp() });
    onDisconnect(presenceRef).remove();

    const allPresenceRef = ref(db, `presence`);
    const handle = onValue(allPresenceRef, (snap) => {
      const val = snap.val() || {};
      setOnline(val);
    });

    return () => {
      off(allPresenceRef);
      // try remove our presence on unmount
      set(presenceRef, null).catch(() => {});
    };
  }, [db]);

  function postMessage({ text, displayName }) {
    if (!db) {
      // local only echo
      const local = { id: "local_" + Math.random().toString(36).slice(2, 9), text, displayName, ts: Date.now(), from: clientIdRef.current };
      setMessages((m) => [...m, local]);
      setInputText("");
      return;
    }
    const roomMessagesRef = ref(db, `rooms/${room}/messages`);
    const msg = {
      text: text.trim(),
      displayName: displayName || "anonymous",
      from: clientIdRef.current,
      ts: Date.now(),
    };
    push(roomMessagesRef, msg);
    setInputText("");
  }

  function startDMWith(targetId) {
    if (!targetId) return;
    const id = dmRoomId(clientIdRef.current, targetId);
    setRoom(id);
  }

  // Small helper to create a shareable link (assumes app is hosted at origin)
  function shareRoomLink(roomId) {
    try {
      const url = new URL(window.location.href);
      url.hash = `room=${encodeURIComponent(roomId)}`;
      return url.toString();
    } catch (e) {
      return window.location.href + `#room=${encodeURIComponent(roomId)}`;
    }
  }

  // If location hash contains room param, auto-join
  useEffect(() => {
    try {
      const h = window.location.hash || "";
      const m = h.match(/room=([^&]+)/);
      if (m) {
        setRoom(decodeURIComponent(m[1]));
      }
    } catch (e) {}
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white shadow-md rounded-2xl overflow-hidden grid md:grid-cols-4">
        {/* Left column: controls */}
        <div className="p-4 md:col-span-1 border-r">
          <h2 className="text-xl font-semibold">Anonymous Chat</h2>
          <p className="text-sm text-slate-500 mt-1">Client ID: <span className="font-mono">{clientIdRef.current}</span></p>

          <div className="mt-4">
            <button
              className={`w-full py-2 rounded-lg text-sm border ${room === "lobby" ? "bg-slate-100" : "bg-white"}`}
              onClick={() => setRoom("lobby")}
            >
              Global Lobby
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600">Start a 1:1 (enter peer client id)</label>
            <div className="flex gap-2 mt-2">
              <input value={dmTarget} onChange={(e) => setDmTarget(e.target.value)} placeholder="peer client id" className="flex-1 p-2 border rounded-md text-sm" />
              <button onClick={() => startDMWith(dmTarget)} className="px-3 rounded-md border text-sm">DM</button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Tip: share your client id (<span className="font-mono">{clientIdRef.current}</span>) with someone and they can start a DM. Or use the share link below.
            </p>

            <div className="mt-3">
              <button
                className="text-sm w-full py-2 rounded-lg border"
                onClick={() => {
                  const link = shareRoomLink(dmRoomId(clientIdRef.current, "<their_client_id>"));
                  navigator.clipboard?.writeText(link).then(() => alert("Room link copied — replace <their_client_id> with the other person's client id"));
                }}
              >
                Copy DM template link
              </button>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-medium">Online</h3>
            <div className="mt-2 text-sm">
              {Object.keys(online).length === 0 && <div className="text-xs text-slate-500">No presence info (or Firebase not configured)</div>}
              {Object.keys(online).map((k) => (
                <div key={k} className="flex items-center gap-2 py-1">
                  <div className={`w-2 h-2 rounded-full ${k === clientIdRef.current ? "bg-green-500" : "bg-sky-400"}`} />
                  <div className="font-mono text-xs">{k}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            <div>Room id: <span className="font-mono">{room}</span></div>
            <div className="mt-2">
              <button className="text-sm py-2 w-full border rounded-md" onClick={() => navigator.clipboard?.writeText(shareRoomLink(room))}>
                Copy room link
              </button>
            </div>
          </div>
        </div>

        {/* Main chat column */}
        <div className="md:col-span-3 p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{room === "lobby" ? "Global Lobby" : room.startsWith("u_") && room.includes("__dm__") ? "Direct Message" : "Room: " + room}</h2>
            <div className="text-xs text-slate-500">Messages: {messages.length}</div>
          </div>

          <div ref={messagesRef} className="mt-3 flex-1 overflow-auto p-3 border rounded-lg bg-white">
            {messages.length === 0 && <div className="text-sm text-slate-400">No messages yet — say hi.</div>}
            {messages.map((m) => (
              <div key={m.id} className={`mb-3 p-2 rounded-lg ${m.from === clientIdRef.current ? "bg-slate-100 self-end" : "bg-slate-50"}`}>
                <div className="text-xs text-slate-500">{m.displayName || "anonymous"} <span className="font-mono">— {m.from}</span></div>
                <div className="text-sm mt-1 whitespace-pre-wrap">{m.text}</div>
                <div className="text-[10px] text-slate-400 mt-1">{m.ts ? new Date(m.ts).toLocaleString() : ""}</div>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input value={inputName} onChange={(e) => setInputName(e.target.value)} placeholder="display name (optional)" className="col-span-1 md:col-span-1 p-2 border rounded-md text-sm" />
              <input value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="type a message..." className="col-span-1 md:col-span-2 p-2 border rounded-md text-sm" onKeyDown={(e) => { if (e.key === "Enter") postMessage({ text: inputText, displayName: inputName }); }} />
              <button onClick={() => postMessage({ text: inputText, displayName: inputName })} className="py-2 px-4 rounded-md border">Send</button>
            </div>
            <div className="text-xs text-slate-400 mt-2">Messages are anonymous — set any display name per message. This prototype stores messages in Firebase Realtime Database.</div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-4 text-xs text-slate-500">
        <strong>Reminder:</strong> This is a minimal anonymous chat prototype. If you want moderation, delete/edit features, file uploads, or end-to-end encryption for DMs, tell me and I can add them.
      </div>
    </div>
  );
}
