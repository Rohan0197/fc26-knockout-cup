/** Shown in a production build that has no Supabase credentials - we never fall back to fake data. */
export default function SetupRequired() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ink-950 px-4">
      <div className="panel panel-both max-w-lg p-8">
        <div className="eyebrow">Setup required</div>
        <h1 className="display mt-2 text-5xl text-white">Connect Supabase</h1>
        <p className="mt-4 text-sm leading-relaxed text-mute">
          This site has no database configured. Set <code className="text-soft">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-soft">VITE_SUPABASE_ANON_KEY</code> in the build environment, run{' '}
          <code className="text-soft">supabase/schema.sql</code> in the Supabase SQL editor, then rebuild. See the README for the full
          walkthrough.
        </p>
      </div>
    </div>
  )
}
