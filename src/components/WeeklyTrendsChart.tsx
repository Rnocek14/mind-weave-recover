import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWeeklyTrends } from "@/hooks/useWeeklyTrends";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Clock, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DayDetailsDialog } from "@/components/DayDetailsDialog";
import { useState } from "react";

export function WeeklyTrendsChart() {
  const { trends, loading } = useWeeklyTrends();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weekly Progress Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Check if there's any data
  const hasData = trends.some(t => t.timeMinutes > 0 || t.totalTrials > 0);

  if (!hasData) {
    return null;
  }

  // Calculate week totals
  const weekTotal = trends.reduce((sum, day) => sum + day.timeMinutes, 0);
  const weekAccuracy = trends.reduce((sum, day) => {
    if (day.totalTrials > 0) {
      return sum + day.accuracy;
    }
    return sum;
  }, 0);
  const daysWithActivity = trends.filter(d => d.totalTrials > 0).length;
  const avgAccuracy = daysWithActivity > 0 ? Math.round(weekAccuracy / daysWithActivity) : 0;

  return (
    <>
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weekly Progress Trends
          </CardTitle>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-muted-foreground">Week Total:</span>
              <span className="font-semibold">{weekTotal} min</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-green-600" />
              <span className="text-muted-foreground">Avg Accuracy:</span>
              <span className="font-semibold">{avgAccuracy}%</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            💡 Click on any day to see detailed session breakdown
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart 
              data={trends} 
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              onClick={(data) => {
                if (data && data.activePayload && data.activePayload[0]) {
                  const clickedDate = data.activePayload[0].payload.date;
                  setSelectedDate(clickedDate);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="displayDate" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={{ value: 'Minutes', angle: -90, position: 'insideLeft', fontSize: 12 }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={{ value: 'Accuracy %', angle: 90, position: 'insideRight', fontSize: 12 }}
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px"
                }}
                formatter={(value: number, name: string) => {
                  if (name === "Time Practiced") return [`${value} min`, name];
                  if (name === "Accuracy") return [`${value}%`, name];
                  return [value, name];
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: "12px" }}
                iconType="line"
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="timeMinutes" 
                stroke="#3b82f6"
                strokeWidth={2}
                name="Time Practiced"
                dot={{ fill: "#3b82f6", r: 4, cursor: "pointer" }}
                activeDot={{ r: 6, cursor: "pointer" }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="accuracy" 
                stroke="#16a34a"
                strokeWidth={2}
                name="Accuracy"
                dot={{ fill: "#16a34a", r: 4, cursor: "pointer" }}
                activeDot={{ r: 6, cursor: "pointer" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <DayDetailsDialog 
        date={selectedDate}
        onClose={() => setSelectedDate(null)}
      />
    </>
  );
}
