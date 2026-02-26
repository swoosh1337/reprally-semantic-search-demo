'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ChatMessage, { type Message } from './ChatMessage';
import QuickActions from './QuickActions';
import RepProductModal from './RepProductModal';
import type { ProductCardData } from './ProductRecommendationCard';
import type { SearchResult } from '@/lib/types';

interface Props {
  storeId: number;
  storeType: string | null;
  hasOrders: boolean;
  storeName: string | null;
}

function storageKey(storeId: number) {
  return `rep-assistant-chat-${storeId}`;
}

function loadHistory(storeId: number): Message[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(storeId: number, messages: Message[]) {
  if (typeof window === 'undefined') return;
  try {
    // Keep last 50 messages max
    const toSave = messages.slice(-50);
    localStorage.setItem(storageKey(storeId), JSON.stringify(toSave));
  } catch {
    // ignore storage errors
  }
}

export default function StoreChat({ storeId, storeType, hasOrders, storeName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductCardData | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history from localStorage when store changes
  useEffect(() => {
    const history = loadHistory(storeId);
    if (history.length === 0) {
      // Welcome message
      const typeLabels: Record<string, string> = {
        convenience: 'convenience store', gas: 'gas station',
        tobacco_smoke: 'smoke shop', liquor: 'liquor store',
        grocery: 'grocery store', foodservice: 'restaurant', gym: 'gym', other: 'store',
      };
      const label = typeLabels[storeType || ''] || 'store';
      const welcome: Message = {
        role: 'assistant',
        content: hasOrders
          ? `I've loaded the data for **${storeName || 'this store'}**. They have order history with RepRally. Ask me anything — what to pitch, upsell opportunities, or reorder suggestions.`
          : `Ready to help you prep for **${storeName || 'this ' + label}**. This is a cold store with no order history yet. I have their Google Places data and nearby store purchase patterns loaded. What do you want to know?`,
        timestamp: Date.now(),
      };
      setMessages([welcome]);
    } else {
      setMessages(history);
    }
  }, [storeId, storeType, hasOrders, storeName]);

  // Save to localStorage on every message change
  useEffect(() => {
    if (messages.length > 0) {
      saveHistory(storeId, messages);
    }
  }, [storeId, messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      // Send full history (excluding welcome if it was auto-generated)
      const historyForApi = updatedMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, messages: historyForApi }),
      });

      if (!res.ok) {
        throw new Error(`Chat API error: ${res.status}`);
      }

      const data = await res.json();

      // Map search results to ProductCardData
      const products: ProductCardData[] = (data.products || []).map((p: SearchResult) => ({
        id: p.id,
        name: p.name,
        brandName: p.brandName,
        category: p.category,
        media: p.media || null,
        wholesalePrice: p.wholesalePrice,
        msrp: p.msrp,
        margin: p.margin,
        similarity: p.similarity,
        document: p.document,
      }));

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.message,
        products: products.length > 0 ? products : undefined,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: Message = {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [messages, storeId, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearHistory = () => {
    localStorage.removeItem(storageKey(storeId));
    setMessages([]);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: '#fff',
    }}>
      {/* Chat header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
            boxShadow: '0 0 0 2px #dcfce7',
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>AI Rep Assistant</span>
        </div>
        <button
          onClick={clearHistory}
          style={{
            fontSize: 11, color: '#9ca3af', background: 'none',
            border: 'none', cursor: 'pointer', padding: '2px 6px',
            fontFamily: 'inherit',
          }}
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 12px 4px',
        display: 'flex', flexDirection: 'column',
      }}>
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} onProductClick={setSelectedProduct} />
        ))}
        {loading && <ChatMessage message={{ role: 'assistant', content: '' }} isLoading />}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      <QuickActions
        storeType={storeType}
        hasOrders={hasOrders}
        onAction={sendMessage}
      />

      {/* Input */}
      <div style={{
        padding: '8px 12px 12px',
        borderTop: '1px solid #f0f0f0',
        background: '#fff',
      }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: '#f9fafb', border: '1.5px solid #e5e7eb',
          borderRadius: 10, padding: '6px 6px 6px 12px',
          transition: 'border-color 0.15s',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about this store..."
            rows={1}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              resize: 'none', outline: 'none', fontSize: 13.5,
              fontFamily: 'inherit', lineHeight: 1.5,
              maxHeight: 100, overflowY: 'auto',
              color: '#111',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 32, height: 32, borderRadius: 7,
              background: input.trim() && !loading ? '#229c62' : '#e5e7eb',
              border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke={input.trim() && !loading ? '#fff' : '#9ca3af'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22 11 13 2 9l20-7z" stroke={input.trim() && !loading ? '#fff' : '#9ca3af'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 4, textAlign: 'center' }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>

      {/* Product detail modal */}
      {selectedProduct && (
        <RepProductModal
          product={selectedProduct}
          storeId={storeId}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
