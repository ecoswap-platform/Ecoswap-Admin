"use client";

import { useEffect, useState } from "react";
import {
  createConversation,
  fetchMessages,
  sendMessage,
  subscribeToMessages
} from "@/lib/chat/chatService";
import { uploadChatFile } from "@/lib/chat/fileService";
import { supabase } from "@/lib/supabaseClient";

/* 🔹 Dummy charity selector (from DB) */
export default function CharityChatPage() {
  const [charities, setCharities] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedCharity, setSelectedCharity] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  /* 1️⃣ Load charities + users */
  useEffect(() => {
    async function loadData() {
      const { data: charityData } = await supabase
        .from("charities")
        .select("id, charity_name");

      const { data: userData } = await supabase
        .from("users")
        .select("id, name, email");

      setCharities(charityData || []);
      setUsers(userData || []);
    }

    loadData();
  }, []);

  /* 2️⃣ Create / load conversation */
  useEffect(() => {
    if (!selectedCharity || !selectedUser) return;

    async function initConversation() {
      const convoId = await createConversation([
        { id: selectedCharity.id, type: "charity" },
        { id: selectedUser.id, type: "user" }
      ]);
      setConversationId(convoId);
    }

    initConversation();
  }, [selectedCharity, selectedUser]);

  /* 3️⃣ Load + subscribe messages */
  useEffect(() => {
    if (!conversationId) return;

    async function loadMessages() {
      const { data } = await fetchMessages(conversationId);
      setMessages(data || []);
    }

    loadMessages();

    const channel = subscribeToMessages(conversationId, msg => {
      setMessages(prev => [...prev, msg]);
    });

    return () => channel.unsubscribe();
  }, [conversationId]);

  /* 4️⃣ Send text */
  async function handleSend() {
    if (!text.trim()) return;

    await sendMessage({
      conversation_id: conversationId,
      sender_id: selectedCharity.id,
      sender_type: "charity",
      message_type: "text",
      content: text
    });

    setText("");
  }

  return (
    <div className="h-screen bg-[#fafafa] flex flex-col">

      {/* HEADER */}
      <div className="bg-white border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">
          Charity Chat Dashboard
        </h1>

        <select
          className="border rounded px-3 py-2"
          onChange={e =>
            setSelectedCharity(
              charities.find(c => c.id == e.target.value)
            )
          }
        >
          <option>Select Charity</option>
          {charities.map(c => (
            <option key={c.id} value={c.id}>
              {c.charity_name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1">

        {/* LEFT — USERS */}
        <div className="w-1/4 bg-white border-r p-4">
          <h2 className="font-semibold mb-3">Users</h2>

          {users.map(u => (
            <div
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className={`p-3 mb-2 rounded cursor-pointer border
                hover:bg-pink-50
                ${selectedUser?.id === u.id ? "bg-pink-50" : ""}
              `}
            >
              <p className="font-medium">{u.name}</p>
              <p className="text-xs text-gray-500">{u.email}</p>
            </div>
          ))}
        </div>

        {/* RIGHT — CHAT */}
        <div className="flex-1 flex flex-col">

          {/* CHAT HEADER */}
          <div className="bg-white border-b p-4 font-medium">
            {selectedUser
              ? `Chat with ${selectedUser.name}`
              : "Select a user to start chatting"}
          </div>

          {/* MESSAGES */}
          <div className="flex-1 p-4 overflow-y-auto space-y-2">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`p-3 rounded max-w-[60%]
                  ${msg.sender_type === "charity"
                    ? "ml-auto bg-black text-white"
                    : "bg-white border"
                  }`}
              >
                {msg.message_type === "text" && msg.content}

                {msg.message_type === "image" && (
                  <img
                    src={msg.file_url}
                    className="max-w-xs rounded"
                  />
                )}

                {msg.message_type === "pdf" && (
                  <a
                    href={msg.file_url}
                    target="_blank"
                    className="underline text-sm"
                  >
                    📄 {msg.content}
                  </a>
                )}

                {msg.message_type === "audio" && (
                  <audio controls src={msg.file_url} />
                )}
              </div>
            ))}
          </div>

          {/* INPUT */}
          {selectedUser && (
            <div className="bg-white border-t p-4 flex gap-2 items-center">

              <input
                type="file"
                onChange={async e => {
                  const file = e.target.files[0];
                  if (!file) return;

                  let bucket = "chat-documents";
                  let type = "pdf";

                  if (file.type.startsWith("image/")) {
                    bucket = "chat-images";
                    type = "image";
                  } else if (file.type.startsWith("audio/")) {
                    bucket = "chat-audio";
                    type = "audio";
                  }

                  const url = await uploadChatFile(file, bucket);

                  await sendMessage({
                    conversation_id: conversationId,
                    sender_id: selectedCharity.id,
                    sender_type: "charity",
                    message_type: type,
                    file_url: url,
                    content: file.name
                  });
                }}
              />

              <input
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Type message..."
                className="flex-1 border rounded px-3 py-2"
              />

              <button
                onClick={handleSend}
                className="bg-black text-white px-4 py-2 rounded"
              >
                Send
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
