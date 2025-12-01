export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="grid grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 h-32" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl border border-slate-700/50 h-64" />
        ))}
      </div>
    </div>
  );
}
