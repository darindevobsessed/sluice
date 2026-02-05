import { useState, useEffect, useRef, useCallback } from 'react';
import { parsePartialJSON } from '@/lib/claude/prompts/parser';
import { buildExtractionPrompt } from '@/lib/claude/prompts/extract';
import type { AgentConnection } from '@/lib/agent/connection';
import type { ExtractionResult } from '@/lib/claude/prompts/types';

export type SectionStatus = 'pending' | 'working' | 'done';

export interface ExtractionState {
  overall: 'idle' | 'extracting' | 'done' | 'error';
  sections: {
    summary: SectionStatus;
    insights: SectionStatus;
    actions: SectionStatus;
    claudeCode: SectionStatus;
  };
  partial: Partial<ExtractionResult>;
  error: string | null;
}

interface UseExtractionOptions {
  videoId: number;
  video: {
    title: string;
    channel: string;
    transcript: string;
  };
  agent: AgentConnection | null;
}

interface UseExtractionReturn {
  state: ExtractionState;
  extract: () => void;
  cancel: () => void;
  insightId: string | null;
}

const initialState: ExtractionState = {
  overall: 'idle',
  sections: {
    summary: 'pending',
    insights: 'pending',
    actions: 'pending',
    claudeCode: 'pending',
  },
  partial: {},
  error: null,
};

/**
 * Hook for managing extraction state with streaming agent connection.
 * Handles progressive parsing, section status tracking, and persistence.
 */
export function useExtraction({
  videoId,
  video,
  agent,
}: UseExtractionOptions): UseExtractionReturn {
  const [state, setState] = useState<ExtractionState>(initialState);
  const [insightId, setInsightId] = useState<string | null>(null);
  const accumulatedText = useRef<string>('');

  // Load existing extraction on mount
  useEffect(() => {
    let cancelled = false;

    async function loadExisting() {
      try {
        const res = await fetch(`/api/videos/${videoId}/insights`);
        if (!res.ok || cancelled) return;

        const data = await res.json();
        if (data.extraction && !cancelled) {
          setState({
            overall: 'done',
            sections: {
              summary: 'done',
              insights: 'done',
              actions: 'done',
              claudeCode: 'done',
            },
            partial: data.extraction,
            error: null,
          });
        }
      } catch (error) {
        console.error('Failed to load existing extraction:', error);
      }
    }

    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // Calculate section statuses based on parsed partial result
  const calculateSectionStatuses = useCallback((parsed: Partial<ExtractionResult> | null) => {
    const sections = { ...initialState.sections };

    if (!parsed) return sections;

    // Summary: done if present, working if contentType exists
    if (parsed.summary) {
      sections.summary = 'done';
      sections.insights = 'working';
    } else if (parsed.contentType) {
      sections.summary = 'working';
    }

    // Insights: done if present
    if (parsed.insights) {
      sections.insights = 'done';
      sections.actions = 'working';
    }

    // Actions: done if present
    if (parsed.actionItems) {
      sections.actions = 'done';
      sections.claudeCode = 'working';
    }

    // Claude Code: done if present
    if (parsed.claudeCode) {
      sections.claudeCode = 'done';
    }

    return sections;
  }, []);

  const extract = useCallback(() => {
    if (!agent || state.overall === 'extracting') {
      return;
    }

    accumulatedText.current = '';
    setState({
      ...initialState,
      overall: 'extracting',
    });

    const prompt = buildExtractionPrompt(video);
    const systemPrompt = 'You are an expert at extracting actionable knowledge from video transcripts. Always respond with valid JSON only.';

    const id = agent.generateInsight(
      {
        insightType: 'extraction',
        prompt,
        systemPrompt,
      },
      {
        onStart: () => {
          // Already set to extracting
        },
        onText: (text) => {
          accumulatedText.current += text;
          const parsed = parsePartialJSON(accumulatedText.current);
          const sections = calculateSectionStatuses(parsed);

          setState((prev) => ({
            ...prev,
            partial: parsed || prev.partial,
            sections,
          }));
        },
        onDone: async (fullContent) => {
          const parsed = parsePartialJSON(fullContent);

          // Debug: log what we got
          console.log('[Extraction] Parse result:', {
            hasParsed: !!parsed,
            hasContentType: !!parsed?.contentType,
            hasSummary: !!parsed?.summary,
            hasInsights: !!parsed?.insights,
            hasActionItems: !!parsed?.actionItems,
            hasClaudeCode: !!parsed?.claudeCode,
          });

          if (parsed && isCompleteExtraction(parsed)) {
            // Persist to API
            try {
              await fetch(`/api/videos/${videoId}/insights`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extraction: parsed }),
              });
            } catch (error) {
              console.error('Failed to persist extraction:', error);
              // Continue anyway - extraction is still in state
            }

            setState({
              overall: 'done',
              sections: {
                summary: 'done',
                insights: 'done',
                actions: 'done',
                claudeCode: parsed.claudeCode?.applicable ? 'done' : 'pending',
              },
              partial: parsed,
              error: null,
            });
          } else if (parsed) {
            // Partial success - show what we have instead of failing completely
            console.warn('[Extraction] Partial extraction - missing some sections:', {
              contentType: parsed.contentType,
              summary: !!parsed.summary,
              insights: !!parsed.insights,
              actionItems: !!parsed.actionItems,
              claudeCode: !!parsed.claudeCode,
            });

            setState({
              overall: 'done',
              sections: {
                summary: parsed.summary ? 'done' : 'pending',
                insights: parsed.insights ? 'done' : 'pending',
                actions: parsed.actionItems ? 'done' : 'pending',
                claudeCode: parsed.claudeCode?.applicable ? 'done' : 'pending',
              },
              partial: parsed,
              error: null,
            });
          } else {
            // Complete failure - couldn't parse anything
            console.error('[Extraction] Complete parse failure. Raw content length:', fullContent?.length);
            setState((prev) => ({
              ...prev,
              overall: 'error',
              error: 'Failed to parse extraction response',
            }));
          }
          setInsightId(null);
        },
        onError: (error) => {
          setState((prev) => ({
            ...prev,
            overall: 'error',
            error,
          }));
          setInsightId(null);
        },
        onCancel: () => {
          setState(initialState);
          setInsightId(null);
        },
      }
    );

    setInsightId(id);
  }, [agent, state.overall, video, videoId, calculateSectionStatuses]);

  const cancel = useCallback(() => {
    if (insightId && agent) {
      agent.cancelInsight(insightId);
    }
  }, [insightId, agent]);

  return {
    state,
    extract,
    cancel,
    insightId,
  };
}

/**
 * Type guard to check if extraction has minimum required sections.
 * claudeCode is optional - we don't fail the entire extraction if it doesn't parse.
 */
function isCompleteExtraction(
  partial: Partial<ExtractionResult>
): partial is ExtractionResult {
  // Core sections required: contentType, summary, insights, actionItems
  // claudeCode is optional - it often fails to parse due to nested JSON complexity
  const hasCoreSection = !!(
    partial.contentType &&
    partial.summary &&
    partial.insights &&
    partial.actionItems
  );

  // If core sections exist but claudeCode is missing, add a default
  if (hasCoreSection && !partial.claudeCode) {
    partial.claudeCode = {
      applicable: false,
      skills: [],
      commands: [],
      agents: [],
      hooks: [],
      rules: [],
    };
  }

  return hasCoreSection;
}
