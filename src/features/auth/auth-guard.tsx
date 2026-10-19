"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isAbortError } from "@/lib/api";

type SessionState = "checking" | "authenticated" | "redirecting" | "error";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SessionState>("checking");

  const handleSession = useCallback((user: Awaited<ReturnType<typeof getCurrentUser>>) => {
    if (!user) {
      setState("redirecting");
      router.replace("/login");
    } else {
      setState("authenticated");
    }
  }, [router]);

  const handleSessionError = useCallback(() => {
    setState("error");
  }, []);

  useEffect(() => {
    let active = true;
    void getCurrentUser()
      .then((user) => {
        if (active) {
          handleSession(user);
        }
      })
      .catch((requestError: unknown) => {
        if (active && !isAbortError(requestError)) {
          handleSessionError();
        }
      });
    return () => {
      active = false;
    };
  }, [handleSession, handleSessionError]);

  if (state === "authenticated") {
    return children;
  }

  if (state === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm space-y-4 text-center">
          <p role="alert" className="text-sm text-muted-foreground">
            No se pudo verificar la sesión. Comprueba la conexión e inténtalo
            nuevamente.
          </p>
          <Button
            onClick={() => {
              setState("checking");
              void getCurrentUser()
                .then(handleSession)
                .catch(handleSessionError);
            }}
          >
            Reintentar
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main
      aria-label="Verificando sesión"
      className="flex min-h-screen items-center justify-center"
    >
      <p role="status" className="text-sm text-muted-foreground">
        {state === "redirecting"
          ? "Redirigiendo al inicio de sesión…"
          : "Verificando sesión…"}
      </p>
    </main>
  );
}
