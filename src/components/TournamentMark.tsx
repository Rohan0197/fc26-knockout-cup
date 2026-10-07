/**
 * Tournament badge - the IT Committee, IIM Bodh Gaya crest.
 * Replace public/logo.webp (720px) and public/logo-sm.webp (128px) to re-brand.
 */
export function TournamentMark({ size = 40, glow }: { size?: number; glow?: boolean }) {
  return (
    <img
      src={size > 64 ? '/logo.webp' : '/logo-sm.webp'}
      width={size}
      height={size}
      alt="IT Committee, IIM Bodh Gaya"
      decoding="async"
      draggable={false}
      className="shrink-0 select-none object-contain"
      style={glow ? { filter: 'drop-shadow(0 0 26px rgba(43,255,136,0.38)) drop-shadow(0 0 60px rgba(230,195,106,0.18))' } : undefined}
    />
  )
}
