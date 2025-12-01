export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto animate-pulse">
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-start gap-6 mb-6">
          <div className="w-24 h-24 bg-slate-700/50 rounded-xl" />
          <div className="flex-1">
            <div className="h-6 bg-slate-700/50 rounded w-1/3 mb-3" />
            <div className="h-4 bg-slate-700/50 rounded w-1/2 mb-2" />
            <div className="h-4 bg-slate-700/50 rounded w-1/4" />
          </div>
          <div className="h-10 bg-slate-700/50 rounded w-24" />
        </div>
        <div className="grid grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-800/30 rounded-lg p-4">
              <div className="h-3 bg-slate-700/50 rounded w-1/4 mb-2" />
              <div className="h-5 bg-slate-700/50 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
