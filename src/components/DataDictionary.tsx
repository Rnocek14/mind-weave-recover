import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen } from 'lucide-react';

export const DataDictionary = () => {
  const tables = {
    demographics: [
      { field: 'participant_id', type: 'string', description: 'De-identified participant identifier (hashed user_id)' },
      { field: 'stroke_date', type: 'date', description: 'Date of stroke event (YYYY-MM-DD)' },
      { field: 'account_created', type: 'timestamp', description: 'Account creation timestamp' },
      { field: 'stroke_mechanism', type: 'string', description: 'Ischemic, hemorrhagic, or other' },
      { field: 'stroke_location', type: 'string', description: 'Brain lesion location(s), semicolon-separated if multiple' },
      { field: 'affected_side', type: 'string', description: 'Left, right, or bilateral' },
      { field: 'chronicity', type: 'string', description: 'Acute (<1 week), subacute (1 week-6 months), or chronic (>6 months)' },
      { field: 'severity_motor', type: 'string', description: 'Motor impairment severity: none, mild, moderate, severe' },
      { field: 'severity_speech', type: 'string', description: 'Speech impairment severity: none, mild, moderate, severe' },
      { field: 'severity_cognitive', type: 'string', description: 'Cognitive impairment severity: none, mild, moderate, severe' },
    ],
    sessions: [
      { field: 'record_id', type: 'string', description: 'De-identified session identifier (hashed session id)' },
      { field: 'participant_id', type: 'string', description: 'Links to demographics.participant_id' },
      { field: 'started_at', type: 'timestamp', description: 'Session start timestamp' },
      { field: 'ended_at', type: 'timestamp', description: 'Session end timestamp' },
      { field: 'duration_sec', type: 'integer', description: 'Session duration in seconds' },
      { field: 'summary', type: 'json', description: 'Session summary metrics (accuracy, RT, cue levels, errors)' },
      { field: 'mood_rating', type: 'integer', description: 'Pre-session mood rating (1-5 scale)' },
    ],
    exercise_trials: [
      { field: 'record_id', type: 'string', description: 'De-identified trial identifier' },
      { field: 'session_hash', type: 'string', description: 'Links to sessions.record_id' },
      { field: 'exercise_slug', type: 'string', description: 'Exercise type identifier (e.g., photo-naming, phonological)' },
      { field: 'round', type: 'integer', description: 'Trial number within session' },
      { field: 'score', type: 'integer', description: 'Trial score (1=correct, 0=incorrect)' },
      { field: 'reaction_time_ms', type: 'integer', description: 'Response latency in milliseconds' },
      { field: 'cue_level', type: 'integer', description: 'Cue intensity provided (0=none, 1-3=increasing support)' },
      { field: 'error_type', type: 'string', description: 'Error classification: semantic_related, phonological, unrelated, timeout' },
      { field: 'created_at', type: 'timestamp', description: 'Trial completion timestamp' },
    ],
    learning_rates: [
      { field: 'record_id', type: 'string', description: 'De-identified learning rate record' },
      { field: 'participant_id', type: 'string', description: 'Links to demographics.participant_id' },
      { field: 'domain', type: 'string', description: 'Cognitive domain (naming, phonological, semantic, sentence)' },
      { field: 'time_window_days', type: 'integer', description: 'Analysis window (7, 14, 30 days)' },
      { field: 'accuracy_slope', type: 'numeric', description: 'Daily accuracy change (linear regression slope)' },
      { field: 'rt_slope', type: 'numeric', description: 'Daily reaction time change (ms/day, negative=faster)' },
      { field: 'trial_count', type: 'integer', description: 'Total trials in analysis window' },
      { field: 'start_accuracy', type: 'numeric', description: 'Baseline accuracy at window start (0-1)' },
      { field: 'end_accuracy', type: 'numeric', description: 'Final accuracy at window end (0-1)' },
      { field: 'confidence_score', type: 'numeric', description: 'Reliability score (0-1, based on trial count and window coverage)' },
      { field: 'start_date', type: 'date', description: 'Analysis window start date' },
      { field: 'end_date', type: 'date', description: 'Analysis window end date' },
    ],
    functional_goals: [
      { field: 'record_id', type: 'string', description: 'De-identified goal identifier' },
      { field: 'participant_id', type: 'string', description: 'Links to demographics.participant_id' },
      { field: 'goal_text', type: 'string', description: 'Natural language goal description (PII may be present - review before sharing)' },
      { field: 'target_domain', type: 'string', description: 'Target domain: naming, comprehension, sentence, conversation' },
      { field: 'baseline_status', type: 'string', description: 'Initial status: not_yet, partial, achieved' },
      { field: 'target_date', type: 'date', description: 'Target achievement date' },
      { field: 'created_at', type: 'timestamp', description: 'Goal creation timestamp' },
      { field: 'archived_at', type: 'timestamp', description: 'Archival timestamp (NULL if active)' },
    ],
    goal_progress_ratings: [
      { field: 'record_id', type: 'string', description: 'De-identified rating identifier' },
      { field: 'goal_hash', type: 'string', description: 'Links to functional_goals.record_id' },
      { field: 'status', type: 'string', description: 'Progress status: not_yet, partial, achieved' },
      { field: 'confidence_level', type: 'integer', description: 'Rater confidence (1-5 scale)' },
      { field: 'notes', type: 'string', description: 'Free-text notes (may contain PII)' },
      { field: 'rated_at', type: 'timestamp', description: 'Rating timestamp' },
    ],
    standardized_assessments: [
      { field: 'record_id', type: 'string', description: 'De-identified assessment identifier' },
      { field: 'participant_id', type: 'string', description: 'Links to demographics.participant_id' },
      { field: 'assessment_type', type: 'string', description: 'WAB-R, BNT, NIHSS, or ASHA-NOMS' },
      { field: 'assessment_date', type: 'date', description: 'Assessment administration date' },
      { field: 'scores', type: 'json', description: 'Assessment subscale and total scores (structure varies by type)' },
      { field: 'notes', type: 'string', description: 'Clinical notes (may contain PII)' },
      { field: 'created_at', type: 'timestamp', description: 'Record creation timestamp' },
    ],
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Data Dictionary
        </CardTitle>
        <CardDescription>
          Complete field definitions for all exported datasets
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="demographics">
          <TabsList className="grid grid-cols-4 lg:grid-cols-7 w-full">
            <TabsTrigger value="demographics">Demographics</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="exercise_trials">Trials</TabsTrigger>
            <TabsTrigger value="learning_rates">Learning</TabsTrigger>
            <TabsTrigger value="functional_goals">Goals</TabsTrigger>
            <TabsTrigger value="goal_progress_ratings">Ratings</TabsTrigger>
            <TabsTrigger value="standardized_assessments">Assessments</TabsTrigger>
          </TabsList>

          {Object.entries(tables).map(([key, fields]) => (
            <TabsContent key={key} value={key} className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Field</TableHead>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field) => (
                      <TableRow key={field.field}>
                        <TableCell className="font-mono text-sm">{field.field}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{field.type}</TableCell>
                        <TableCell className="text-sm">{field.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-6 p-4 bg-muted rounded-lg space-y-2 text-sm">
          <p className="font-medium">Important Notes:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>All user IDs are hashed to de-identify participants while preserving linkage across tables</li>
            <li>Free-text fields (goal_text, notes) may contain PII and should be manually reviewed before external sharing</li>
            <li>Timestamps are in ISO 8601 format with timezone information</li>
            <li>JSON fields contain nested objects - structure varies by assessment type or session summary</li>
            <li>NULL values indicate missing or not-applicable data</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
