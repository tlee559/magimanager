export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
            <div className="h-4 bg-slate-700/50 rounded w-1/3 mb-3" />
            <div className="h-8 bg-slate-700/50 rounded w-1/2 mb-2" />
            <div className="h-3 bg-slate-700/50 rounded w-2/3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl border border-slate-700/50 h-48" />
        ))}
      </div>
    </div>
  );
}
