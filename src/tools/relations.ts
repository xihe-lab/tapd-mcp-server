import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const relationTools: ToolDef[] = [
  {
    name: "tapd_get_link_stories",
    description: "Get linked stories for a story",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      story_id: z.string().describe("Story ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/stories/get_link_stories", params);
    },
  },
  {
    name: "tapd_get_related_bugs",
    description: "Get related bugs for a story",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      story_id: z.string().describe("Story ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/stories/get_related_bugs", params);
    },
  },
  {
    name: "tapd_get_link_bugs",
    description: "Get linked bugs for a bug",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      bug_id: z.string().describe("Bug ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/bugs/get_link_bugs", params);
    },
  },
  {
    name: "tapd_get_related_stories",
    description: "Get related stories for a bug",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      bug_id: z.string().describe("Bug ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/bugs/get_related_stories", params);
    },
  },
  {
    name: "tapd_add_story_link_relation",
    description: "Add story link relation",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      source_story_id: z.string().describe("Source story ID"),
      target_story_id: z.string().describe("Target story ID"),
      link_type: z.string().optional().describe("Link type"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.post("/stories/add_story_link_relations", params);
    },
  },
  {
    name: "tapd_remove_story_link_relation",
    description: "Remove story link relation",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      source_story_id: z.string().describe("Source story ID"),
      target_story_id: z.string().describe("Target story ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.post("/stories/remove_story_link_relation", params);
    },
  },
];