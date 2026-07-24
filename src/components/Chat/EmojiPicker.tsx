import { useState } from 'react';
import { Search, X } from 'lucide-react';

const EMOJI_CATEGORIES = [
  {
    name: 'Popular',
    emojis: ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '👏', '🥳', '😍', '💯', '✨', '🚀', '💩']
  },
  {
    name: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
      '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
      '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
      '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓'
    ]
  },
  {
    name: 'Gestures',
    emojis: [
      '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
      '🤝', '🙏', '✍️', '💅', '🤳', '💪', '👈', '👉', '👆', '🖕',
      '👇', '☝️', '🖐️', '✋', '🖖', '👋', '🤙', '👌', '🤏', '✌️'
    ]
  },
  {
    name: 'Hearts & Symbols',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💫', '⭐',
      '🌟', '✨', '💥', '💯', '💢', '💬', '💤', '🔥', '⚡', '🎉'
    ]
  },
  {
    name: 'Objects & Food',
    emojis: [
      '🍕', '🍔', '🍟', '🌭', '🍿', '🥓', '🍣', '🍩', '🍪', '🎂',
      '🍻', '🥂', '☕', '🍵', '🎮', '📱', '💻', '📷', '🎵', '⚽',
      '🏀', '🎯', '🚀', '💡', '🔑', '🎁', '🎈', '🏆', '💎', '💰'
    ]
  }
];

export default function EmojiPicker({
  onSelect,
  onClose
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEmojis = searchQuery.trim()
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => e.includes(searchQuery.trim()))
    : EMOJI_CATEGORIES[activeCategory].emojis;

  return (
    <div className="w-[300px] bg-[#1e1e1e]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl z-50 text-white animate-in fade-in zoom-in-95 duration-150">
      {/* Header & Search */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/10">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search emoji..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-white/30"
          />
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs (shown when not searching) */}
      {!searchQuery && (
        <div className="flex justify-between items-center gap-1 mb-2 pb-1 border-b border-white/5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(idx)}
              className={`text-[11px] px-2 py-1 rounded-md whitespace-nowrap transition-colors ${
                activeCategory === idx
                  ? 'bg-white/20 text-white font-medium'
                  : 'text-muted-foreground hover:text-white hover:bg-white/10'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="grid grid-cols-7 gap-1 max-h-[200px] overflow-y-auto p-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
        {filteredEmojis.map((emoji, idx) => (
          <button
            key={idx}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="text-xl hover:bg-white/20 p-1.5 rounded-lg transition-transform hover:scale-125 flex items-center justify-center cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
