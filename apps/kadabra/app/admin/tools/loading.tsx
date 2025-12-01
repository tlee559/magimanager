export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
        <div className="h-5 bg-slate-700/50 rounded w-1/4 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-800/50 rounded-xl p-5 h-36" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl p-5 h-32" />
        ))}
      </div>
    </div>
  );
}
