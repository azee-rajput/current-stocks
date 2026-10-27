export default function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-center">
      <div>
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        <p className="font-medium">Analysing all KSE-100 companies…</p>
        <p className="text-sm text-text-2">The first load reads 100 company pages politely and can take up to a minute. After that it&apos;s cached.</p>
      </div>
    </div>
  );
}
