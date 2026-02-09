import type { ExtractionResult } from './types';

/**
 * Extract JSON from Claude's response, handling markdown code blocks.
 * Only extracts from code blocks - doesn't try to find JSON in raw text
 * as that can interfere with partial JSON parsing.
 */
function extractFromCodeBlock(raw: string): string | null {
  // Try to extract from markdown code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }
  return null;
}

/**
 * Progressive JSON parser that extracts completed sections from partial JSON.
 * Handles streaming JSON responses where the full JSON may not be complete yet.
 *
 * @param raw - Raw JSON string (complete or partial)
 * @returns Parsed extraction result with available sections, or null if nothing extractable
 */
export function parsePartialJSON(raw: string): Partial<ExtractionResult> | null {
  if (!raw || raw.trim() === '') {
    return null;
  }

  // Try extracting from code block first (for complete responses)
  const fromCodeBlock = extractFromCodeBlock(raw);
  if (fromCodeBlock) {
    try {
      const parsed = JSON.parse(fromCodeBlock) as ExtractionResult;
      return parsed;
    } catch {
      // Code block content isn't valid JSON, try progressive parsing on it
      return parsePartialJSONContent(fromCodeBlock);
    }
  }

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(raw) as ExtractionResult;
    return parsed;
  } catch {
    // Fall through to progressive parsing
  }

  return parsePartialJSONContent(raw);
}

/**
 * Progressive parsing for partial JSON content.
 */
function parsePartialJSONContent(cleaned: string): Partial<ExtractionResult> | null {

  // Progressive parsing: extract individual completed sections
  const result: Partial<ExtractionResult> = {};

  // Extract contentType (simple string field)
  const contentTypeMatch = cleaned.match(/"contentType"\s*:\s*"([^"]+)"/);
  if (contentTypeMatch?.[1]) {
    result.contentType = contentTypeMatch[1] as ExtractionResult['contentType'];
  }

  // Extract complete summary object
  // Look for "summary": { ... } where the closing brace is matched
  const summaryMatch = cleaned.match(/"summary"\s*:\s*(\{[^}]*"tldr"\s*:\s*"(?:[^"\\]|\\.)*"[^}]*"overview"\s*:\s*"(?:[^"\\]|\\.)*"[^}]*"keyPoints"\s*:\s*\[(?:[^\]]*)\]\s*\})/);
  if (summaryMatch?.[1]) {
    try {
      const summaryObj = JSON.parse(summaryMatch[1]);
      result.summary = summaryObj;
    } catch {
      // Invalid summary, skip
    }
  }

  // Extract complete insights array
  // Look for "insights": [ ... ] where we have complete objects
  const insightsMatch = cleaned.match(/"insights"\s*:\s*(\[\s*(?:\{[^}]*"title"\s*:\s*"(?:[^"\\]|\\.)*"[^}]*"timestamp"\s*:\s*"(?:[^"\\]|\\.)*"[^}]*"explanation"\s*:\s*"(?:[^"\\]|\\.)*"[^}]*"actionable"\s*:\s*"(?:[^"\\]|\\.)*"[^}]*\}\s*,?\s*)*\])/);
  if (insightsMatch?.[1]) {
    try {
      const insightsArray = JSON.parse(insightsMatch[1]);
      if (Array.isArray(insightsArray) && insightsArray.length > 0) {
        result.insights = insightsArray;
      }
    } catch {
      // Invalid insights, skip
    }
  }

  // Extract complete actionItems object
  const actionItemsMatch = cleaned.match(/"actionItems"\s*:\s*(\{[^}]*"immediate"\s*:\s*\[(?:[^\]]*)\][^}]*"shortTerm"\s*:\s*\[(?:[^\]]*)\][^}]*"longTerm"\s*:\s*\[(?:[^\]]*)\][^}]*"resources"\s*:\s*\[(?:[^\]]*)\]\s*\})/);
  if (actionItemsMatch?.[1]) {
    try {
      const actionItemsObj = JSON.parse(actionItemsMatch[1]);
      result.actionItems = actionItemsObj;
    } catch {
      // Invalid actionItems, skip
    }
  }

  // Extract knowledgePrompt (simple string field, same pattern as contentType)
  const knowledgePromptMatch = cleaned.match(/"knowledgePrompt"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (knowledgePromptMatch?.[1]) {
    try {
      // Parse the string value to handle escaped characters
      const knowledgePromptStr = JSON.parse(`"${knowledgePromptMatch[1]}"`);
      result.knowledgePrompt = knowledgePromptStr;
    } catch {
      // Invalid knowledgePrompt, skip
    }
  }

  // Extract claudeCode object - handle nested braces in string content
  const claudeCodeStart = cleaned.indexOf('"claudeCode"');
  if (claudeCodeStart !== -1) {
    const objStart = cleaned.indexOf('{', claudeCodeStart);
    if (objStart !== -1) {
      // More robust bracket matching that ignores braces inside strings
      let depth = 1;
      let pos = objStart + 1;
      let inString = false;
      let escapeNext = false;

      while (pos < cleaned.length && depth > 0) {
        const char = cleaned[pos];

        if (escapeNext) {
          escapeNext = false;
        } else if (char === '\\') {
          escapeNext = true;
        } else if (char === '"') {
          inString = !inString;
        } else if (!inString) {
          if (char === '{') depth++;
          if (char === '}') depth--;
        }
        pos++;
      }

      if (depth === 0) {
        const claudeCodeStr = cleaned.slice(objStart, pos);
        try {
          const claudeCodeObj = JSON.parse(claudeCodeStr);
          if (typeof claudeCodeObj.applicable === 'boolean') {
            result.claudeCode = claudeCodeObj;
          }
        } catch {
          // If full parse fails, try to extract just the applicable field
          // and empty arrays for the rest
          const applicableMatch = claudeCodeStr.match(/"applicable"\s*:\s*(true|false)/);
          if (applicableMatch) {
            result.claudeCode = {
              applicable: applicableMatch[1] === 'true',
              skills: [],
              commands: [],
              agents: [],
              hooks: [],
              rules: [],
            };
          }
        }
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
