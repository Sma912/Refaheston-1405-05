"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/config";
import { DEMO_ADMIN } from "@/lib/demo/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhoneDisplay } from "@/lib/utils/phone";
import type { Profile } from "@/types/database";
import { toast } from "sonner";

export default function ProfilePage() {
  const demo = isDemoMode();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demo) {
      setProfile(DEMO_ADMIN);
      setFullName(DEMO_ADMIN.full_name ?? "");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setProfile(data);
        setFullName(data.full_name ?? "");
      }
      setLoading(false);
    })();
  }, [demo]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    if (demo) {
      setFullName(fullName.trim());
      toast.success("پروفایل به‌روزرسانی شد (دمو)");
      setSaving(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null })
      .eq("id", profile.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("پروفایل به‌روزرسانی شد");
  }

  if (loading) {
    return <p className="text-slate-500">در حال بارگذاری...</p>;
  }

  if (!profile) {
    return <p className="text-slate-500">برای مشاهده پروفایل وارد شوید.</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">پروفایل</h1>
      <form
        onSubmit={save}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <div className="space-y-1.5">
          <Label>شماره موبایل</Label>
          <Input
            value={formatPhoneDisplay(profile.phone)}
            disabled
            dir="ltr"
            className="text-left"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fullName">نام و نام خانوادگی</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "در حال ذخیره..." : "ذخیره"}
        </Button>
      </form>
    </div>
  );
}
