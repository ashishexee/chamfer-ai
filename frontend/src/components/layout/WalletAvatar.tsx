// Deterministic pixel-avatar generated from a wallet address hash.
// Extracted verbatim from the old inline definition in Sidebar.tsx.

export function WalletAvatar({ address, size = 36 }: { address: string; size?: number }) {
  const hash = address.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  // Dynamic color selection based on address hash
  const hairColors = ['#F5A96F', '#F97316', '#FB923C', '#F59E0B', '#F9B584', '#EA580C'];
  const hairColor = hairColors[hash % hairColors.length];

  const jacketColors = ['#1F1A17', '#171310', '#241C18', '#2A211B'];
  const jacketColor = jacketColors[(hash >> 1) % jacketColors.length];

  const visorColors = ['#F9B584', '#F5A96F', '#FFB066', '#F59E0B', '#FB923C'];
  const visorColor = visorColors[(hash >> 2) % visorColors.length];

  // Decide decorations
  const hasVisor = (hash % 3) !== 0;
  const hasHeadphones = (hash % 2) === 0;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="rounded-xl overflow-hidden shrink-0 shadow-inner">
      <defs>
        <linearGradient id={`bgGrad-${hash}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1A0F08" />
          <stop offset="100%" stopColor="#171717" />
        </linearGradient>
        <linearGradient id={`hairGrad-${hash}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hairColor} />
          <stop offset="100%" stopColor="#1A0F08" />
        </linearGradient>
      </defs>

      {/* Dark background */}
      <rect width="64" height="64" fill={`url(#bgGrad-${hash})`} />

      {/* Neck */}
      <path d="M28 42h8v8h-8z" fill="#FDBA74" opacity="0.85" />
      <path d="M28 44h8v3h-8z" fill="#E28743" opacity="0.4" />

      {/* Face (Boy character silhouette shape) */}
      <rect x="20" y="21" width="24" height="24" rx="7" fill="#FDBA74" />

      {/* Ears */}
      <circle cx="19" cy="31" r="3" fill="#FDBA74" />
      <circle cx="45" cy="31" r="3" fill="#FDBA74" />

      {/* Hair */}
      {hash % 3 === 0 ? (
        /* Undercut sweep */
        <path
          d="M17 21c-1-5 4-10 13-10s16 3 16 9c0 4-5 1-7-1s-5-3-9-3c-5 0-8 2-10 5s-3 0-3 0z"
          fill={`url(#hairGrad-${hash})`}
        />
      ) : hash % 3 === 1 ? (
        /* Cyber spiky */
        <path
          d="M16 23c-2-3 0-9 5-10s8-1 12-3c4-2 9 0 11 3s3 6 4 9c0 0-4-2-6-1s-4 2-7 1c-4-1-6-3-9-2s-6 2-7 2s-3 1-3 1z"
          fill={`url(#hairGrad-${hash})`}
        />
      ) : (
        /* Futuristic fringe */
        <path
          d="M18 21c0-5 5-9 14-9s14 3 14 9c0 0-3-2-5-2s-6 0-9 1-6-1-9-1c-2 0-5 2-5 2z"
          fill={`url(#hairGrad-${hash})`}
        />
      )}

      {/* Eyes */}
      <circle cx="27" cy="30" r="2" fill="#2A1A10" />
      <circle cx="37" cy="30" r="2" fill="#2A1A10" />

      {/* Smile */}
      <path d="M30 36.5 Q32 38.5 34 36.5" stroke="#2A1A10" strokeWidth="1.5" strokeLinecap="round" />

      {/* Cyber Visor */}
      {hasVisor && (
        <g>
          <path d="M16 27.5h32v4.5H16z" fill="#1A0F08" opacity="0.6" />
          <rect x="18" y="26" width="28" height="7.5" rx="2.5" fill={visorColor} opacity="0.9" />
          <path d="M22 27.5h14v1.2H22z" fill="#FFF" opacity="0.5" />
        </g>
      )}

      {/* Headphones */}
      {hasHeadphones && (
        <g>
          <path d="M19 19.5 Q32 10.5 45 19.5" stroke="#F3E7DD" strokeWidth="2.5" fill="none" opacity="0.9" />
          <rect x="15" y="25" width="5.5" height="12" rx="2.5" fill="#3A2A20" />
          <rect x="43.5" y="25" width="5.5" height="12" rx="2.5" fill="#3A2A20" />
          <circle cx="17.75" cy="31" r="1.5" fill="#F9B584" />
          <circle cx="46.25" cy="31" r="1.5" fill="#F9B584" />
        </g>
      )}

      {/* Jacket */}
      <path d="M14 49c3-5 9-7 18-7s15 2 18 7v15H14V49z" fill={jacketColor} />
      <path d="M26 42.5 L32 52 L38 42.5" stroke="#4A3528" strokeWidth="2" fill="none" />
      <circle cx="21" cy="54" r="1.2" fill="#F5A96F" />
      <circle cx="43" cy="54" r="1.2" fill="#F5A96F" />
    </svg>
  );
}
