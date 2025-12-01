export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 bg-slate-700/50 rounded w-32" />
        <div className="h-9 bg-slate-700/50 rounded w-36" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 flex items-center gap-4">
          <div className="w-8 h-8 bg-slate-700/50 rounded-lg" />
          <div className="flex-1">
            <div className="h-4 bg-slate-700/50 rounded w-1/4 mb-2" />
            <div className="h-3 bg-slate-700/50 rounded w-1/2" />
          </div>
          <div className="h-6 bg-slate-700/50 rounded w-16" />
        </div>
      ))}
    </div>
  );
}
