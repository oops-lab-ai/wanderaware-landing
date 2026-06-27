import { Link, useNavigate, useSearchParams } from "react-router";

import { LoginForm } from "@/components/auth/login-form";
import { SOCIAL_PROVIDERS, SocialButtons, SocialDivider } from "@/components/auth/social-buttons";
import { hasAmplifyAuthConfig } from "@/lib/amplify/auth-client";

function MissingAuthConfigMessage() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <h2 className="font-medium text-base">Authentication Not Configured</h2>
      <p className="text-muted-foreground text-sm">
        Your <code>amplify_outputs.json</code> is missing Cognito auth values.
      </p>
      <pre className="overflow-x-auto rounded-md bg-black/90 p-3 text-white text-xs">
        npx ampx generate outputs --outputs-version 1 --out-dir ../shared
      </pre>
    </div>
  );
}

export default function LoginV2() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const returnToParam = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";

  function handleLoginSuccess(): void {
    navigate(returnTo || "/", { replace: true });
  }

  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="font-medium text-3xl">Login to your account</h1>
          <p className="text-muted-foreground text-sm">Please enter your details to login.</p>
        </div>

        {hasAmplifyAuthConfig() ? (
          <div className="space-y-4">
            <SocialButtons providers={SOCIAL_PROVIDERS} />
            <SocialDivider />
            <LoginForm
              onSuccess={handleLoginSuccess}
              onConfirmSignUpRequired={(email) =>
                navigate(
                  `/confirm?email=${encodeURIComponent(email)}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`,
                )
              }
              onResetPasswordRequired={(email) =>
                navigate(
                  `/forgot-password?email=${encodeURIComponent(email)}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`,
                )
              }
            />
          </div>
        ) : (
          <MissingAuthConfigMessage />
        )}
      </div>

      <div className="absolute bottom-5 flex w-full justify-between px-10">
        <div className="text-muted-foreground text-sm">
          Don't have an account?{" "}
          <Link className="text-foreground" to={`/register${returnToParam}`}>
            Register
          </Link>
        </div>
        <div className="text-muted-foreground text-sm">
          <Link className="text-foreground" to={`/forgot-password${returnToParam}`}>
            Forgot password?
          </Link>
        </div>
      </div>
    </>
  );
}
