/**
 * Insights CTA Card - Dashboard link to /insights
 * 
 * Replaces the Analytics tab with a single focused CTA
 */

import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, ArrowRight, Brain, Target, Lightbulb } from "lucide-react";

export function InsightsCTACard() {
  return (
    <Card className="border-2 border-dashed hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Your Progress & Insights</CardTitle>
            <CardDescription>
              Understand how your recovery is progressing
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick preview items */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <Brain className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Progress</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <Target className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Challenges</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <Lightbulb className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">What Helps</p>
          </div>
        </div>

        <Button asChild className="w-full gap-2">
          <Link to="/insights">
            See your progress & insights
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
