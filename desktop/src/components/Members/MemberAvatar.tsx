/** Foto do membro ou as iniciais do nome. */
export function initials(name: string | null | undefined) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function MemberAvatar({
  name,
  avatarUrl,
  size = 28,
  className = '',
}: {
  name: string | null | undefined;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) };
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name ?? ''} style={style} className={`rounded-full object-cover flex-shrink-0 ${className}`} />;
  }
  return (
    <span
      style={style}
      className={`rounded-full bg-emerald-600 text-white font-bold inline-flex items-center justify-center flex-shrink-0 select-none ${className}`}
    >
      {initials(name)}
    </span>
  );
}
