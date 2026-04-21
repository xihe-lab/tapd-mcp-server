#!/usr/bin/env node

/**
 * TAPD MCP Server Entry Point
 *
 * This is the main entry point for the TAPD MCP server.
 * It initializes the server, registers all tools, and starts
 * the stdio transport for communication with MCP clients.
 */

import { start } from './server.js';
import { allTools } from './tools/index.js';

/**
 * Start the MCP server
 */
async function main(): Promise<void> {
  try {
    await start(allTools);
    // Server is now running and listening for requests via stdio
  } catch (error) {
    console.error('Failed to start TAPD MCP server:', error);
    process.exit(1);
  }
}

// Start the server
main();
