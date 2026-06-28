import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { chatService } from '../../api/chat';

const COLORS = {
  bg: "#F5F4F0",
  surface: "#FFFFFF",
  border: "#E4E2DC",
  accent: "#2563EB",
  text: "#111111",
  muted: "#6B7280",
};

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Using relative path to match the backend setup
      const res = await chatService.chat(userMessage.content);
      const botMessage = { role: 'assistant', content: res.data.reply };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: COLORS.accent,
          color: '#fff',
          border: 'none',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 9999,
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <MessageSquare size={24} />
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      width: isExpanded ? 480 : 380,
      height: isExpanded ? 640 : 500,
      background: COLORS.surface,
      borderRadius: 16,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      overflow: 'hidden',
      border: `1px solid ${COLORS.border}`,
      transition: 'all 0.3s ease'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        background: COLORS.accent,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={20} />
          <span style={{ fontWeight: 600, fontSize: 16 }}>GMS Assistant</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button 
            onClick={() => setIsOpen(false)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: COLORS.bg
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: COLORS.muted, marginTop: 40, fontSize: 14 }}>
            Hi! I'm your GMS Assistant. Ask me about your goals, feedback, and team progress.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            background: msg.role === 'user' ? COLORS.accent : COLORS.surface,
            color: msg.role === 'user' ? '#fff' : COLORS.text,
            padding: '10px 14px',
            borderRadius: '12px',
            border: msg.role === 'user' ? 'none' : `1px solid ${COLORS.border}`,
            maxWidth: '85%',
            fontSize: 14,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap'
          }}>
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div style={{ alignSelf: 'flex-start', padding: '10px 14px', color: COLORS.muted }}>
            <Loader2 size={18} className="animate-spin" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '16px',
        background: COLORS.surface,
        borderTop: `1px solid ${COLORS.border}`,
        display: 'flex',
        gap: '8px'
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Ask a question..."
          rows={1}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '20px',
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bg,
            resize: 'none',
            fontSize: 14,
            outline: 'none',
            fontFamily: 'inherit'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: input.trim() && !isLoading ? COLORS.accent : COLORS.border,
            color: '#fff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: input.trim() && !isLoading ? 'pointer' : 'default',
            transition: 'background 0.2s'
          }}
        >
          <Send size={18} style={{ marginLeft: 2 }} />
        </button>
      </div>
    </div>
  );
}
