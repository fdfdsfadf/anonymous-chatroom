Skip to content
Chat history

You said:
Make a website that is a chatroom where there is like one big chatroom and when you post you can sign it to whatever username you want so like it is fully anonymous. Make it so like one person can chat to one another and stuff
ChatGPT said:

Thought for 12s
Anonymous Chatroom - React (single-file)
· typescript
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

Done — I created a single-file React app for an anonymous chatroom in the canvas called "Anonymous Chatroom - React (single-file)". Open it in the canvas to view the full code, setup steps, and notes.

Want me to:

adapt it to use Firestore instead of Realtime Database,

add moderation (bad-word filter / admin delete),

add end-to-end encrypted DMs,
or

convert it into a complete full-stack repo (Node + WebSocket) you can deploy?




No file chosenNo file chosen
ChatGPT can make mistakes. Check important info.
