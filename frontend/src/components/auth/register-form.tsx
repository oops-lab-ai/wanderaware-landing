import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { autoSignIn, confirmSignUp, resendSignUpCode, signUp } from "aws-amplify/auth";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

import { passwordSchema } from "./password-schema";

const RegisterSchema = z
  .object({
    email: z.string().email("Please enter a valid email address."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

interface RegisterFormProps {
  onSuccess: () => void;
  onError?: (error: Error) => void;
}

export function RegisterForm({ onSuccess, onError }: RegisterFormProps) {
  const [step, setStep] = useState<"register" | "confirm">("register");
  const [email, setEmail] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof RegisterSchema>>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const handleError = (error: unknown) => {
    const err = error instanceof Error ? error : new Error("An error occurred.");
    if (onError) {
      onError(err);
    } else {
      toast.error(err.message);
    }
  };

  const onRegister = async (data: z.infer<typeof RegisterSchema>) => {
    setIsSubmitting(true);
    try {
      const result = await signUp({
        username: data.email,
        password: data.password,
        options: {
          userAttributes: { email: data.email },
          autoSignIn: true,
        },
      });

      if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
        setEmail(data.email);
        setStep("confirm");
        toast.info("Check your email for a verification code.");
      } else if (result.nextStep.signUpStep === "COMPLETE_AUTO_SIGN_IN") {
        await autoSignIn();
        onSuccess();
      } else if (result.nextStep.signUpStep === "DONE") {
        onSuccess();
      }
    } catch (error) {
      handleError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onConfirm = async () => {
    if (confirmCode.length !== 6) return;
    setIsSubmitting(true);
    try {
      const result = await confirmSignUp({
        username: email,
        confirmationCode: confirmCode,
      });

      if (result.nextStep.signUpStep === "COMPLETE_AUTO_SIGN_IN") {
        await autoSignIn();
        onSuccess();
      } else {
        onSuccess();
      }
    } catch (error) {
      handleError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResendCode = async () => {
    try {
      await resendSignUpCode({ username: email });
      toast.info("Verification code resent. Check your email.");
    } catch (error) {
      handleError(error);
    }
  };

  if (step === "confirm") {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          We sent a verification code to <strong>{email}</strong>. Enter it below.
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
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onRegister)} className="space-y-4">
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
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
        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Register
        </Button>
      </form>
    </Form>
  );
}
