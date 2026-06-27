import { Link, useNavigate, useSearchParams } from "react-router";

import { toast } from "sonner";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordV2() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? undefined;

  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="font-medium text-3xl">Reset your password</h1>
          <p className="text-muted-foreground text-sm">We'll send you a verification code to reset your password.</p>
        </div>

        <ForgotPasswordForm
          initialEmail={email}
          onSuccess={() => {
            toast.success("Password reset successfully.");
            navigate("/login");
          }}
        />
      </div>

      <div className="absolute bottom-5 flex w-full justify-center px-10">
        <div className="text-muted-foreground text-sm">
          <Link className="text-foreground" to="/login">
            Back to login
          </Link>
        </div>
      </div>
    </>
  );
}
