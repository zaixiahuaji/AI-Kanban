'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface TrendItem { date: string; count: number }
interface TrendChartProps {
  registrationTrend: TrendItem[]
  taskCreationTrend: TrendItem[]
  registrationLabel: string
  taskLabel: string
}

export function TrendChart({ registrationTrend, taskCreationTrend, registrationLabel, taskLabel }: TrendChartProps) {
  const dateMap = new Map<string, { date: string; registration?: number; tasks?: number }>()
  for (const item of registrationTrend) {
    dateMap.set(item.date, { ...dateMap.get(item.date), date: item.date, registration: item.count })
  }
  for (const item of taskCreationTrend) {
    dateMap.set(item.date, { ...dateMap.get(item.date), date: item.date, tasks: item.count })
  }
  const chartData = Array.from(dateMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      date: item.date.slice(5),
      [registrationLabel]: item.registration ?? 0,
      [taskLabel]: item.tasks ?? 0,
    }))

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={registrationLabel} stroke="#6366f1" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey={taskLabel} stroke="#10b981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
