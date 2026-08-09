import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "ورود" };

export default function LoginPage() {
  return (
    <div className="py-8">
      <Suspense fallback={<div className="text-center text-slate-500">در حال بارگذاری...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
