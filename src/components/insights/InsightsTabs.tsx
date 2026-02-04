'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TranscriptView } from '@/components/videos/TranscriptView';
import { InsightsPanel } from './InsightsPanel';
import { useAgent } from '@/lib/agent/AgentProvider';
import { useExtraction } from '@/hooks/useExtraction';
import type { Video } from '@/lib/db/schema';

interface InsightsTabsProps {
  video: Video;
  onSeek: (seconds: number) => void;
  className?: string;
}

/**
 * Tab system with Transcript and Insights tabs.
 * Transcript tab shows TranscriptView, Insights tab shows InsightsPanel.
 */
export function InsightsTabs({ video, onSeek, className }: InsightsTabsProps) {
  const { agent, status: agentStatus, error: agentError } = useAgent();

  const { state, extract, cancel, insightId } = useExtraction({
    videoId: video.id,
    video: {
      title: video.title,
      channel: video.channel,
      transcript: video.transcript || '',
    },
    agent,
  });

  // Map extraction state to panel status
  const panelStatus = state.overall === 'extracting' ? 'streaming' : state.overall;

  return (
    <Tabs defaultValue="transcript" className={className}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="transcript">Transcript</TabsTrigger>
        <TabsTrigger value="insights">Insights</TabsTrigger>
      </TabsList>

      <TabsContent value="transcript" className="mt-6">
        <TranscriptView
          transcript={video.transcript || ''}
          onSeek={onSeek}
        />
      </TabsContent>

      <TabsContent value="insights" className="mt-6">
        <InsightsPanel
          status={panelStatus}
          extractionData={state.partial}
          sectionStatuses={state.sections}
          error={state.error || undefined}
          onExtract={extract}
          onCancel={insightId ? cancel : undefined}
          agentStatus={agentStatus}
          agentError={agentError || undefined}
        />
      </TabsContent>
    </Tabs>
  );
}
