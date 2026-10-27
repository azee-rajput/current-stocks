export default function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" aria-label="Loading" />
    </div>
  );
}
