import { Link, useNavigate, useSearchParams } from "react-router";

import { toast } from "sonner";

import { RegisterForm } from "@/components/auth/register-form";
import { SOCIAL_PROVIDERS, SocialButtons, SocialDivider } from "@/components/auth/social-buttons";

export default function RegisterV2() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const returnToParam = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";

  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="font-medium text-3xl">Create your account</h1>
          <p className="text-muted-foreground text-sm">Set up WanderAware for your care team.</p>
        </div>

        <div className="space-y-4">
          <SocialButtons providers={SOCIAL_PROVIDERS} />
          <SocialDivider label="or sign up with email" />
          <RegisterForm
            onSuccess={() => {
              toast.success("Account created successfully!");
              navigate(returnTo || "/", { replace: true });
            }}
          />
        </div>
      </div>

      <div className="absolute bottom-5 flex w-full justify-center px-10">
        <div className="text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link className="text-foreground" to={`/login${returnToParam}`}>
            Login
          </Link>
        </div>
      </div>
    </>
  );
}
