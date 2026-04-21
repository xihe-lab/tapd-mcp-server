import type { ToolDef } from '../types.js';

import { workspaceTools } from './workspace.js';
import { iterationTools } from './iteration.js';
import { userTools } from './user.js';
import { storyTools } from './story.js';
import { bugTools } from './bug.js';
import { taskTools } from './task.js';
import { commentTools } from './comment.js';
import { timesheetTools } from './timesheet.js';
import { workflowTools } from './workflow.js';
import { settingsTools } from './settings.js';
import { testTools } from './test.js';
import { wikiTools } from './wiki.js';
import { releaseTools } from './release.js';

export const allTools: ToolDef[] = [
  ...workspaceTools,
  ...iterationTools,
  ...userTools,
  ...storyTools,
  ...bugTools,
  ...taskTools,
  ...commentTools,
  ...timesheetTools,
  ...workflowTools,
  ...settingsTools,
  ...testTools,
  ...wikiTools,
  ...releaseTools,
];
