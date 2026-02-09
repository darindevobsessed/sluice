import { describe, it, expect } from 'vitest';
import { parsePartialJSON } from '../parser';
import type { ExtractionResult } from '../types';

describe('parsePartialJSON', () => {
  describe('complete JSON parsing', () => {
    it('should parse complete valid JSON', () => {
      const completeJSON = JSON.stringify({
        contentType: 'dev',
        summary: {
          tldr: 'Test summary',
          overview: 'Test overview',
          keyPoints: ['Point 1', 'Point 2'],
        },
        insights: [
          {
            title: 'Test insight',
            timestamp: '00:10:00',
            explanation: 'Test explanation',
            actionable: 'Test actionable',
          },
        ],
        actionItems: {
          immediate: ['Action 1'],
          shortTerm: [],
          longTerm: [],
          resources: [],
        },
        claudeCode: {
          applicable: false,
          skills: [],
          commands: [],
          agents: [],
          hooks: [],
          rules: [],
        },
      } satisfies ExtractionResult);

      const result = parsePartialJSON(completeJSON);
      expect(result).toBeDefined();
      expect(result?.contentType).toBe('dev');
      expect(result?.summary?.tldr).toBe('Test summary');
      expect(result?.insights).toHaveLength(1);
    });
  });

  describe('partial JSON parsing', () => {
    it('should return null for empty string', () => {
      const result = parsePartialJSON('');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON with no extractable sections', () => {
      const result = parsePartialJSON('{"invalid');
      expect(result).toBeNull();
    });

    it('should extract contentType from partial JSON', () => {
      const partial = '{"contentType": "educational", "summary": {';
      const result = parsePartialJSON(partial);
      expect(result).toBeDefined();
      expect(result?.contentType).toBe('educational');
    });

    it('should extract complete summary object from partial JSON', () => {
      const partial = `{
        "contentType": "dev",
        "summary": {
          "tldr": "Short summary",
          "overview": "Detailed overview",
          "keyPoints": ["Key 1", "Key 2"]
        },
        "insights": [`;

      const result = parsePartialJSON(partial);
      expect(result).toBeDefined();
      expect(result?.contentType).toBe('dev');
      expect(result?.summary).toBeDefined();
      expect(result?.summary?.tldr).toBe('Short summary');
      expect(result?.summary?.keyPoints).toEqual(['Key 1', 'Key 2']);
    });

    it('should extract complete insights array from partial JSON', () => {
      const partial = `{
        "contentType": "dev",
        "insights": [
          {
            "title": "Insight 1",
            "timestamp": "00:05:00",
            "explanation": "Explanation 1",
            "actionable": "Action 1"
          },
          {
            "title": "Insight 2",
            "timestamp": "00:10:00",
            "explanation": "Explanation 2",
            "actionable": "Action 2"
          }
        ],
        "actionItems": {`;

      const result = parsePartialJSON(partial);
      expect(result).toBeDefined();
      expect(result?.insights).toBeDefined();
      expect(result?.insights).toHaveLength(2);
      expect(result?.insights?.[0]?.title).toBe('Insight 1');
    });

    it('should extract complete actionItems object from partial JSON', () => {
      const partial = `{
        "contentType": "dev",
        "actionItems": {
          "immediate": ["Do this now"],
          "shortTerm": ["Do this soon"],
          "longTerm": ["Do this later"],
          "resources": [{"name": "Resource 1", "description": "Description 1"}]
        },
        "claudeCode": {`;

      const result = parsePartialJSON(partial);
      expect(result).toBeDefined();
      expect(result?.actionItems).toBeDefined();
      expect(result?.actionItems?.immediate).toEqual(['Do this now']);
      expect(result?.actionItems?.resources).toHaveLength(1);
    });

    it('should extract complete claudeCode object from partial JSON', () => {
      const partial = `{
        "contentType": "dev",
        "claudeCode": {
          "applicable": true,
          "skills": [{"name": "test-skill", "description": "Test", "allowedTools": ["Read"], "instructions": "Test"}],
          "commands": [],
          "agents": [],
          "hooks": [],
          "rules": []
        }
      }`;

      const result = parsePartialJSON(partial);
      expect(result).toBeDefined();
      expect(result?.claudeCode).toBeDefined();
      expect(result?.claudeCode?.applicable).toBe(true);
      expect(result?.claudeCode?.skills).toHaveLength(1);
    });

    it('should handle multiple extracted sections progressively', () => {
      const partial = `{
        "contentType": "meeting",
        "summary": {
          "tldr": "Meeting summary",
          "overview": "Meeting overview",
          "keyPoints": ["Decision 1"]
        },
        "insights": [
          {
            "title": "Key decision",
            "timestamp": "00:15:00",
            "explanation": "We decided X",
            "actionable": "Implement X"
          }
        ],
        "actionItems": {
          "immediate": ["Task 1"],
          "shortTerm":`;

      const result = parsePartialJSON(partial);
      expect(result).toBeDefined();
      expect(result?.contentType).toBe('meeting');
      expect(result?.summary).toBeDefined();
      expect(result?.insights).toBeDefined();
      expect(result?.actionItems).toBeUndefined(); // Incomplete
    });

    it('should extract knowledgePrompt string from partial JSON', () => {
      const partial = `{
        "contentType": "dev",
        "knowledgePrompt": "This is a knowledge transfer prompt with specific techniques and actionable details.",
        "claudeCode": {`;

      const result = parsePartialJSON(partial);
      expect(result).toBeDefined();
      expect(result?.knowledgePrompt).toBe('This is a knowledge transfer prompt with specific techniques and actionable details.');
    });

    it('should extract knowledgePrompt with escaped quotes and newlines', () => {
      const partial = `{
        "contentType": "dev",
        "knowledgePrompt": "He said \\"hello\\" and\\nthen continued.",
        "claudeCode": {`;

      const result = parsePartialJSON(partial);
      expect(result).toBeDefined();
      expect(result?.knowledgePrompt).toBe('He said "hello" and\nthen continued.');
    });

    it('should extract knowledgePrompt from complete JSON', () => {
      const completeJSON = JSON.stringify({
        contentType: 'dev',
        summary: {
          tldr: 'Test',
          overview: 'Test',
          keyPoints: [],
        },
        insights: [],
        actionItems: {
          immediate: [],
          shortTerm: [],
          longTerm: [],
          resources: [],
        },
        knowledgePrompt: 'Knowledge prompt content here.',
        claudeCode: {
          applicable: false,
          skills: [],
          commands: [],
          agents: [],
          hooks: [],
          rules: [],
        },
      } satisfies ExtractionResult);

      const result = parsePartialJSON(completeJSON);
      expect(result).toBeDefined();
      expect(result?.knowledgePrompt).toBe('Knowledge prompt content here.');
    });

    it('should handle missing knowledgePrompt gracefully', () => {
      const partial = `{
        "contentType": "dev",
        "summary": {
          "tldr": "Test",
          "overview": "Test",
          "keyPoints": []
        },
        "claudeCode": {
          "applicable": false,
          "skills": [],
          "commands": [],
          "agents": [],
          "hooks": [],
          "rules": []
        }
      }`;

      const result = parsePartialJSON(partial);
      expect(result).toBeDefined();
      expect(result?.knowledgePrompt).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle escaped quotes in strings', () => {
      const partial = '{"contentType": "dev", "summary": {"tldr": "He said \\"hello\\"", "overview": "Test", "keyPoints": []}}';
      const result = parsePartialJSON(partial);
      expect(result?.summary?.tldr).toBe('He said "hello"');
    });

    it('should handle newlines in string values', () => {
      const partial = `{
        "contentType": "dev",
        "summary": {
          "tldr": "Line 1\\nLine 2",
          "overview": "Overview",
          "keyPoints": []
        }
      }`;
      const result = parsePartialJSON(partial);
      // JSON.parse converts \\n to actual newline
      expect(result?.summary?.tldr).toBe('Line 1\nLine 2');
    });

    it('should not extract incomplete nested objects', () => {
      const partial = '{"contentType": "dev", "summary": {"tldr": "Test", "overview":';
      const result = parsePartialJSON(partial);
      expect(result?.contentType).toBe('dev');
      expect(result?.summary).toBeUndefined();
    });
  });
});
