import { signInWithRedirect } from "aws-amplify/auth";

import { Button } from "@/components/ui/button";

// Reusable social-auth button row. Adding a new provider is a config-line
// change in PROVIDER_CONFIG + SOCIAL_PROVIDERS, plus uncommenting the
// corresponding block in backend/amplify/auth/resource.ts (and the
// PROVIDER_NAME_BY_PREFIX map in backend/amplify/functions/preSignUp/handler.ts).
// Returns null when the providers array is empty so it's safe to slot into
// any auth form even before any providers are wired.
export type SocialProvider = "Google" | "Apple" | "Facebook" | "Amazon";

// Single source of truth for which providers are enabled across the auth UI.
// To add another provider: provision its OAuth app, set its secrets via
// `npx ampx sandbox --profile admin-amplify-1 secret set …`, uncomment its
// block in backend/amplify/auth/resource.ts, add it to PROVIDER_NAME_BY_PREFIX
// in preSignUp/handler.ts, and add it to this list.
export const SOCIAL_PROVIDERS: readonly SocialProvider[] = ["Google"];

interface SocialButtonsProps {
  providers: readonly SocialProvider[];
  disabled?: boolean;
  customState?: string;
}

const PROVIDER_CONFIG: Record<SocialProvider, { label: string; icon: React.ReactNode }> = {
  Google: { label: "Continue with Google", icon: <GoogleIcon /> },
  Apple: { label: "Continue with Apple", icon: <AppleIcon /> },
  Facebook: { label: "Continue with Facebook", icon: <FacebookIcon /> },
  Amazon: { label: "Continue with Amazon", icon: <AmazonIcon /> },
};

export function SocialButtons({ providers, disabled, customState }: SocialButtonsProps) {
  if (providers.length === 0) return null;

  async function handleClick(provider: SocialProvider) {
    try {
      await signInWithRedirect({ provider, customState });
    } catch (err) {
      console.error("[social signin] redirect failed:", err);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {providers.map((p) => (
        <Button
          key={p}
          type="button"
          variant="outline"
          className="w-full cursor-pointer justify-center gap-2 disabled:cursor-not-allowed"
          disabled={disabled}
          onClick={() => handleClick(p)}
        >
          {PROVIDER_CONFIG[p].icon}
          {PROVIDER_CONFIG[p].label}
        </Button>
      ))}
    </div>
  );
}

// Visual divider between social buttons and the email/password form.
// Self-contained — consumers don't need to add a separate component import
// for this common pattern.
export function SocialDivider({ label = "or continue with email" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-muted-foreground text-xs uppercase tracking-wide">
      <div className="h-px flex-1 bg-border" />
      <span>{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────
// Self-contained so we don't pull in a new icon-asset dependency. Each is the
// brand-mark SVG sized to match Tailwind's size-4 utility (16x16).

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.1V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.83Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.49 2.27-1.18 3.07-.74.85-1.94 1.5-2.93 1.42-.13-1.1.42-2.27 1.13-3.04.78-.86 2.13-1.5 2.98-1.45ZM20.5 17.34c-.5 1.16-1.1 2.3-1.86 3.27-1.06 1.36-2.55 3.06-4.4 3.07-1.65.02-2.07-1.07-4.3-1.06-2.23.01-2.7 1.08-4.34 1.06-1.86-.01-3.27-1.55-4.32-2.92-2.94-3.86-3.25-8.4-1.43-10.81 1.29-1.71 3.34-2.71 5.27-2.71 1.96 0 3.2 1.07 4.82 1.07 1.57 0 2.53-1.07 4.8-1.07 1.72 0 3.55.94 4.85 2.55-4.27 2.34-3.57 8.4 1.91 7.55Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="#1877F2">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.5h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.5h-2.79V24C19.61 23.1 24 18.1 24 12.07Z" />
    </svg>
  );
}

function AmazonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="#FF9900">
      <path d="M14.99 14.42c-1.94 1.43-4.76 2.2-7.18 2.2-3.4 0-6.46-1.26-8.78-3.35-.18-.16-.02-.39.2-.27 2.5 1.46 5.6 2.34 8.79 2.34 2.16 0 4.53-.45 6.7-1.38.33-.14.6.21.27.46Zm.81-.93c-.25-.32-1.65-.15-2.27-.07-.19.02-.22-.14-.05-.26 1.11-.78 2.94-.55 3.15-.29.21.27-.06 2.1-1.11 2.97-.16.13-.31.06-.24-.12.23-.59.74-1.91.52-2.23ZM13.4 1.93c0-.27.13-.45.4-.45h3.62c.28 0 .5.2.5.45v1.96c0 .27-.22.6-.62 1.13l-1.88 2.68c.7-.02 1.43.08 2.06.43.14.08.18.2.19.31v2.09c0 .27-.3.59-.62.43-1.36-.71-3.16-.78-4.66.01-.29.16-.59-.16-.59-.43V8.65c0-.31 0-.84.31-1.31l2.18-3.13H12.5c-.27 0-.49-.2-.49-.45V1.93h1.39ZM6.42 11.36V9.4c0-.27.21-.45.45-.45h2.93c.28 0 .51.2.51.45v1.96c0 .26-.22.6-.62 1.13L7.81 14.7c.7-.02 1.43.07 2.06.42.14.08.18.2.19.31v2.09c0 .27-.3.59-.62.43-1.37-.71-3.16-.78-4.66.01-.29.16-.59-.16-.59-.43v-1.99c0-.31 0-.84.31-1.31l2.18-3.13H6.91c-.27 0-.49-.2-.49-.45Z" />
    </svg>
  );
}
