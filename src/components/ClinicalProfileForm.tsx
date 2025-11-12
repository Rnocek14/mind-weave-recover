import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClinicalProfile } from '@/lib/clinicalProfileMapper';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ClinicalNoteParser from './ClinicalNoteParser';

interface ClinicalProfileFormProps {
  initialProfile?: ClinicalProfile;
  onSubmit: (profile: ClinicalProfile) => void;
  onCancel?: () => void;
}

const MOTOR_OPTIONS = [
  'left_arm_weakness', 'right_arm_weakness', 'both_arms_weakness',
  'left_leg_weakness', 'right_leg_weakness', 'coordination_issues',
  'spasticity', 'ataxia'
];

const SPEECH_OPTIONS = [
  'expressive_aphasia', 'receptive_aphasia', 'word_finding_difficulty',
  'dysarthria', 'apraxia_of_speech'
];

const COGNITIVE_OPTIONS = [
  'memory_problems', 'attention_deficits', 'slow_processing_speed',
  'confusion', 'planning_difficulties', 'executive_dysfunction'
];

const VISUAL_OPTIONS = [
  'left_neglect', 'right_neglect', 'visual_field_cut',
  'double_vision', 'hemianopia'
];

export default function ClinicalProfileForm({ initialProfile, onSubmit, onCancel }: ClinicalProfileFormProps) {
  const [profile, setProfile] = useState<ClinicalProfile>(initialProfile || {
    impairments: { motor: [], speech: [], cognitive: [], visual: [] },
    stroke_location: null,
    affected_side: null,
    therapy_focus: [],
    notes: null,
    profile_source: 'manual',
    last_updated: null
  });

  const handleImpairmentToggle = (category: keyof ClinicalProfile['impairments'], value: string) => {
    setProfile(prev => {
      const current = prev.impairments[category];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return {
        ...prev,
        impairments: { ...prev.impairments, [category]: updated }
      };
    });
  };

  const handleSubmit = () => {
    const finalProfile = {
      ...profile,
      last_updated: new Date().toISOString()
    };
    onSubmit(finalProfile);
  };

  const handleProfileExtracted = (extractedProfile: ClinicalProfile) => {
    setProfile({
      ...extractedProfile,
      profile_source: extractedProfile.profile_source || 'nlp'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clinical Profile Setup</CardTitle>
        <CardDescription>
          Configure rehabilitation profile manually or use AI to extract from clinical notes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ai" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai">AI Parser</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="ai">
            <ClinicalNoteParser onProfileExtracted={handleProfileExtracted} />
          </TabsContent>

          <TabsContent value="manual" className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Motor Impairments</h3>
              <div className="grid grid-cols-2 gap-3">
                {MOTOR_OPTIONS.map(option => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={option}
                      checked={profile.impairments.motor.includes(option)}
                      onCheckedChange={() => handleImpairmentToggle('motor', option)}
                    />
                    <Label htmlFor={option} className="text-sm cursor-pointer">
                      {option.replace(/_/g, ' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Speech Impairments</h3>
              <div className="grid grid-cols-2 gap-3">
                {SPEECH_OPTIONS.map(option => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={option}
                      checked={profile.impairments.speech.includes(option)}
                      onCheckedChange={() => handleImpairmentToggle('speech', option)}
                    />
                    <Label htmlFor={option} className="text-sm cursor-pointer">
                      {option.replace(/_/g, ' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Cognitive Status</h3>
              <div className="grid grid-cols-2 gap-3">
                {COGNITIVE_OPTIONS.map(option => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={option}
                      checked={profile.impairments.cognitive.includes(option)}
                      onCheckedChange={() => handleImpairmentToggle('cognitive', option)}
                    />
                    <Label htmlFor={option} className="text-sm cursor-pointer">
                      {option.replace(/_/g, ' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Visual Impairments</h3>
              <div className="grid grid-cols-2 gap-3">
                {VISUAL_OPTIONS.map(option => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={option}
                      checked={profile.impairments.visual.includes(option)}
                      onCheckedChange={() => handleImpairmentToggle('visual', option)}
                    />
                    <Label htmlFor={option} className="text-sm cursor-pointer">
                      {option.replace(/_/g, ' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="affected_side">Affected Side</Label>
              <Select
                value={profile.affected_side || 'unknown'}
                onValueChange={(value) => setProfile({ ...profile, affected_side: value === 'unknown' ? null : value as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select affected side" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="bilateral">Both</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stroke_location">Stroke Location (if known)</Label>
              <Select
                value={profile.stroke_location || 'unknown'}
                onValueChange={(value) => setProfile({ ...profile, stroke_location: value === 'unknown' ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stroke location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left_frontal">Left Frontal</SelectItem>
                  <SelectItem value="left_temporal">Left Temporal</SelectItem>
                  <SelectItem value="left_parietal">Left Parietal</SelectItem>
                  <SelectItem value="right_frontal">Right Frontal</SelectItem>
                  <SelectItem value="right_parietal">Right Parietal</SelectItem>
                  <SelectItem value="cerebellum">Cerebellum</SelectItem>
                  <SelectItem value="brainstem">Brainstem</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional context or therapy notes..."
                value={profile.notes || ''}
                onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} className="flex-1">
                Save Profile
              </Button>
              {onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}