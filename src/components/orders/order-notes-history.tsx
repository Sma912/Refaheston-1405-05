"use client";

import { formatJalaliDate } from "@/lib/utils/date";
import type { OrderNote } from "@/types/database";
import { getNoteTemplate } from "@/lib/orders/note-templates";

export function OrderNotesHistory({ notes }: { notes: OrderNote[] }) {
  if (notes.length === 0) {
    return (
      <p className="text-sm text-slate-500">هنوز یادداشتی ثبت نشده است.</p>
    );
  }

  return (
    <ol className="space-y-3">
      {notes.map((note) => {
        const template = getNoteTemplate(note.template_key);
        return (
          <li
            key={note.id}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>{formatJalaliDate(note.created_at, true)}</span>
              <span className="flex gap-2">
                {template ? (
                  <span className="rounded bg-white px-1.5 py-0.5">
                    {template.label}
                  </span>
                ) : null}
                {note.sent_to_customer ? (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">
                    ارسال به مشتری
                  </span>
                ) : (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5">
                    داخلی
                  </span>
                )}
              </span>
            </div>
            <p className="leading-7 text-slate-800 whitespace-pre-wrap">
              {note.body}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
