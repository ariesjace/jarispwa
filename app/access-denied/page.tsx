"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getPrimaryRouteForRole } from "@/lib/roleAccess";
import { ShieldOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const from = searchParams.get("from") ?? "";
  const primaryRoute = user ? getPrimaryRouteForRole(user.role) : "/auth/login";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-none bg-destructive/10 flex items-center justify-center">
            <ShieldOff className="w-8 h-8 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Access Denied
          </h1>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have permission to view{" "}
            {from ? (
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                {from}
              </code>
            ) : (
              "this page"
            )}
            .
          </p>
          {user && (
            <p className="text-xs text-muted-foreground">
              Signed in as <strong>{user.name}</strong> ({user.role})
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => router.push(primaryRoute)}
            className="w-full rounded-none"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go to my dashboard
          </Button>
          {!user && (
            <Button
              variant="outline"
              onClick={() => router.push("/auth/login")}
              className="w-full rounded-none"
            >
              Sign in with a different account
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
