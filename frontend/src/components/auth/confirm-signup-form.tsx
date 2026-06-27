import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { autoSignIn, confirmSignUp, resendSignUpCode } from "aws-amplify/auth";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const ConfirmSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

interface ConfirmSignUpFormProps {
  initialEmail?: string;
  onSuccess: () => void;
  onError?: (error: Error) => void;
}

export function ConfirmSignUpForm({ initialEmail, onSuccess, onError }: ConfirmSignUpFormProps) {
  const [confirmCode, setConfirmCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailLocked, setEmailLocked] = useState(!!initialEmail);

  const form = useForm<z.infer<typeof ConfirmSchema>>({
    resolver: zodResolver(ConfirmSchema),
    defaultValues: { email: initialEmail ?? "" },
  });

  const email = form.watch("email");

  const handleError = (error: unknown) => {
    const err = error instanceof Error ? error : new Error("An error occurred.");
    if (onError) {
      onError(err);
    } else {
      toast.error(err.message);
    }
  };

  const onConfirm = async () => {
    if (confirmCode.length !== 6 || !email) return;
    setIsSubmitting(true);
    try {
      const result = await confirmSignUp({
        username: email,
        confirmationCode: confirmCode,
      });

      if (result.nextStep.signUpStep === "COMPLETE_AUTO_SIGN_IN") {
        await autoSignIn();
      }
      onSuccess();
    } catch (error) {
      handleError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResendCode = async () => {
    if (!email) {
      toast.error("Please enter your email address first.");
      return;
    }
    try {
      await resendSignUpCode({ username: email });
      toast.info("Verification code resent. Check your email.");
      setEmailLocked(true);
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <div className="space-y-4">
      {!emailLocked ? (
        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button variant="outline" className="w-full" onClick={onResendCode} type="button">
              Send Verification Code
            </Button>
          </div>
        </Form>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            Enter the verification code sent to <strong>{email}</strong>.
          </p>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={confirmCode} onChange={setConfirmCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button className="w-full" onClick={onConfirm} disabled={confirmCode.length !== 6 || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Verify Account
          </Button>
          <Button variant="ghost" className="w-full" onClick={onResendCode} type="button">
            Resend Code
          </Button>
        </>
      )}
    </div>
  );
}
