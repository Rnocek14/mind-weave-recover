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
  },
  {
    id: "minimal-pairs",
    title: "Minimal Pairs",
    icon: Volume2,
    category: "Language",
    duration: "5-8 min",
    difficulty: "Medium",
    color: "bg-gradient-primary"
  },
  {
    id: "narrative-retell",
    title: "Narrative Retell",
    icon: MessageSquare,
    category: "Speech",
    duration: "8-12 min",
    difficulty: "Hard",
    color: "bg-gradient-healing"
  },
  {
    id: "abstract-compare",
    title: "Abstract Compare",
    icon: Lightbulb,
    category: "Cognition",
    duration: "8-12 min",
    difficulty: "Hard",
    color: "bg-gradient-primary"
  },
  {
    id: "multi-step-plan",
    title: "Multi-Step Planning",
    icon: List,
    category: "Cognition",
    duration: "8-10 min",
    difficulty: "Medium",
    color: "bg-gradient-healing"
  },
  {
    id: "dual-load-naming",
    title: "Dual-Load Naming",
    icon: Target,
    category: "Speech",
    duration: "5-8 min",
    difficulty: "Hard",
    color: "bg-gradient-primary"
  },
  {
    id: "thought-continuation",
    title: "Thought Continuation",
    icon: MessageCircle,
    category: "Expression",
    duration: "3-5 min",
    difficulty: "Easy",
    color: "bg-gradient-healing"
  },
  {
    id: "phonological-awareness",
    title: "Phonological Awareness",
    icon: Volume2,
    category: "Language",
    duration: "5-8 min",
    difficulty: "Medium",
    color: "bg-gradient-primary"
  },
  {
    id: "word-finding",
    title: "Word Finding",
    icon: Search,
    category: "Speech",
    duration: "5-8 min",
    difficulty: "Medium",
    color: "bg-gradient-healing"
  },
  {
    id: "sentence-game",
    title: "Sentence Game",
    icon: List,
    category: "Language",
    duration: "5-8 min",
    difficulty: "Medium",
    color: "bg-gradient-primary"
  },
  {
    id: "thought-organization",
    title: "Thought Organization",
    icon: Lightbulb,
    category: "Expression",
    duration: "5-8 min",
    difficulty: "Medium",
    color: "bg-gradient-healing"
  },
];
