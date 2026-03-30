// src/components/ReplyableChatMessage.tsx
// Drop-in wrapper for existing message rows in ChatWindow.tsx
// Adds hover reply button + quote rendering

import { useState } from 'react';

export interface MessageWithReply {
  id: string;
  username: string;
  text: string;
  created_at: string;
  reply_to_id?: string;
  reply_preview?: { username: string; text: string } | null;
}

interface Props {
  message: MessageWithReply;
  onReply: (msg: MessageWithReply) => void;
}

export function ReplyableChatMessage({ message, onReply }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ position: 'relative', padding: '4px 0' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Quote block if this is a reply */}
      {message.reply_preview && (
        <div style={{
          borderLeft: '2px solid #1e5a8a',
          paddingLeft: '8px',
          marginBottom: '4px',
          fontSize: '11px',
          color: '#3a6a8a',
          background: '#0a1a2a',
          borderRadius: '0 3px 3px 0',
          padding: '3px 8px',
          maxWidth: '600px',
        }}>
          <span style={{ color: '#2a7ab8' }}>@{message.reply_preview.username}</span>
          {' '}
          {message.reply_preview.text.slice(0, 80)}
          {message.reply_preview.text.length > 80 ? '…' : ''}
        </div>
      )}

      {/* Main message row — keep your existing rendering here */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ color: '#4fc3f7', fontSize: '13px', minWidth: 'fit-content' }}>
          {message.username}
        </span>
        <span style={{ color: '#c8d3e0', fontSize: '13px', flex: 1 }}>
          {message.text}
        </span>

        {/* Reply button: only visible on hover */}
        {hovered && (
          <button
            onClick={() => onReply(message)}
            title="Reply"
            style={{
              background: 'none',
              border: '1px solid #1e3a5a',
              color: '#2a6a9a',
              cursor: 'pointer',
              padding: '2px 8px',
              fontSize: '10px',
              borderRadius: '3px',
              fontFamily: "'Courier New', monospace",
              letterSpacing: '1px',
              flexShrink: 0,
              transition: 'all 0.1s',
            }}
          >
            ↩ REPLY
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REPLY BAR — show above MessageInput when a reply is selected
// Usage: <ReplyBar replyTo={replyTo} onClear={() => setReplyTo(null)} />
// ─────────────────────────────────────────────────────────────────────────────
export function ReplyBar({
  replyTo,
  onClear,
}: {
  replyTo: MessageWithReply;
  onClear: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: '#0a1a2a',
      borderTop: '1px solid #1e3a5a',
      borderLeft: '2px solid #4fc3f7',
      padding: '6px 14px',
      fontSize: '11px',
      color: '#3a6a8a',
    }}>
      <span>↩ Replying to</span>
      <span style={{ color: '#4fc3f7' }}>@{replyTo.username}</span>
      <span style={{ color: '#2a4a6a' }}>
        {replyTo.text.slice(0, 60)}{replyTo.text.length > 60 ? '…' : ''}
      </span>
      <button
        onClick={onClear}
        style={{
          marginLeft: 'auto',
          background: 'none',
          border: 'none',
          color: '#2a5a7a',
          cursor: 'pointer',
          fontSize: '14px',
          lineHeight: 1,
          padding: '0 4px',
        }}
      >
        ✕
      </button>
    </div>
  );
}


