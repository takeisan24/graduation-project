/**
 * CreatorHub brand icon - gradient "C" logo
 * Dùng thay thế Sparkles icon ở các vị trí branding
 */
export default function CreatorHubIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="creatorhub-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#4CB8E8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#creatorhub-gradient)" />
      <text x="16" y="22.5" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="20" fill="white">C</text>
    </svg>
  );
}
