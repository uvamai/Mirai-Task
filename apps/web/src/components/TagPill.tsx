

const gradients = [
  'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-transparent',
  'bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-transparent',
  'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-transparent',
  'bg-gradient-to-r from-emerald-400 to-teal-500 text-white border-transparent',
  'bg-gradient-to-r from-amber-400 to-orange-500 text-white border-transparent',
  'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white border-transparent',
  'bg-gradient-to-r from-violet-400 to-fuchsia-400 text-white border-transparent',
  'bg-gradient-to-r from-blue-400 to-indigo-500 text-white border-transparent',
];

export function TagPill({ tag }: { tag: string }) {
  const norm = tag.trim().toLowerCase();
  
  // deterministic hash for color picking
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = norm.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % gradients.length;
  const gradientClass = gradients[colorIndex];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm ${gradientClass}`}
    >
      {tag}
    </span>
  );
}
