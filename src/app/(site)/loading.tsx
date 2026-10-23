/**
 * Shown instantly while the next page loads (navigations take ~1s on the server),
 * so taps always get immediate visual feedback.
 */
export default function Loading() {
  return (
    <div className="pt-24 pb-24 md:pt-36" aria-busy="true" aria-label="Loading">
      <div className="mx-auto max-w-7xl animate-pulse px-5 sm:px-8">
        <div className="h-3 w-32 rounded-full bg-ink/10" />
        <div className="mt-6 h-12 w-3/4 max-w-xl rounded-2xl bg-ink/10 md:h-16" />
        <div className="mt-4 h-4 w-2/3 max-w-lg rounded-full bg-ink/[.07]" />
        <div className="mt-2 h-4 w-1/2 max-w-md rounded-full bg-ink/[.07]" />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4 rounded-[1.5rem] bg-white p-3 ring-1 ring-ink/5 sm:flex-col sm:p-5">
              <div className="size-28 shrink-0 rounded-[1.1rem] bg-lime-300/40 sm:aspect-[4/3] sm:size-auto" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 w-3/4 rounded-full bg-ink/10" />
                <div className="h-3 w-full rounded-full bg-ink/[.07]" />
                <div className="h-3 w-2/3 rounded-full bg-ink/[.07]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
