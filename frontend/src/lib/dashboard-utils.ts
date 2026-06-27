/**
 * Shared dashboard UI helpers — centralized to prevent drift across pages.
 */

export function capitalize(s: string | null): string {
  if (!s) return "Member";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function roleBadgeVariant(role: string | null): "default" | "secondary" | "outline" {
  if (role === "owner") return "default";
  if (role === "admin") return "secondary";
  return "outline";
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "--";
  }
}

export function getUsageColor(percentage: number): string {
  if (percentage > 80) return "text-red-500";
  if (percentage > 50) return "text-yellow-500";
  return "text-green-500";
}

export function getProgressColor(percentage: number): string {
  if (percentage > 80) return "[&>[data-slot=progress-indicator]]:bg-red-500";
  if (percentage > 50) return "[&>[data-slot=progress-indicator]]:bg-yellow-500";
  return "[&>[data-slot=progress-indicator]]:bg-green-500";
}
