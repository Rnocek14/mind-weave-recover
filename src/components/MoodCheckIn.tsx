import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MoodCheckInProps {
  onMoodSelect: (mood: number) => void;
  type: 'pre' | 'post';
  isLoading?: boolean;
}

const moods = [
  { value: 1, emoji: '😞', label: 'Very Low', color: 'hover:bg-red-100 hover:border-red-300' },
  { value: 2, emoji: '😕', label: 'Low', color: 'hover:bg-orange-100 hover:border-orange-300' },
  { value: 3, emoji: '😐', label: 'Okay', color: 'hover:bg-yellow-100 hover:border-yellow-300' },
  { value: 4, emoji: '🙂', label: 'Good', color: 'hover:bg-green-100 hover:border-green-300' },
  { value: 5, emoji: '😊', label: 'Great', color: 'hover:bg-blue-100 hover:border-blue-300' }
];

export const MoodCheckIn = ({ onMoodSelect, type, isLoading }: MoodCheckInProps) => {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle>
          {type === 'pre' ? 'How are you feeling today?' : 'How do you feel after this session?'}
        </CardTitle>
        <CardDescription>
          {type === 'pre' 
            ? 'This helps us understand your readiness for practice'
            : 'Track how exercise sessions affect your mood'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-3">
          {moods.map((mood) => (
            <Button
              key={mood.value}
              variant="outline"
              size="lg"
              onClick={() => onMoodSelect(mood.value)}
              disabled={isLoading}
              className={cn(
                "flex flex-col h-auto py-4 gap-2 transition-all",
                mood.color
              )}
            >
              <span className="text-4xl">{mood.emoji}</span>
              <span className="text-xs font-medium">{mood.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
