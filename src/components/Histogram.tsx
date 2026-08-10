export default function Histogram({ data }: { data: { bucket: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d) => (
        <div key={d.bucket} className="flex-1 flex flex-col items-center justify-end h-full">
          <div className="text-xs text-slate-600 mb-1">{d.count}</div>
          <div
            className="w-full rounded-t bg-indigo-500"
            style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 3 : 0 }}
          />
          <div className="text-[11px] text-slate-500 mt-1 text-center">{d.bucket}</div>
        </div>
      ))}
    </div>
  )
}
