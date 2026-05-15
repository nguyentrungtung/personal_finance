import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AllocationItem {
  code: string;
  label: string;
  pct: number;
}

interface AllocationDonutProps {
  data: AllocationItem[];
}

const COLORS: Record<string, string> = {
  metals: '#f59e0b',
  markets: '#22c55e',
  liquidity: '#3b82f6',
  real_estate: '#a855f7',
};

const DEFAULT_COLOR = '#64748b';

/**
 * Donut chart showing portfolio allocation by asset class.
 * Hides 0% slices; values always sum to 100%.
 */
export function AllocationDonut({ data }: AllocationDonutProps) {
  const visible = data.filter((d) => d.pct > 0);

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        No allocation data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={visible}
          dataKey="pct"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          isAnimationActive={false}
        >
          {visible.map((entry) => (
            <Cell
              key={entry.code}
              fill={COLORS[entry.code] ?? DEFAULT_COLOR}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
          contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', color: '#f1f5f9', fontSize: 12 }}
        />
        <Legend
          formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
