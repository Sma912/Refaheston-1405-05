export default function ProductLoading() {
  return (
    <div className="grid animate-pulse gap-8 lg:grid-cols-2" aria-busy="true">
      <div className="aspect-square rounded-3xl border border-slate-200 bg-slate-100" />
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="h-8 w-3/4 rounded bg-slate-200" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="h-14 rounded-xl bg-slate-100" />
            <div className="h-14 rounded-xl bg-slate-100" />
            <div className="h-14 rounded-xl bg-slate-100" />
            <div className="h-14 rounded-xl bg-slate-100" />
          </div>
        </div>
        <div className="h-28 rounded-2xl bg-slate-100" />
        <div className="h-12 w-40 rounded-xl bg-slate-200" />
      </div>
      <span className="sr-only">در حال بارگذاری محصول…</span>
    </div>
  );
}
