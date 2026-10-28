import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DemoNotice, FieldError, Logo } from "./ui-bits";

export function AuthLayout({
  title,
  subtitle,
  children,
  aside,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">
            <DemoNotice>
              Frontend demo: no account is created or verified. Submitting opens the portal with
              sample data.
            </DemoNotice>
          </div>
          <div className="mt-6">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden border-l bg-accent lg:block">
        <div className="grid-bg absolute inset-0" />
        <div className="relative flex h-full flex-col justify-center px-14">{aside}</div>
      </div>
    </div>
  );
}

export function TextField({
  id,
  label,
  error,
  hint,
  ...props
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block">
        {label}
      </Label>
      <Input id={id} aria-invalid={!!error} className="h-10 bg-card" {...props} />
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <FieldError msg={error} />
    </div>
  );
}

export function PasswordField({
  id,
  label,
  error,
  ...props
}: {
  id: string;
  label: string;
  error?: string | undefined;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          aria-invalid={!!error}
          className="h-10 bg-card pr-10"
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <FieldError msg={error} />
    </div>
  );
}
