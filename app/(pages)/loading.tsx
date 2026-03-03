// Simple skeleton loading - no custom loader for fast loads
// The DelayedLoader is used in individual pages for slow loads (>1s)

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>
    </div>
  );
}
