"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  normalizePhone,
  PHONE_LOCAL_LENGTH,
  sanitizeOtpInput,
  sanitizePhoneInput,
} from "@/lib/utils/phone";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizePhone(phone);
    if (!normalized || normalized.length !== PHONE_LOCAL_LENGTH) {
      setError("شماره موبایل ۱۱ رقمی وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹)");
      return;
    }
    setPhone(normalized);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ارسال کد ناموفق بود");
        return;
      }
      setDevOtp(data.dev_otp ?? null);
      setStep("otp");
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizePhone(phone) ?? phone,
          code: sanitizeOtpInput(code),
          full_name: fullName || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تأیید کد ناموفق بود");
        return;
      }

      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "email",
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md border-slate-200 shadow-lg shadow-slate-200/50">
      <CardHeader>
        <CardTitle>ورود با بله</CardTitle>
        <CardDescription>
          کد تأیید فقط از طریق پیام‌رسان بله ارسال می‌شود.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "phone" ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">نام (اختیاری)</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="نام و نام خانوادگی"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">شماره موبایل</Label>
              <Input
                id="phone"
                inputMode="tel"
                dir="ltr"
                className="text-left tracking-wide"
                value={phone}
                onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                placeholder="09123456789"
                maxLength={PHONE_LOCAL_LENGTH}
                autoComplete="tel"
                required
              />
              <p className="text-xs text-slate-500">
                ۱۱ رقم، با صفر شروع شود — ارقام فارسی هم قبول است
              </p>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "در حال ارسال..." : "ارسال کد از طریق بله"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <p className="text-sm text-slate-600">
              کد ۶ رقمی ارسال‌شده به بله برای شماره{" "}
              <span dir="ltr" className="font-medium">
                {phone}
              </span>{" "}
              را وارد کنید.
            </p>
            {devOtp && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                حالت توسعه — کد: <strong dir="ltr">{devOtp}</strong>
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="code">کد تأیید</Label>
              <Input
                id="code"
                inputMode="numeric"
                dir="ltr"
                className="text-center text-lg tracking-[0.4em]"
                value={code}
                onChange={(e) => setCode(sanitizeOtpInput(e.target.value))}
                placeholder="------"
                maxLength={6}
                required
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
              {loading ? "در حال تأیید..." : "ورود"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
                setDevOtp(null);
              }}
            >
              تغییر شماره
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
