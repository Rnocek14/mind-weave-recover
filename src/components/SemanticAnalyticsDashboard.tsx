import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  TrendingUp,
  AlertCircle,
  BarChart3,
  Lightbulb
} from "lucide-react";
import { useSemanticAnalytics } from "@/hooks/useSemanticAnalytics";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import { toast } from "sonner";

interface SemanticAnalyticsDashboardProps {
  userId: string | undefined;
}

export const SemanticAnalyticsDashboard = ({
  userId
}: SemanticAnalyticsDashboardProps) => {
  const { analytics, loading, error } = useSemanticAnalytics(userId);

  const exportToCSV = () => {
    if (!analytics) return;

    const csvData = [
      ["Semantic Feature Analysis Report"],
      [`Generated: ${new Date().toLocaleString()}`],
      [""],
      ["Overall Metrics"],
      [`Overall Accuracy: ${analytics.overallAccuracy}%`],
      [`Total Sessions: ${analytics.totalSessions}`],
      [`Weakest Category: ${analytics.weakestCategory || "N/A"}`],
      [`Hardest Abstractness Level: ${analytics.hardestAbstractnessLevel || "N/A"}`],
      [""],
      ["Category Performance"],
      ["Category", "Correct", "Total", "Accuracy (%)"],
      ...analytics.categoryPerformance.map((cat) => [
        cat.category,
        cat.correct.toString(),
        cat.total.toString(),
        cat.accuracy.toString()
      ]),
      [""],
      ["Abstractness Difficulty"],
      ["Level", "Correct", "Total", "Accuracy (%)", "Avg RT (ms)"],
      ...analytics.abstractnessLevels.map((level) => [
        level.level.toString(),
        level.correct.toString(),
        level.total.toString(),
        level.accuracy.toString(),
        level.avgReactionTime.toString()
      ]),
      [""],
      ["Distractor Effectiveness"],
      ["Type", "Effectiveness (%)", "Count"],
      ...analytics.distractorAnalysis.map((dist) => [
        dist.type,
        dist.effectiveness.toString(),
        dist.count.toString()
      ]),
      [""],
      ["Session Trends"],
      ["Date", "Accuracy (%)", "Avg Abstractness"],
      ...analytics.sessionTrends.map((trend) => [
        new Date(trend.date).toLocaleDateString(),
        trend.accuracy.toString(),
        trend.avgAbstractness.toFixed(2)
      ])
    ];

    const csvContent = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `semantic-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Report exported", {
      description: "CSV file downloaded successfully"
    });
  };

  if (loading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <p>Error loading analytics: {error}</p>
        </div>
      </Card>
    );
  }

  if (!analytics || analytics.totalSessions === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <Lightbulb className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No Data Yet</h3>
        <p className="text-muted-foreground mb-4">
          Complete some semantic feature sessions to see your analytics
        </p>
        <Button onClick={() => (window.location.href = "/exercise/semantic-features")}>
          Start Training
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">Semantic Feature Analytics</h2>
          <p className="text-muted-foreground">
            Category performance, abstractness analysis, and distractor effectiveness
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.overallAccuracy}%</p>
              <p className="text-sm text-muted-foreground">Overall Accuracy</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.totalSessions}</p>
              <p className="text-sm text-muted-foreground">Total Sessions</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-lg font-bold capitalize">
                {analytics.weakestCategory || "N/A"}
              </p>
              <p className="text-sm text-muted-foreground">Weakest Category</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                Level {analytics.hardestAbstractnessLevel || "N/A"}
              </p>
              <p className="text-sm text-muted-foreground">Hardest Abstract</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Category Performance */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Category Performance</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={analytics.categoryPerformance}
              layout="vertical"
              margin={{ left: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="category" />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
                        <p className="font-semibold capitalize">{data.category}</p>
                        <p className="text-sm">Accuracy: {data.accuracy}%</p>
                        <p className="text-sm text-muted-foreground">
                          {data.correct} / {data.total} correct
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="accuracy" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Abstractness Difficulty */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Abstractness Level Difficulty
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={analytics.abstractnessLevels}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="level"
                label={{ value: "Abstractness Level", position: "insideBottom", offset: -5 }}
              />
              <YAxis
                label={{ value: "Accuracy (%)", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
                        <p className="font-semibold">Level {data.level}</p>
                        <p className="text-sm">Accuracy: {data.accuracy}%</p>
                        <p className="text-sm">Avg RT: {data.avgReactionTime}ms</p>
                        <p className="text-sm text-muted-foreground">
                          {data.correct} / {data.total} trials
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Distractor Effectiveness */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Distractor Effectiveness
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.distractorAnalysis}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis label={{ value: "% Fooled", angle: -90, position: "insideLeft" }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
                        <p className="font-semibold capitalize">{data.type}</p>
                        <p className="text-sm">Effectiveness: {data.effectiveness}%</p>
                        <p className="text-sm text-muted-foreground">
                          Used {data.count} times
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="effectiveness" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-sm text-muted-foreground mt-3">
            Higher percentage means more effective at fooling users
          </p>
        </Card>

        {/* Category Radar */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Category Strength Profile</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={analytics.categoryPerformance.slice(0, 6)}>
              <PolarGrid />
              <PolarAngleAxis dataKey="category" />
              <PolarRadiusAxis domain={[0, 100]} />
              <Radar
                name="Accuracy"
                dataKey="accuracy"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.5}
              />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Longitudinal Trends */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.sessionTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => new Date(date).toLocaleDateString()}
            />
            <YAxis
              yAxisId="left"
              domain={[0, 100]}
              label={{ value: "Accuracy (%)", angle: -90, position: "insideLeft" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 5]}
              label={{
                value: "Avg Abstractness",
                angle: 90,
                position: "insideRight"
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
                      <p className="font-semibold">
                        {new Date(data.date).toLocaleDateString()}
                      </p>
                      <p className="text-sm">Accuracy: {data.accuracy}%</p>
                      <p className="text-sm">
                        Avg Abstractness: {data.avgAbstractness.toFixed(2)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="accuracy"
              stroke="#8b5cf6"
              strokeWidth={2}
              name="Accuracy (%)"
              dot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgAbstractness"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Avg Abstractness"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Detailed Tables */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Category Details */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Category Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-2">Category</th>
                  <th className="text-right py-3 px-2">Trials</th>
                  <th className="text-right py-3 px-2">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {analytics.categoryPerformance.map((cat, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2 capitalize">{cat.category}</td>
                    <td className="text-right py-3 px-2">
                      {cat.correct}/{cat.total}
                    </td>
                    <td className="text-right py-3 px-2">
                      <Badge
                        variant={
                          cat.accuracy >= 80
                            ? "default"
                            : cat.accuracy >= 60
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {cat.accuracy}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Abstractness Details */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Abstractness Levels</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-2">Level</th>
                  <th className="text-right py-3 px-2">Accuracy</th>
                  <th className="text-right py-3 px-2">Avg RT</th>
                </tr>
              </thead>
              <tbody>
                {analytics.abstractnessLevels.map((level, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2">Level {level.level}</td>
                    <td className="text-right py-3 px-2">
                      <Badge
                        variant={
                          level.accuracy >= 80
                            ? "default"
                            : level.accuracy >= 60
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {level.accuracy}%
                      </Badge>
                    </td>
                    <td className="text-right py-3 px-2">
                      {level.avgReactionTime}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};
