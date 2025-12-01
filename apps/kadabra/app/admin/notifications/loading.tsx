export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 flex items-start gap-4">
          <div className="w-10 h-10 bg-slate-700/50 rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-slate-700/50 rounded w-1/3 mb-2" />
            <div className="h-3 bg-slate-700/50 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
