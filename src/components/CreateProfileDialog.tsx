import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

const profileSchema = z.object({
  profile_name: z.string().min(1, "Profile name is required").max(100),
  birthdate: z.string().optional(),
  stroke_date: z.string().optional(),
  profile_notes: z.string().max(500).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface CreateProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProfileDialog({ open, onOpenChange }: CreateProfileDialogProps) {
  const { createProfile } = useProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      profile_name: "",
      birthdate: "",
      stroke_date: "",
      profile_notes: "",
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setIsSubmitting(true);
    try {
      await createProfile({
        profile_name: data.profile_name,
        birthdate: data.birthdate || undefined,
        stroke_date: data.stroke_date || undefined,
        profile_notes: data.profile_notes || undefined,
      });
      toast.success("Profile created successfully");
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating profile:", error);
      toast.error("Failed to create profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Who is recovering?</DialogTitle>
          <DialogDescription>
            Add another person you're helping. Their practice and progress are
            tracked separately.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="profile_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Their name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Bob, Mom, Dad" {...field} />
                  </FormControl>
                  <FormDescription>
                    The name of the person who's recovering
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />


            <FormField
              control={form.control}
              name="birthdate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Birthdate</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stroke_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stroke Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="profile_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clinical Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes about this patient"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Max 500 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Profile"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
