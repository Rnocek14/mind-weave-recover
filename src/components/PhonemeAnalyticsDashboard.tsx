import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  TrendingUp,
  AlertCircle,
  BarChart3,
  LineChart as LineChartIcon
} from "lucide-react";
import { usePhonemeAnalytics } from "@/hooks/usePhonemeAnalytics";
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
  PieChart,
  Pie,
  Cell
} from "recharts";
import { toast } from "sonner";

interface PhonemeAnalyticsDashboardProps {
  userId: string | undefined;
}

export const PhonemeAnalyticsDashboard = ({
  userId
}: PhonemeAnalyticsDashboardProps) => {
  const { analytics, loading, error } = usePhonemeAnalytics(userId);

  const exportToPDF = () => {
    toast.info("PDF export coming soon", {
      description: "This feature will generate a detailed clinician report"
    });
  };

  const exportToCSV = () => {
    if (!analytics) return;

    // Prepare CSV data
    const csvData = [
      ["Phoneme Error Analytics Report"],
      [`Generated: ${new Date().toLocaleString()}`],
      [""],
      ["Overall Metrics"],
      [`Overall Accuracy: ${analytics.overallAccuracy}%`],
      [`Total Sessions: ${analytics.totalSessions}`],
      [`Weakest Position: ${analytics.weakestPosition || "N/A"}`],
      [""],
      ["Most Common Error Pairs"],
      ["From", "To", "Count", "Percentage"],
      ...analytics.mostCommonErrors.map((pair) => [
        pair.from,
        pair.to,
        pair.count.toString(),
        `${pair.percentage}%`
      ]),
      [""],
      ["Position Error Distribution"],
      ["Position", "Error Count"],
      ["Onset", analytics.positionErrors.onset.toString()],
      ["Nucleus", analytics.positionErrors.nucleus.toString()],
      ["Coda", analytics.positionErrors.coda.toString()],
      [""],
      ["Session Trends"],
      ["Date", "Accuracy (%)", "Error Count", "Total Trials"],
      ...analytics.sessionTrends.map((trend) => [
        new Date(trend.date).toLocaleDateString(),
        trend.accuracy.toString(),
        trend.errorCount.toString(),
        trend.totalTrials.toString()
      ])
    ];

    const csvContent = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `phoneme-analytics-${new Date().toISOString().split("T")[0]}.csv`;
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
          <BarChart3 className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No Data Yet</h3>
        <p className="text-muted-foreground mb-4">
          Complete some phonological awareness sessions to see your analytics
        </p>
        <Button onClick={() => window.location.href = "/exercise/phonological-awareness"}>
          Start Training
        </Button>
      </Card>
    );
  }

  const COLORS = ["#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4"];

  const positionData = [
    { name: "Onset", value: analytics.positionErrors.onset, fill: COLORS[0] },
    { name: "Nucleus", value: analytics.positionErrors.nucleus, fill: COLORS[1] },
    { name: "Coda", value: analytics.positionErrors.coda, fill: COLORS[2] }
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">Phoneme Error Analytics</h2>
          <p className="text-muted-foreground">
            Detailed analysis of phonological patterns and progress
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
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
              <p className="text-2xl font-bold">{analytics.positionErrors.total}</p>
              <p className="text-sm text-muted-foreground">Total Errors</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xl font-bold capitalize">
                {analytics.weakestPosition || "N/A"}
              </p>
              <p className="text-sm text-muted-foreground">Weakest Position</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Most Common Error Pairs */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Most Common Phoneme Confusions
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.mostCommonErrors}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="from"
                label={{ value: "Phoneme Pair", position: "insideBottom", offset: -5 }}
              />
              <YAxis label={{ value: "Error Count", angle: -90, position: "insideLeft" }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
                        <p className="font-semibold">
                          {data.from} → {data.to}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Errors: {data.count} ({data.percentage}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Position Error Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Error Distribution by Position
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={positionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {positionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#8b5cf6]" />
                <span>Onset errors</span>
              </div>
              <Badge variant="outline">{analytics.positionErrors.onset}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#6366f1]" />
                <span>Nucleus errors</span>
              </div>
              <Badge variant="outline">{analytics.positionErrors.nucleus}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
                <span>Coda errors</span>
              </div>
              <Badge variant="outline">{analytics.positionErrors.coda}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Longitudinal Trends */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Accuracy Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.sessionTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => new Date(date).toLocaleDateString()}
            />
            <YAxis
              domain={[0, 100]}
              label={{ value: "Accuracy (%)", angle: -90, position: "insideLeft" }}
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
                      <p className="text-sm text-muted-foreground">
                        Errors: {data.errorCount} / {data.totalTrials}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="accuracy"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Accuracy (%)"
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Detailed Error Pairs Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">All Phoneme Confusions</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">From</th>
                <th className="text-left py-3 px-4">To</th>
                <th className="text-right py-3 px-4">Count</th>
                <th className="text-right py-3 px-4">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {analytics.errorPairs.map((pair, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4">
                    <Badge variant="outline">{pair.from}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline">{pair.to}</Badge>
                  </td>
                  <td className="text-right py-3 px-4 font-medium">
                    {pair.count}
                  </td>
                  <td className="text-right py-3 px-4">
                    <Badge>{pair.percentage}%</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
