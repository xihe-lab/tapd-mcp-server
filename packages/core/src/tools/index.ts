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
import { attachmentTools } from './attachment.js';
import { miniItemTools } from './mini-item.js';
import { miniWorkspaceTools } from './mini-workspace.js';
import { miniCommentTools } from './mini-comment.js';
import { changeTools } from './changes.js';
import { customFieldTools } from './custom-fields.js';
import { relationTools } from './relations.js';
import { boardTools } from './board.js';
import { sourceTools } from './source.js';
import { programTools } from './program.js';
import { reportTools } from './report.js';
import { utilityTools } from './utility.js';
import { imageTools } from './image.js';

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
  ...attachmentTools,
  ...miniItemTools,
  ...miniWorkspaceTools,
  ...miniCommentTools,
  ...changeTools,
  ...customFieldTools,
  ...relationTools,
  ...boardTools,
  ...sourceTools,
  ...programTools,
  ...reportTools,
  ...utilityTools,
  ...imageTools,
];
