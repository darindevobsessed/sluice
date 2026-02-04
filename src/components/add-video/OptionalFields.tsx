"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface OptionalFieldsProps {
  tags: string;
  notes: string;
  onTagsChange: (value: string) => void;
  onNotesChange: (value: string) => void;
}

export function OptionalFields({
  tags,
  notes,
  onTagsChange,
  onNotesChange,
}: OptionalFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tags" className="text-base">
          Tags <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="tags"
          type="text"
          placeholder="ai, productivity, workflows (comma-separated)"
          value={tags}
          onChange={(e) => onTagsChange(e.target.value)}
          className="text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes" className="text-base">
          Notes <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          placeholder="Add any additional notes or context..."
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="min-h-[80px] text-base"
        />
      </div>
    </div>
  );
}
