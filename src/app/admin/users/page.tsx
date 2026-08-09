"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/config";
import { useDemoStore } from "@/lib/demo/store";
import type { Profile, UserRole } from "@/types/database";
import { formatPhoneDisplay } from "@/lib/utils/phone";
import { formatJalaliDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export default function AdminUsersPage() {
  const demo = isDemoMode();
  const demoUsers = useDemoStore((s) => s.users);
  const setUserRole = useDemoStore((s) => s.setUserRole);
  const [users, setUsers] = useState<Profile[]>([]);

  async function load() {
    if (demo) {
      setUsers(demoUsers);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setUsers((data as Profile[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, demoUsers]);

  async function setRole(id: string, role: UserRole) {
    if (demo) {
      setUserRole(id, role);
      toast.success("نقش به‌روز شد (دمو)");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("نقش به‌روز شد");
      load();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">کاربران</h1>
      <div className="rounded-2xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام</TableHead>
              <TableHead>شماره</TableHead>
              <TableHead>نقش</TableHead>
              <TableHead>عضویت</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.full_name || "—"}</TableCell>
                <TableCell dir="ltr">{formatPhoneDisplay(u.phone)}</TableCell>
                <TableCell>{u.role === "admin" ? "ادمین" : "کاربر"}</TableCell>
                <TableCell>{formatJalaliDate(u.created_at)}</TableCell>
                <TableCell>
                  {u.role === "admin" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRole(u.id, "user")}
                    >
                      تبدیل به کاربر
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setRole(u.id, "admin")}>
                      تبدیل به ادمین
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
