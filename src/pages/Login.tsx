import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

type AuthMode = "login" | "signup";

const Login = () => {
  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<AuthMode>(
    location.pathname === "/sign-up" ? "signup" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    setMode(location.pathname === "/sign-up" ? "signup" : "login");
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [location.pathname]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        const { error } = await signIn({ email, password });
        if (error) {
          setErrorMessage(error);
          return;
        }
        navigate("/", { replace: true });
      } else {
        const { error } = await signUp({ email, password });
        if (error) {
          setErrorMessage(error);
          return;
        }
        // Supabase sends a confirmation email before the account is active.
        setSuccessMessage("Check your inbox to confirm your account. Once verified you can sign in.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    navigate(mode === "login" ? "/sign-up" : "/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f9f5ff] via-white to-[#e0f7f8]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-4 py-8 md:flex-row md:items-center md:gap-12">
        <section className="mx-auto mb-12 max-w-xl text-center md:mx-0 md:mb-0 md:max-w-lg">
          <h1 className="text-4xl font-bold leading-tight text-primary md:text-5xl">
            Join the Girl + Environment Community Hub
          </h1>
          <p className="mt-4 text-lg text-muted-foreground md:text-xl">
            Sign in to explore resources, connect with peers, and share opportunities in climate justice.
          </p>
        </section>

        <section className="w-full max-w-md">
          <Card className="border-2 border-primary/20 shadow-lg backdrop-blur">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl text-primary">
                {mode === "login" ? "Welcome back" : "Create an account"}
              </CardTitle>
              <CardDescription className="text-base">
                {mode === "login"
                  ? "Enter your details to access the community hub."
                  : "We'll send you a confirmation email so you can activate your account."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="********"
                    required
                    minLength={6}
                  />
                </div>

                {errorMessage && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive" role="alert">
                    {errorMessage}
                  </p>
                )}
                {successMessage && (
                  <p className="rounded-md border border-emerald-400/50 bg-emerald-50 p-2 text-sm text-emerald-700" role="status">
                    {successMessage}
                  </p>
                )}

                <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                  {isSubmitting
                    ? mode === "login"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "login"
                    ? "Sign in"
                    : "Sign up"}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>
                    <span>New here? </span>
                    <button
                      type="button"
                      onClick={toggleMode}
                      className="font-semibold text-primary hover:text-primary/80"
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    <span>Already registered? </span>
                    <button
                      type="button"
                      onClick={toggleMode}
                      className="font-semibold text-primary hover:text-primary/80"
                    >
                      Sign in instead
                    </button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default Login;
