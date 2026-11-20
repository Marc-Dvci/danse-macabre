import type { Tool } from '../tool';
import { composeScoreTool } from './compose';
import { describeScore, validateScoreTool } from './check';
import { findPhraseTool, mirrorScoreTool, retimeScore } from './edit';
import { notateClip } from './notate';
import { performScore, renderScoreSvg } from './play';

/** Every tool the server exposes, in the order it lists them. */
export const ALL_TOOLS: Tool[] = [
  notateClip,
  validateScoreTool,
  describeScore,
  mirrorScoreTool,
  retimeScore,
  findPhraseTool,
  performScore,
  renderScoreSvg,
  composeScoreTool,
];
