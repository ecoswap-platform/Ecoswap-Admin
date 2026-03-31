"use client";

import { useEffect, useRef, useState } from "react";
import {
  createConversation,
  fetchMessages,
  sendMessage,
  subscribeToMessages
} from "@/lib/chat/chatService";
import { getUserByEmail, getOtherUsers } from "@/lib/chat/userService";
import { uploadChatFile } from "@/lib/chat/fileService";
import NotificationBell from "@/components/NotificationBell";

const CURRENT_USER_EMAIL = "rupeshbhadane.sae.comp@gmail.com";

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef(null);

  /* AUTO SCROLL */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* LOAD USERS */
  useEffect(() => {
    async function loadUsers() {
      const me = await getUserByEmail(CURRENT_USER_EMAIL);
      const others = await getOtherUsers(CURRENT_USER_EMAIL);
      setCurrentUser(me);
      setUsers(others);
      setLoading(false);
    }
    loadUsers();
  }, []);

  /* CREATE CONVERSATION */
  useEffect(() => {
    if (!currentUser || !selectedUser) return;

    createConversation([
      { id: currentUser.id, type: "user" },
      { id: selectedUser.id, type: "user" }
    ]).then(setConversationId);
  }, [selectedUser, currentUser]);

  /* LOAD + REALTIME */
  useEffect(() => {
    if (!conversationId) return;

    fetchMessages(conversationId).then(res =>
      setMessages(res.data || [])
    );

    const channel = subscribeToMessages(conversationId, msg =>
      setMessages(prev => [...prev, msg])
    );

    return () => channel.unsubscribe();
  }, [conversationId]);

  async function handleSend() {
    if (!text.trim()) return;

    await sendMessage({
      conversation_id: conversationId,
      sender_id: currentUser.id,
      sender_type: "user",
      message_type: "text",
      content: text
    });

    setText("");
  }

  if (loading) {
    return <div className="h-screen flex items-center justify-center">Loading…</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-[#efeae2]">

      {/* TOP BAR */}
      <div className="h-16 bg-white border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <select
            className="border rounded-full px-4 py-1"
            onChange={e =>
              setSelectedUser(
                users.find(u => u.id === Number(e.target.value))
              )
            }
          >
            <option value="">Select user</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <NotificationBell currentUserId={currentUser.id} />
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {messages.map(msg => {
          const isMe = msg.sender_id === currentUser.id;
          const time = new Date(msg.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          });

          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[70%] px-4 py-2 rounded-lg text-sm shadow
                  ${isMe ? "bg-[#d9fdd3]" : "bg-white"}`}
              >
                {msg.content}

                <div className="text-[10px] text-gray-500 text-right mt-1 flex items-center justify-end gap-1">
                  <span>{time}</span>
                  {isMe && <span>✔✔</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT BAR */}
      {selectedUser && (
        <div className="h-16 bg-white border-t flex items-center gap-3 px-4">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type a message"
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 outline-none"
          />
          <button
            onClick={handleSend}
            className="bg-[#00a884] text-white px-6 py-2 rounded-full"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
