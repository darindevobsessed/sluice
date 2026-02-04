'use client';

import { ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from './CopyButton';
import type {
  ClaudeSkill,
  ClaudeCommand,
  ClaudeAgent,
  ClaudeHook,
  ClaudeRule,
} from '@/lib/claude/prompts/types';

interface ClaudeCodeSectionProps {
  skills: ClaudeSkill[];
  commands: ClaudeCommand[];
  agents: ClaudeAgent[];
  hooks: ClaudeHook[];
  rules: ClaudeRule[];
  className?: string;
}

/**
 * Special section for Claude Code plugins with golden/amber styling.
 * Shows collapsible groups for Skills, Commands, Agents, Hooks, and Rules.
 */
export function ClaudeCodeSection({
  skills,
  commands,
  agents,
  hooks,
  rules,
}: ClaudeCodeSectionProps) {
  // Helper to format items for copying
  const formatSkill = (skill: ClaudeSkill) =>
    `# ${skill.name}\n\n${skill.description}\n\nAllowed Tools: ${skill.allowedTools.join(', ')}\n\n${skill.instructions}`;
  const formatCommand = (cmd: ClaudeCommand) =>
    `# /${cmd.name} ${cmd.argumentHint}\n\n${cmd.description}\n\nSteps:\n${cmd.steps}`;
  const formatAgent = (agent: ClaudeAgent) =>
    `# ${agent.name}\n\n${agent.description}\n\nModel: ${agent.model}\n\nSystem Prompt:\n${agent.systemPrompt}`;
  const formatHook = (hook: ClaudeHook) =>
    `# ${hook.name}\n\nEvent: ${hook.event}\nMatcher: ${hook.matcher}\nCommand: ${hook.command}\n\nPurpose: ${hook.purpose}`;
  const formatRule = (rule: ClaudeRule) =>
    `# ${rule.name}\n\n${rule.rule}\n\nRationale: ${rule.rationale}\n\nGood Example:\n${rule.goodExample}\n\nBad Example:\n${rule.badExample}`;

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50/50 p-6 dark:border-amber-800 dark:bg-amber-950/30"
      data-testid="claude-code-section"
    >
      <h3 className="mb-4 text-lg font-semibold text-amber-900 dark:text-amber-100">
        Claude Code Plugins
      </h3>

      <div className="space-y-3">
        {/* Skills */}
        {skills.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-white p-3 text-sm font-medium transition-colors hover:bg-amber-100 dark:bg-amber-900/50 dark:hover:bg-amber-800/50 dark:text-amber-100">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                <span>Skills</span>
                <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-800 dark:text-amber-100">
                  {skills.length}
                </Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 pl-6">
              {skills.map((skill, index) => (
                <div
                  key={index}
                  className="rounded-md border bg-white p-3 text-sm dark:bg-amber-900/30 dark:border-amber-800"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{skill.name}</h4>
                      <p className="mt-1 text-muted-foreground">
                        {skill.description}
                      </p>
                    </div>
                    <CopyButton text={formatSkill(skill)} />
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Commands */}
        {commands.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-white p-3 text-sm font-medium transition-colors hover:bg-amber-100 dark:bg-amber-900/50 dark:hover:bg-amber-800/50 dark:text-amber-100">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                <span>Commands</span>
                <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-800 dark:text-amber-100">
                  {commands.length}
                </Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 pl-6">
              {commands.map((command, index) => (
                <div
                  key={index}
                  className="rounded-md border bg-white p-3 text-sm dark:bg-amber-900/30 dark:border-amber-800"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium font-mono">
                        /{command.name} {command.argumentHint}
                      </h4>
                      <p className="mt-1 text-muted-foreground">
                        {command.description}
                      </p>
                    </div>
                    <CopyButton text={formatCommand(command)} />
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Agents */}
        {agents.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-white p-3 text-sm font-medium transition-colors hover:bg-amber-100 dark:bg-amber-900/50 dark:hover:bg-amber-800/50 dark:text-amber-100">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                <span>Agents</span>
                <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-800 dark:text-amber-100">
                  {agents.length}
                </Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 pl-6">
              {agents.map((agent, index) => (
                <div
                  key={index}
                  className="rounded-md border bg-white p-3 text-sm dark:bg-amber-900/30 dark:border-amber-800"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{agent.name}</h4>
                      <p className="mt-1 text-muted-foreground">
                        {agent.description}
                      </p>
                    </div>
                    <CopyButton text={formatAgent(agent)} />
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Hooks */}
        {hooks.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-white p-3 text-sm font-medium transition-colors hover:bg-amber-100 dark:bg-amber-900/50 dark:hover:bg-amber-800/50 dark:text-amber-100">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                <span>Hooks</span>
                <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-800 dark:text-amber-100">
                  {hooks.length}
                </Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 pl-6">
              {hooks.map((hook, index) => (
                <div
                  key={index}
                  className="rounded-md border bg-white p-3 text-sm dark:bg-amber-900/30 dark:border-amber-800"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{hook.name}</h4>
                      <p className="mt-1 text-muted-foreground">
                        {hook.purpose}
                      </p>
                    </div>
                    <CopyButton text={formatHook(hook)} />
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Rules */}
        {rules.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-white p-3 text-sm font-medium transition-colors hover:bg-amber-100 dark:bg-amber-900/50 dark:hover:bg-amber-800/50 dark:text-amber-100">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                <span>Rules</span>
                <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-800 dark:text-amber-100">
                  {rules.length}
                </Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 pl-6">
              {rules.map((rule, index) => (
                <div
                  key={index}
                  className="rounded-md border bg-white p-3 text-sm dark:bg-amber-900/30 dark:border-amber-800"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{rule.name}</h4>
                      <p className="mt-1 text-muted-foreground">{rule.rule}</p>
                    </div>
                    <CopyButton text={formatRule(rule)} />
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
