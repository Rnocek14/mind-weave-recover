import {
  Camera, Hand, MessageSquare, Target,
  Lightbulb, Volume2, List, Sparkles, MessageCircle, Link2, Wrench, Search, Shield, type LucideIcon
} from "lucide-react";

export interface Exercise {
  id: string;
  title: string;
  icon: LucideIcon;
  category: string;
  duration: string;
  difficulty: string;
  color: string;
}

export const EXERCISES: Exercise[] = [
  {
    id: "semantic-features",
    title: "Semantic Feature Analysis",
    icon: Lightbulb,
    category: "Language",
    duration: "10-15 min",
    difficulty: "Medium",
    color: "bg-gradient-primary"
  },
  {
    id: "phonological",
    title: "Phonological Awareness",
    icon: Volume2,
    category: "Language",
    duration: "10-15 min",
    difficulty: "Medium",
    color: "bg-gradient-primary"
  },
  {
    id: "sentence-construction",
    title: "Sentence Construction",
    icon: List,
    category: "Language",
    duration: "10-15 min",
    difficulty: "Medium",
    color: "bg-gradient-primary"
  },
  {
    id: "photo-naming",
    title: "Name That Photo",
    icon: Camera,
    category: "Speech",
    duration: "5-7 min",
    difficulty: "Easy",
    color: "bg-gradient-healing"
  },
  {
    id: "reach-tap",
    title: "Reach & Tap",
    icon: Hand,
    category: "Motor",
    duration: "8-10 min",
    difficulty: "Medium",
    color: "bg-gradient-healing"
  },
  {
    id: "phrase-practice",
    title: "Phrase Practice",
    icon: MessageSquare,
    category: "Speech",
    duration: "5-7 min",
    difficulty: "Easy",
    color: "bg-gradient-healing"
  },
  {
    id: "left-side-hunt",
    title: "Left-Side Hunt",
    icon: Target,
    category: "Attention",
    duration: "8-10 min",
    difficulty: "Medium",
    color: "bg-gradient-healing"
  },
  {
    id: "pattern-match",
    title: "Pattern Match",
    icon: Sparkles,
    category: "Attention",
    duration: "5-8 min",
    difficulty: "Medium",
    color: "bg-gradient-primary"
  },
  {
    id: "conversation-partner",
    title: "Free Talk",
    icon: MessageCircle,
    category: "Expression",
    duration: "2-3 min",
    difficulty: "Easy",
    color: "bg-gradient-healing"
  },
  {
    id: "conversation-coach",
    title: "Smart Coach",
    icon: Sparkles,
    category: "Expression",
    duration: "3-5 min",
    difficulty: "Easy",
    color: "bg-gradient-primary"
  },
  {
    id: "two-clues",
    title: "Two Clues",
    icon: Link2,
    category: "Language",
    duration: "5-8 min",
    difficulty: "Easy",
    color: "bg-gradient-healing"
  },
  {
    id: "fix-sentence",
    title: "Fix the Sentence",
    icon: Wrench,
    category: "Language",
    duration: "3-5 min",
    difficulty: "Easy",
    color: "bg-gradient-primary"
  },
  {
    id: "describe-guess",
    title: "Describe & Guess",
    icon: Search,
    category: "Speech",
    duration: "5-8 min",
    difficulty: "Medium",
    color: "bg-gradient-healing"
  },
  {
    id: "detective-mind",
    title: "Detective Mind",
    icon: Shield,
    category: "Comprehension",
    duration: "8-12 min",
    difficulty: "Medium",
    color: "bg-gradient-primary"
  },
  {
    id: "meaning-match",
    title: "Meaning Match",
    icon: Sparkles,
    category: "Comprehension",
    duration: "5-8 min",
    difficulty: "Easy",
    color: "bg-gradient-healing"
  }
];
