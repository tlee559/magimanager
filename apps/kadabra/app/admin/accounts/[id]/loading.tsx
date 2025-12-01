export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
        <div className="h-6 bg-slate-700/50 rounded w-1/4 mb-4" />
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-800/50 rounded-lg p-3">
              <div className="h-3 bg-slate-700/50 rounded w-1/2 mb-2" />
              <div className="h-5 bg-slate-700/50 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 h-96" />
    </div>
  );
}
