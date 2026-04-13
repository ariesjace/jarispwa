/**
 * app/auth/login/page.tsx
 * ───────────────────────
 * Public login page. Auth redirect guard lives in the parent
 * app/auth/layout.tsx so this file stays pure.
 */

import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Sign In · JARIS CMS",
};

export default function LoginPage() {
  return <LoginForm />;
}