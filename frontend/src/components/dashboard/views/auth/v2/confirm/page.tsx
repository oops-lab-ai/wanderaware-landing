import { Link, useNavigate, useSearchParams } from "react-router";

import { toast } from "sonner";

import { ConfirmSignUpForm } from "@/components/auth/confirm-signup-form";

export default function ConfirmV2() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? undefined;
  const returnTo = searchParams.get("returnTo");
  const returnToParam = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";

  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="font-medium text-3xl">Verify your account</h1>
          <p className="text-muted-foreground text-sm">Enter the verification code sent to your email.</p>
        </div>

        <ConfirmSignUpForm
          initialEmail={email}
          onSuccess={() => {
            toast.success("Account verified. Please sign in.");
            navigate(returnTo || "/login", { replace: true });
          }}
        />
      </div>

      <div className="absolute bottom-5 flex w-full justify-center px-10">
        <div className="text-muted-foreground text-sm">
          <Link className="text-foreground" to={`/login${returnToParam}`}>
            Back to login
          </Link>
        </div>
      </div>
    </>
  );
}
