import type { GroupedSelections, Project } from '../types';
import { SelectionPanel } from './SelectionPanel';

interface SelectionSummaryProps {
  project: Project;
  selections: GroupedSelections;
}

/**
 * Side-by-side summary of the bride's and groom's picks, tracked separately.
 */
export function SelectionSummary({ project, selections }: SelectionSummaryProps) {
  return (
    <div className="selection-summary">
      <SelectionPanel
        side="bride"
        title={project.bride_name ? `${project.bride_name} (Bride)` : 'Bride'}
        selections={selections.bride}
      />
      <SelectionPanel
        side="groom"
        title={project.groom_name ? `${project.groom_name} (Groom)` : 'Groom'}
        selections={selections.groom}
      />
    </div>
  );
}
