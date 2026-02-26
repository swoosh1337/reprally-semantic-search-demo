'use client';

import ProductRecommendationCard, { type ProductCardData } from './ProductRecommendationCard';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  products?: ProductCardData[];
  timestamp?: number;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f3f4f6;padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
    .replace(/^###\s+(.+)$/gm, '<div style="font-weight:700;font-size:14px;margin-top:8px;margin-bottom:4px">$1</div>')
    .replace(/^##\s+(.+)$/gm, '<div style="font-weight:700;font-size:15px;margin-top:8px;margin-bottom:4px">$1</div>')
    .replace(/^#\s+(.+)$/gm, '<div style="font-weight:700;font-size:16px;margin-top:8px;margin-bottom:4px">$1</div>')
    .replace(/^\d+\.\s+(.+)$/gm, '<div style="margin:3px 0;padding-left:4px">$1</div>')
    .replace(/^[-•]\s+(.+)$/gm, '<div style="margin:3px 0;padding-left:8px">• $1</div>')
    .replace(/\n\n/g, '<div style="margin-top:8px"></div>')
    .replace(/\n/g, '<br/>');
}

interface Props {
  message: Message;
  isLoading?: boolean;
  onProductClick?: (product: ProductCardData) => void;
}

export default function ChatMessage({ message, isLoading, onProductClick }: Props) {
  const isUser = message.role === 'user';

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
        <div style={{
          background: '#f3f4f6', borderRadius: '12px 12px 12px 2px',
          padding: '10px 14px', maxWidth: '80%',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#9ca3af',
              animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
            40% { transform: scale(1.2); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
      alignItems: 'flex-end',
      gap: 8,
    }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #229c62, #16a34a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0, marginBottom: 2,
        }}>
          🤖
        </div>
      )}

      <div style={{ maxWidth: '78%', minWidth: 0 }}>
        <div style={{
          background: isUser ? '#229c62' : '#f3f4f6',
          color: isUser ? '#fff' : '#111',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          padding: '10px 14px',
          fontSize: 13.5,
          lineHeight: 1.55,
        }}>
          {isUser ? (
            <span>{message.content}</span>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
          )}
        </div>

        {/* Product cards — clickable to open modal */}
        {!isUser && message.products && message.products.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>
              MATCHING PRODUCTS FROM CATALOG
            </div>
            {message.products.map(p => (
              <div
                key={p.id}
                onClick={() => onProductClick?.(p)}
                style={{ cursor: onProductClick ? 'pointer' : 'default' }}
              >
                <ProductRecommendationCard product={p} clickable={!!onProductClick} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
