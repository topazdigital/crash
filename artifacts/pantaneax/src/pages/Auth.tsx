import { SignIn, SignUp } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const appearance = {
  variables: {
    colorPrimary: "hsl(25 95% 55%)",
    colorBackground: "hsl(220 18% 10%)",
    colorForeground: "hsl(210 20% 92%)",
    colorInput: "hsl(220 14% 14%)",
    colorInputForeground: "hsl(210 20% 92%)",
    colorMutedForeground: "hsl(215 12% 62%)",
    borderRadius: "0.75rem",
  },
  elements: {
    card: "bg-card border border-border shadow-2xl",
    formButtonPrimary: "bg-primary hover:bg-primary/90",
    formFieldInput: "bg-muted border-border",
    headerTitle: "text-foreground",
    headerSubtitle: "text-muted-foreground",
    footerActionLink: "text-primary",
  },
};

export function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        appearance={appearance}
      />
    </div>
  );
}

export function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        appearance={appearance}
      />
    </div>
  );
}

export default function Auth() {
  return <SignInPage />;
}