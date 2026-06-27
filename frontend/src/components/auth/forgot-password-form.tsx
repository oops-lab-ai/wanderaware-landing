import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { confirmResetPassword, resetPassword } from "aws-amplify/auth";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

import { passwordSchema } from "./password-schema";

const EmailSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

const ResetSchema = z
  .object({
    code: z.string().length(6, "Code must be 6 digits."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

interface ForgotPasswordFormProps {
  initialEmail?: string;
  onSuccess: () => void;
  onError?: (error: Error) => void;
}

export function ForgotPasswordForm({ initialEmail, onSuccess, onError }: ForgotPasswordFormProps) {
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailForm = useForm<z.infer<typeof EmailSchema>>({
    resolver: zodResolver(EmailSchema),
    defaultValues: { email: initialEmail ?? "" },
  });

  const resetForm = useForm<z.infer<typeof ResetSchema>>({
    resolver: zodResolver(ResetSchema),
    defaultValues: { code: "", newPassword: "", confirmPassword: "" },
  });

  const handleError = (error: unknown) => {
    const err = error instanceof Error ? error : new Error("An error occurred.");
    if (onError) {
      onError(err);
    } else {
      toast.error(err.message);
    }
  };

  const onSendCode = async (data: z.infer<typeof EmailSchema>) => {
    setIsSubmitting(true);
    try {
      const { nextStep } = await resetPassword({ username: data.email });

      if (nextStep.resetPasswordStep === "CONFIRM_RESET_PASSWORD_WITH_CODE") {
        setEmail(data.email);
        setStep("reset");
        toast.info("Check your email for a reset code.");
      } else if (nextStep.resetPasswordStep === "DONE") {
        onSuccess();
      }
    } catch (error) {
      handleError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetPassword = async (data: z.infer<typeof ResetSchema>) => {
    setIsSubmitting(true);
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: confirmCode || data.code,
        newPassword: data.newPassword,
      });
      onSuccess();
    } catch (error) {
      handleError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResendCode = async () => {
    try {
      await resetPassword({ username: email });
      toast.info("Reset code resent. Check your email.");
    } catch (error) {
      handleError(error);
    }
  };

  if (step === "reset") {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Enter the code sent to <strong>{email}</strong> and your new password.
        </p>
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={confirmCode}
            onChange={(val) => {
              setConfirmCode(val);
              resetForm.setValue("code", val);
            }}
          >
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
        <Form {...resetForm}>
          <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="space-y-4">
            <FormField
              control={resetForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={resetForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button className="w-full" type="submit" disabled={confirmCode.length !== 6 || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Reset Password
            </Button>
          </form>
        </Form>
        <Button variant="ghost" className="w-full" onClick={onResendCode} type="button">
          Resend Code
        </Button>
      </div>
    );
  }

  return (
    <Form {...emailForm}>
      <form onSubmit={emailForm.handleSubmit(onSendCode)} className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Enter your email address and we&apos;ll send you a code to reset your password.
        </p>
        <FormField
          control={emailForm.control}
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
        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Send Reset Code
        </Button>
      </form>
    </Form>
  );
}
