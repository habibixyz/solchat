export default function Tabs() {
  return (
    <div className="flex gap-3 text-sm mb-4">

      <button className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800">
        Trending
      </button>

      <button className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800">
        New Pairs
      </button>

      <button className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800">
        Volume
      </button>

    </div>
  );
}
