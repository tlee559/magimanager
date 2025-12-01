export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 bg-slate-700/50 rounded w-40" />
        <div className="flex gap-2">
          <div className="h-10 bg-slate-700/50 rounded w-24" />
          <div className="h-10 bg-slate-700/50 rounded w-32" />
        </div>
      </div>
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
        <div className="p-4 border-b border-slate-700/50">
          <div className="h-4 bg-slate-700/50 rounded w-64" />
        </div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-4">
            <div className="w-3 h-3 bg-slate-700/50 rounded-full" />
            <div className="flex-1">
              <div className="h-4 bg-slate-700/50 rounded w-24 mb-1" />
              <div className="h-3 bg-slate-700/50 rounded w-32" />
            </div>
            <div className="h-5 bg-slate-700/50 rounded w-20" />
            <div className="h-5 bg-slate-700/50 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
