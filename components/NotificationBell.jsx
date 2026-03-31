"use client";

import { useEffect, useState } from "react";
import {
  getNotifications,
  markAsRead
} from "@/lib/notifications/notificationService";

export default function NotificationBell({ currentUserId }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!currentUserId) return;

    async function loadNotifications() {
      const { data } = await getNotifications(currentUserId);
      setNotifications(data || []);
    }

    loadNotifications();
  }, [currentUserId]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  async function handleRead(id) {
    await markAsRead(id);
    setNotifications(prev =>
      prev.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      )
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-black text-white text-xs rounded-full px-1">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white border rounded shadow">
          {notifications.length === 0 ? (
            <p className="p-3 text-sm text-gray-500">
              No notifications
            </p>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleRead(n.id)}
                className={`p-3 border-b cursor-pointer
                  ${n.is_read ? "bg-white" : "bg-pink-50"}
                `}
              >
                <p className="font-medium text-sm">{n.title}</p>
                <p className="text-xs text-gray-500">{n.body}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
