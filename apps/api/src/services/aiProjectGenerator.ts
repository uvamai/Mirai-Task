import { TenantIntegration, ProjectMember, User } from '../models';
import { decryptConfig } from './cryptoService';

interface ProjectRequirements {
  description: string;
  techStack: string;
  template: string;
  keyRequirements: string;
}

interface AIProjectOutput {
  prdContent: string;
  timeline: Record<string, unknown>;
  tasks: Array<{
    title: string;
    description: string;
    type: string;
    role: string;
    customFields?: Record<string, unknown>;
  }>;
}

export async function generateProjectWithAI(tenantId: string, _projectId: string, requirements: ProjectRequirements): Promise<AIProjectOutput> {
  const integration = await TenantIntegration.findOne({
    where: { tenantId, provider: 'openai', status: 'active' },
  });

  if (!integration) {
    throw new Error('No active OpenAI integration found for tenant. Please provide an API key in Integrations.');
  }

  const config = decryptConfig(integration.encryptedConfig);
  const apiKey = config.apiKey as string;

  if (!apiKey) {
    throw new Error('Invalid API key configuration');
  }

  // In a full implementation, you would call the OpenAI API here.
  // const openai = new OpenAI({ apiKey });
  // const response = await openai.chat.completions.create({ ... })

  // Since we cannot make live external network requests reliably without the user's real key,
  // we will simulate the AI's structured output based on the inputs for demonstration.

  const generatedPrd = `
# Product Requirements Document
## Overview
${requirements.description}

## Tech Stack
${requirements.techStack}

## Key Requirements
${requirements.keyRequirements}
  `.trim();

  const mockTasks = [
    { title: 'Setup Infrastructure', description: 'Configure servers for ' + requirements.techStack, type: 'task', role: 'DevOps' },
    { title: 'Design Database Schema', description: 'Architect DB models', type: 'task', role: 'Backend Developer' },
    { title: 'Create UI Mockups', description: 'Design screens based on PRD', type: 'task', role: 'Designer' },
    { title: 'Phase 1 Milestone', description: 'Complete core features', type: 'milestone', role: 'Project Manager' },
  ];

  return {
    prdContent: generatedPrd,
    timeline: {
      phases: ['Planning', 'Development', 'Testing', 'Launch'],
      estimatedWeeks: 4,
    },
    tasks: mockTasks,
  };
}

export async function assignRolesToMembers(tenantId: string, projectId: string, roles: string[]) {
  // Simple heuristic: fetch project members and assign tasks based on role strings
  const members = await ProjectMember.findAll({
    where: { projectId, tenantId },
    include: [{ model: User }],
  });

  // For this prototype, return a map of role to memberId, simply picking a random or first available user
  const map: Record<string, string> = {};
  roles.forEach((role, i) => {
    const member = members[i % members.length];
    if (member) {
      map[role] = member.userId;
    }
  });

  return map;
}
