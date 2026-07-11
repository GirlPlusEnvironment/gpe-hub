import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Megaphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [confirmPassword, setConfirmPassword] = useState("");
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
    setConfirmPassword("");
  }, [location.pathname]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (mode === "signup" && confirmPassword !== password) {
      setErrorMessage("Passwords must match.");
      return;
    }

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
        setSuccessMessage("Check your inbox to confirm your account, then return here to sign in.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbd3d3]">
      <div className="grid min-h-screen md:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-black p-12 text-white md:flex md:flex-col md:items-center md:justify-center">
          <div className="gpe-pattern absolute inset-0 opacity-30" />
          <div className="relative z-10 max-w-xl text-center">
            <Sparkles className="mx-auto mb-10 h-28 w-28 text-white" />
            <h1 className="font-header text-6xl uppercase leading-none md:text-7xl">
              Hey, GPE Community!
            </h1>
            <p className="mt-6 text-2xl font-bold">
              Welcome to your environmental justice hub. Log in to connect, post,
              message, and move work forward together.
            </p>
          </div>
          <Megaphone className="absolute bottom-10 left-10 h-28 w-28 text-white/20" />
        </section>

        <section className="flex items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-md">
            <div className="mb-8 flex gap-4">
              <Button
                type="button"
                variant={mode === "login" ? "default" : "outline"}
                className="flex-1"
                onClick={() => navigate("/login")}
              >
                Log In
              </Button>
              <Button
                type="button"
                variant={mode === "signup" ? "secondary" : "outline"}
                className="flex-1"
                onClick={() => navigate("/sign-up")}
              >
                Sign Up
              </Button>
            </div>

            <div className="gpe-card p-8 md:p-10">
              <h2 className="gpe-heading text-4xl">
                {mode === "login" ? "Welcome Back!" : "Join the Movement"}
              </h2>
              <p className="mt-3 text-sm font-bold text-black/70">
                {mode === "login"
                  ? "Enter your real account details to access the hub."
                  : "We’ll send a confirmation email before your account becomes active."}
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold uppercase">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@gpe.org"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-bold uppercase">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                    minLength={6}
                  />
                </div>

                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase">
                      Confirm Password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Confirm your password"
                      required
                      minLength={6}
                    />
                  </div>
                )}

                {errorMessage && (
                  <div className="rounded-[1.25rem] border-[3px] border-red-500 bg-red-100 p-4 text-sm font-bold text-red-700">
                    {errorMessage}
                  </div>
                )}
                {successMessage && (
                  <div className="rounded-[1.25rem] border-[3px] border-green-600 bg-green-100 p-4 text-sm font-bold text-green-700">
                    {successMessage}
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting
                    ? mode === "login"
                      ? "Signing In..."
                      : "Creating Account..."
                    : mode === "login"
                    ? "Log In"
                    : "Sign Up"}
                </Button>
              </form>

              <div className="mt-6 flex items-center justify-between gap-3 text-sm font-bold">
                <button
                  type="button"
                  className="underline"
                  onClick={() => navigate(mode === "login" ? "/sign-up" : "/login")}
                >
                  {mode === "login" ? "Need an account?" : "Already registered?"}
                </button>
                <span className="inline-flex items-center gap-2 text-black/60">
                  <ArrowLeft className="h-4 w-4" />
                  Password reset coming soon
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
