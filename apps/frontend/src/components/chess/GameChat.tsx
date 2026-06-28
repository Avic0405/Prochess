'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Send } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

interface GameChatProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function GameChat({ messages, onSend, disabled }: GameChatProps) {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {messages.length === 0 ? (
          <p className="text-center text-muted-foreground text-xs py-4">
            No messages yet. Say hi!
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="text-sm">
              <span className="font-medium">{msg.sender.username}: </span>
              <span className="text-muted-foreground">{msg.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {!disabled && (
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Send a message..."
            maxLength={500}
            className="text-sm"
          />
          <Button onClick={handleSend} size="sm" disabled={!text.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
