import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { abbreviateVND } from '../../lib/vnd';

interface DataPoint { date: string; total_value: string; }
interface ProjectionPoint { date: string; projected_total: string; }

interface NetWorthLineProps {
  data: DataPoint[];
  projectionData?: ProjectionPoint[];
  range: '3M' | '6M' | '1Y' | 'all';
  onRangeChange: (r: '3M' | '6M' | '1Y' | 'all') => void;
}

const RANGES = ['3M', '6M', '1Y', 'all'] as const;

export default function NetWorthLine({ data, projectionData, range, onRangeChange }: NetWorthLineProps) {
  // Merge historical + projection into one array for chart
  const chartData = [
    ...data.map(d => ({ date: d.date, value: parseFloat(d.total_value ?? '0'), projected: null as number | null })),
    ...(projectionData ?? []).map(p => ({ date: p.date, value: null as number | null, projected: parseFloat(p.projected_total ?? '0') })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                range === r ? 'bg-green-500 text-black' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
              }`}
            >
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false}
            tickFormatter={d => d.slice(0, 7)} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false}
            tickFormatter={v => abbreviateVND(v)} width={60} />
          <Tooltip
            contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(v: number) => [abbreviateVND(v), '']}
          />
          {projectionData && projectionData.length > 0 && (
            <ReferenceLine x={data[data.length - 1]?.date} stroke="#374151" strokeDasharray="3 3" />
          )}
          <Line dataKey="value" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls={false} />
          <Line dataKey="projected" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
