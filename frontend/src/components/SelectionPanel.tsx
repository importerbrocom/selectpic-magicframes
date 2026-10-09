import type { Choice, ImageSelection } from '../types';

interface SelectionPanelProps {
  side: Choice;
  title: string;
  selections: ImageSelection[];
}

/**
 * Lists the picks for a single side (bride or groom). Rendering one panel per
 * side keeps the two sets of choices visibly separated.
 */
export function SelectionPanel({ side, title, selections }: SelectionPanelProps) {
  return (
    <section className={`panel panel--${side}`}>
      <header className="panel__header">
        <h3>{title}</h3>
        <span className="panel__count">{selections.length}</span>
      </header>

      {selections.length === 0 ? (
        <p className="panel__empty">No picks yet.</p>
      ) : (
        <ul className="panel__list">
          {selections.map((selection) => (
            <li key={selection.id} className="panel__item">
              {selection.thumbnail_link ? (
                <img
                  src={selection.thumbnail_link}
                  alt={selection.file_name ?? selection.file_id}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="panel__item-placeholder" aria-hidden>
                  🖼
                </span>
              )}
              <span className="panel__item-name" title={selection.file_name ?? ''}>
                {selection.file_name ?? selection.file_id}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
