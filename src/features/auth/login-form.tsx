"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError, getCurrentUser, isAbortError, login } from "@/lib/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sessionWarning, setSessionWarning] = useState("");

  useEffect(() => {
    let active = true;
    void getCurrentUser()
      .then((user) => {
        if (!active) {
          return;
        }
        if (user) {
          router.replace("/");
        }
      })
      .catch((requestError: unknown) => {
        if (active && !isAbortError(requestError)) {
          setSessionWarning(
            "No pudimos comprobar si ya tienes una sesión. Puedes intentar iniciar sesión.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim();
    if (
      !EMAIL_PATTERN.test(normalizedEmail) ||
      normalizedEmail.length > 254 ||
      password.length === 0 ||
      password.length > 1_024
    ) {
      setError("Ingresa un correo válido y una contraseña.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(normalizedEmail, password);
      router.replace("/");
      router.refresh();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        setError("El correo o la contraseña no son correctos.");
      } else if (requestError instanceof ApiError && requestError.status === 400) {
        setError("Revisa el correo y la contraseña e inténtalo nuevamente.");
      } else {
        setError(
          "No se pudo iniciar sesión. Comprueba la conexión e inténtalo nuevamente.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            alt="Tennis Star"
            className="mb-4 h-auto w-full max-w-[220px] object-contain"
            height={835}
            priority
            src="/Logo%20TenisStar.png"
            width={1883}
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            Iniciar sesión
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresa a tu panel de administración
          </p>
        </div>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-base">Bienvenido</CardTitle>
            <CardDescription>
              Usa las credenciales de administrador para continuar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessionWarning && (
              <p className="mb-4 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
                {sessionWarning}
              </p>
            )}
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                  Correo electrónico
                </label>
                <input
                  autoComplete="username"
                  autoFocus
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  disabled={isCheckingSession || isSubmitting}
                  id="email"
                  maxLength={254}
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@ejemplo.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </label>
                <input
                  autoComplete="current-password"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  disabled={isCheckingSession || isSubmitting}
                  id="password"
                  maxLength={1_024}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </div>
              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <Button
                className="w-full"
                disabled={isCheckingSession || isSubmitting}
                type="submit"
              >
                {isCheckingSession
                  ? "Verificando sesión…"
                  : isSubmitting
                    ? "Ingresando…"
                    : "Ingresar"}
                {!isCheckingSession && !isSubmitting && (
                  <ArrowRight aria-hidden="true" data-icon="inline-end" />
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Acceso exclusivo para administradores.
        </p>
      </div>
    </main>
  );
}
