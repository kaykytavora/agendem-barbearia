import { cn } from "@/lib/utils";

export function AgendemIcon({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("agendem-icon inline-block shrink-0 bg-current", className)} />;
}
