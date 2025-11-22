import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Brain, Camera, Activity, Award, Heart, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-calm">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-glow rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Recovery</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
            Your Journey to
            <span className="block bg-gradient-healing [-webkit-background-clip:text] [background-clip:text] [-webkit-text-fill-color:transparent] [color:transparent]">
              Recovery Starts Here
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Personalized stroke rehabilitation that adapts to you. Rebuild motor skills, 
            speech, and confidence through engaging, AI-guided therapy—from the comfort of home.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              className="text-lg px-8 py-6 bg-gradient-healing hover:opacity-90 shadow-glow transition-smooth"
              onClick={() => navigate("/auth")}
            >
              <Brain className="w-5 h-5 mr-2" />
              Start Your Journey
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 py-6 border-2 border-primary hover:bg-primary-glow"
              onClick={() => navigate("/caregiver")}
            >
              <Heart className="w-5 h-5 mr-2" />
              Caregiver Access
            </Button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-20 max-w-5xl mx-auto">
          <Card className="p-6 text-center space-y-4 shadow-card hover:shadow-glow transition-smooth cursor-pointer border-2 hover:border-primary">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-healing flex items-center justify-center">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold">Motor Recovery</h3>
            <p className="text-muted-foreground">
              Rebuild strength and coordination through adaptive exercises that track your progress
            </p>
          </Card>

          <Card className="p-6 text-center space-y-4 shadow-card hover:shadow-glow transition-smooth cursor-pointer border-2 hover:border-primary">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-healing flex items-center justify-center">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold">Speech Therapy</h3>
            <p className="text-muted-foreground">
              Practice naming objects with personalized photos from your own life
            </p>
          </Card>

          <Card className="p-6 text-center space-y-4 shadow-card hover:shadow-glow transition-smooth cursor-pointer border-2 hover:border-primary">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-healing flex items-center justify-center">
              <Award className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold">Track Progress</h3>
            <p className="text-muted-foreground">
              Celebrate every win with streaks, achievements, and detailed progress reports
            </p>
          </Card>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20 max-w-4xl mx-auto">
          {[
            { value: "2x", label: "More Therapy Time" },
            { value: "85%", label: "User Engagement" },
            { value: "24/7", label: "Available Access" },
            { value: "AI", label: "Adaptive Learning" },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-4xl font-bold bg-gradient-healing bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
