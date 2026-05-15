import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { abbreviateVND } from '../../lib/vnd';

interface PeriodData {
  date: string;
  metals_vnd: string;
  markets_vnd: string;
  liquidity_vnd: string;
  real_estate_vnd: string;
}

interface AssetGroupedBarProps {
  data: PeriodData[];
}

const BARS = [
  { key: 'metals_vnd', label: 'Metals', color: '#f59e0b' },
  { key: 'markets_vnd', label: 'Markets', color: '#22c55e' },
  { key: 'liquidity_vnd', label: 'Liquidity', color: '#3b82f6' },
  { key: 'real_estate_vnd', label: 'Real Estate', color: '#8b5cf6' },
];

export default function AssetGroupedBar({ data }: AssetGroupedBarProps) {
  const chartData = data.map(d => ({
    date: d.date.slice(0, 7),
    metals: parseFloat(d.metals_vnd ?? '0'),
    markets: parseFloat(d.markets_vnd ?? '0'),
    liquidity: parseFloat(d.liquidity_vnd ?? '0'),
    real_estate: parseFloat(d.real_estate_vnd ?? '0'),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false}
          tickFormatter={v => abbreviateVND(v)} width={60} />
        <Tooltip
          contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => [abbreviateVND(v), '']}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
        {BARS.map(b => (
          <Bar key={b.key} dataKey={b.key.replace('_vnd', '')} name={b.label} fill={b.color} radius={[2, 2, 0, 0]} maxBarSize={20} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
