'use client';

interface Props {
  storeType: string | null;
  hasOrders: boolean;
  onAction: (message: string) => void;
}

export default function QuickActions({ storeType, hasOrders, onAction }: Props) {
  const typeLabel: Record<string, string> = {
    convenience: 'convenience store',
    gas: 'gas station',
    tobacco_smoke: 'smoke shop',
    liquor: 'liquor store',
    grocery: 'grocery store',
    foodservice: 'restaurant',
    gym: 'gym',
    other: 'retail store',
  };
  const label = typeLabel[storeType || ''] || 'store';

  const actions = hasOrders
    ? [
        { emoji: '🎯', label: 'What to pitch?', message: `What products should I pitch to this ${label} today? Consider their order history and suggest 3-5 products.` },
        { emoji: '🔄', label: 'Reorder ideas', message: `Based on their purchase history, what products should I push for reorder?` },
        { emoji: '📈', label: 'Upsell opps', message: `What are the best upsell or cross-sell opportunities for this store based on what they already buy?` },
        { emoji: '📋', label: 'Store summary', message: `Give me a quick summary of this store — their buying patterns, what they buy most, and my best pitch angle.` },
      ]
    : [
        { emoji: '🎯', label: 'What to pitch?', message: `This is a cold ${label}. What should I pitch on my first visit? Suggest 5 products with a reason for each.` },
        { emoji: '🏪', label: 'Store intel', message: `What do I need to know before walking into this store? Summarize their Google rating, reviews, and what that tells me about their customers.` },
        { emoji: '🤝', label: 'Opening line', message: `Give me a strong opening pitch to use when I walk in to this ${label} for the first time.` },
        { emoji: '🏆', label: 'Nearby trends', message: `What products are nearby ${label}s buying most from RepRally? Show me the top sellers.` },
      ];

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6,
      padding: '8px 12px',
      borderTop: '1px solid #f0f0f0',
    }}>
      {actions.map(action => (
        <button
          key={action.label}
          onClick={() => onAction(action.message)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: '#f3f4f6', border: '1px solid #e5e7eb',
            borderRadius: 20, padding: '5px 11px',
            fontSize: 12, color: '#374151', cursor: 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#229c62';
            (e.currentTarget as HTMLButtonElement).style.color = '#fff';
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#229c62';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
            (e.currentTarget as HTMLButtonElement).style.color = '#374151';
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
          }}
        >
          <span>{action.emoji}</span>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
