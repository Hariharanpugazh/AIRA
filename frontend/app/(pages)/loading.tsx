import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] w-full animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 bg-primary/10 rounded-full">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
