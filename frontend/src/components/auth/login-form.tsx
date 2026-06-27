import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { confirmSignIn, signIn } from "aws-amplify/auth";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { passwordSchema } from "./password-schema";

const LoginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const NewPasswordSchema = z.object({
  newPassword: passwordSchema,
});

interface LoginFormProps {
  onSuccess: () => void;
  onConfirmSignUpRequired?: (username: string) => void;
  onResetPasswordRequired?: (username: string) => void;
  onError?: (error: Error) => void;
}

export function LoginForm({ onSuccess, onConfirmSignUpRequired, onResetPasswordRequired, onError }: LoginFormProps) {
  const [step, setStep] = useState<"login" | "newPassword">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loginForm = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const newPasswordForm = useForm<z.infer<typeof NewPasswordSchema>>({
    resolver: zodResolver(NewPasswordSchema),
    defaultValues: { newPassword: "" },
  });

  const handleError = (error: unknown) => {
    const err = error instanceof Error ? error : new Error("Authentication failed.");
    if (onError) {
      onError(err);
    } else {
      toast.error(err.message);
    }
  };

  const onLogin = async (data: z.infer<typeof LoginSchema>) => {
    setIsSubmitting(true);
    try {
      const { nextStep } = await signIn({
        username: data.email,
        password: data.password,
      });

      switch (nextStep.signInStep) {
        case "DONE":
          onSuccess();
          break;

        case "CONFIRM_SIGN_UP":
          if (onConfirmSignUpRequired) {
            onConfirmSignUpRequired(data.email);
          } else {
            toast.info("Please verify your email before signing in.");
          }
          break;

        case "RESET_PASSWORD":
          if (onResetPasswordRequired) {
            onResetPasswordRequired(data.email);
          } else {
            toast.info("You need to reset your password.");
          }
          break;

        case "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED":
          setStep("newPassword");
          break;

        default:
          toast.info("Additional verification is required. Please use the mobile app or contact support.");
          break;
      }
    } catch (error) {
      handleError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onNewPassword = async (data: z.infer<typeof NewPasswordSchema>) => {
    setIsSubmitting(true);
    try {
      const { nextStep } = await confirmSignIn({
        challengeResponse: data.newPassword,
      });

      if (nextStep.signInStep === "DONE") {
        onSuccess();
      } else {
        toast.info("Additional verification is required.");
      }
    } catch (error) {
      handleError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "newPassword") {
    return (
      <Form {...newPasswordForm}>
        <form onSubmit={newPasswordForm.handleSubmit(onNewPassword)} className="space-y-4">
          <p className="text-muted-foreground text-sm">You need to set a new password to continue.</p>
          <FormField
            control={newPasswordForm.control}
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
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Set Password & Sign In
          </Button>
        </form>
      </Form>
    );
  }

  return (
    <Form {...loginForm}>
      <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
        <FormField
          control={loginForm.control}
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
          control={loginForm.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Sign In
        </Button>
      </form>
    </Form>
  );
}
