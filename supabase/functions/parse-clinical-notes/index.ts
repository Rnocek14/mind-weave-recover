import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rule-based extraction dictionaries
const IMPAIRMENT_KEYWORDS = {
  motor: [
    'weakness', 'hemiparesis', 'hemiplegia', 'paralysis', 'ataxia',
    'spasticity', 'pronator drift', 'strength', 'motor', 'paresis'
  ],
  speech: [
    'aphasia', 'dysarthria', 'anomia', 'word-finding', 'speech',
    'expressive', 'receptive', 'fluent', 'nonfluent', 'language'
  ],
  cognitive: [
    'slow processing', 'memory', 'confusion', 'attention', 'executive',
    'planning', 'cognitive', 'dementia', 'orientation', 'recall'
  ],
  visual: [
    'neglect', 'field cut', 'hemianopia', 'visual', 'inattention',
    'extinction', 'quadrantanopia'
  ]
};

const SIDE_PATTERNS = /(left|right|bilateral)\s+(arm|hand|leg|foot|side)/gi;
const STROKE_LOCATION_PATTERNS = /(left|right)\s+(MCA|ACA|PCA|frontal|parietal|temporal|occipital|cerebellum|brainstem)/gi;
const GOAL_PATTERNS = /(goal|wants to|aim to|focus on|improve|regain|work on)[\s:]+([^.]+)/gi;

function extractRuleBased(text: string) {
  const normalizedText = text.toLowerCase();
  const profile: any = {
    impairments: { motor: [], speech: [], cognitive: [], visual: [] },
    stroke_location: null,
    affected_side: null,
    therapy_focus: [],
    source_phrases: {}
  };

  // Extract impairments
  for (const [category, keywords] of Object.entries(IMPAIRMENT_KEYWORDS)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches && matches.length > 0) {
        // Check for negation
        const contextRegex = new RegExp(`(no|without|denies|absent)\\s+\\w*\\s*${keyword}`, 'gi');
        if (!contextRegex.test(text)) {
          const impairment = keyword.replace(/\s+/g, '_');
          if (!profile.impairments[category].includes(impairment)) {
            profile.impairments[category].push(impairment);
            // Store source phrase
            const sentenceMatch = text.match(new RegExp(`[^.!?]*${keyword}[^.!?]*[.!?]`, 'i'));
            if (sentenceMatch) {
              if (!profile.source_phrases[category]) profile.source_phrases[category] = [];
              profile.source_phrases[category].push(sentenceMatch[0].trim());
            }
          }
        }
      }
    }
  }

  // Extract side information
  const sideMatches = text.match(SIDE_PATTERNS);
  if (sideMatches && sideMatches.length > 0) {
    const firstMatch = sideMatches[0].toLowerCase();
    if (firstMatch.includes('left')) profile.affected_side = 'left';
    else if (firstMatch.includes('right')) profile.affected_side = 'right';
    else if (firstMatch.includes('bilateral')) profile.affected_side = 'bilateral';
    profile.source_phrases.affected_side = firstMatch;
  }

  // Extract stroke location
  const locationMatches = text.match(STROKE_LOCATION_PATTERNS);
  if (locationMatches && locationMatches.length > 0) {
    profile.stroke_location = locationMatches[0].toLowerCase().replace(/\s+/g, '_');
    profile.source_phrases.stroke_location = locationMatches[0];
  }

  // Extract therapy goals
  const goalMatches = [...text.matchAll(GOAL_PATTERNS)];
  for (const match of goalMatches) {
    const goal = match[2].trim().toLowerCase().replace(/\s+/g, '_');
    profile.therapy_focus.push(goal);
    if (!profile.source_phrases.therapy_focus) profile.source_phrases.therapy_focus = [];
    profile.source_phrases.therapy_focus.push(match[0]);
  }

  return profile;
}

async function enhanceWithLLM(text: string, ruleBasedProfile: any) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY) {
    console.log('OpenAI API key not found, returning rule-based profile only');
    return ruleBasedProfile;
  }

  try {
    const prompt = `You are a clinical NLP assistant. Extract stroke rehabilitation profile from this clinical note.
Only extract information explicitly stated in the note. Do not infer or add information.

Clinical Note:
${text}

Current rule-based extraction:
${JSON.stringify(ruleBasedProfile, null, 2)}

Please review and enhance the extraction. Output ONLY valid JSON with this exact structure:
{
  "impairments": {
    "motor": ["specific_impairment"],
    "speech": ["specific_impairment"],
    "cognitive": ["specific_impairment"],
    "visual": ["specific_impairment"]
  },
  "stroke_location": "location or null",
  "affected_side": "left/right/bilateral or null",
  "therapy_focus": ["specific_goal"],
  "confidence": "high/medium/low"
}

Only include impairments that are clearly present. Ignore negated findings (e.g., "no neglect").`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a clinical NLP assistant specializing in stroke rehabilitation. Output only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, await response.text());
      return ruleBasedProfile;
    }

    const data = await response.json();
    const llmText = data.choices[0].message.content.trim();
    
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = llmText.match(/```json\n?([\s\S]*?)\n?```/) || llmText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in LLM response');
      return ruleBasedProfile;
    }
    
    const llmProfile = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    
    // Merge rule-based and LLM results, preserving source phrases
    return {
      impairments: {
        motor: [...new Set([...ruleBasedProfile.impairments.motor, ...llmProfile.impairments.motor])],
        speech: [...new Set([...ruleBasedProfile.impairments.speech, ...llmProfile.impairments.speech])],
        cognitive: [...new Set([...ruleBasedProfile.impairments.cognitive, ...llmProfile.impairments.cognitive])],
        visual: [...new Set([...ruleBasedProfile.impairments.visual, ...llmProfile.impairments.visual])]
      },
      stroke_location: llmProfile.stroke_location || ruleBasedProfile.stroke_location,
      affected_side: llmProfile.affected_side || ruleBasedProfile.affected_side,
      therapy_focus: [...new Set([...ruleBasedProfile.therapy_focus, ...llmProfile.therapy_focus])],
      source_phrases: ruleBasedProfile.source_phrases,
      confidence: llmProfile.confidence || 'medium',
      profile_source: 'hybrid'
    };
  } catch (error) {
    console.error('LLM enhancement error:', error);
    return ruleBasedProfile;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clinicalNote } = await req.json();
    
    if (!clinicalNote || typeof clinicalNote !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Clinical note text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing clinical note, length:', clinicalNote.length);

    // Phase 1: Rule-based extraction
    const ruleBasedProfile = extractRuleBased(clinicalNote);
    console.log('Rule-based profile:', JSON.stringify(ruleBasedProfile, null, 2));

    // Phase 2: LLM enhancement
    const enhancedProfile = await enhanceWithLLM(clinicalNote, ruleBasedProfile);
    console.log('Enhanced profile:', JSON.stringify(enhancedProfile, null, 2));

    // Add metadata
    const finalProfile = {
      ...enhancedProfile,
      notes: clinicalNote,
      last_updated: new Date().toISOString()
    };

    return new Response(
      JSON.stringify({ profile: finalProfile }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error parsing clinical note:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});