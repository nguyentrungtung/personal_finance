import { BarChart, Bar, ResponsiveContainer, Cell } from 'recharts';

interface SparklineBarProps {
  data: number[];
  color?: string;
  height?: number;
}

/**
 * Mini bar chart for asset card trend display.
 * No axes, no labels — pure visual sparkline.
 */
export function SparklineBar({ data, color = '#22c55e', height = 40 }: SparklineBarProps) {
  const chartData = data.map((value, index) => ({ value, index }));
  const maxVal = Math.max(...data, 1);
  const lastIndex = data.length - 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={4}>
        <Bar dataKey="value" radius={[1, 1, 0, 0]} isAnimationActive={false}>
          {chartData.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.value > 0 ? color : '#2a2d3a'}
              fillOpacity={index === lastIndex ? 1 : 0.5 + (index / lastIndex) * 0.5}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
