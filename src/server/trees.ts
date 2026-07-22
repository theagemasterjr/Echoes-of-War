import type { ChapterId } from '@/chapters/types';
import type { ConstraintTree } from '@/conversation/treeTypes';
import ch1 from '@/content/trees/ch1';
import ch2 from '@/content/trees/ch2';
import ch3 from '@/content/trees/ch3';
import ch4 from '@/content/trees/ch4';
import ch5 from '@/content/trees/ch5';
import ch6 from '@/content/trees/ch6';

/** Trees are resolved server-side only — the client never sees or sends tree content. */
export const TREES: Record<ChapterId, ConstraintTree> = { ch1, ch2, ch3, ch4, ch5, ch6 };

export function totalLearningPoints(tree: ConstraintTree): number {
  return Object.values(tree.nodes).reduce((n, node) => n + node.learningPoints.length, 0);
}
