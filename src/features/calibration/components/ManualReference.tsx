/**
 * Calibration feature — manual (self-guided) mode reference panels.
 * JSX extracted verbatim from src/pages/CalibrationPage.tsx (mechanical refactor).
 */
import { UserCheck } from 'lucide-react';
import Tooltip from '../../../components/Tooltip';
import { glossaryTerms } from '../../../components/GlossaryText';
import { manualClues } from '../types';

export function ManualReference() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {manualClues.map((axis) => (
          <div key={axis.axis} className="space-y-6">
            <h3 className="text-xl font-bold text-accent-primary border-b border-white/10 pb-2">{axis.axis}</h3>
            {axis.options.map((option) => {
              const glossaryMatch = glossaryTerms.find(t =>
                (option.label || '').toLowerCase().includes((t.term || '').toLowerCase())
              );

              return (
                <div key={option.label} className="glass-card p-6 space-y-4">
                  <h4 className="font-bold text-lg text-white">
                    {glossaryMatch ? (
                      <Tooltip term={glossaryMatch.term} definition={glossaryMatch.definition}>
                        {option.label}
                      </Tooltip>
                    ) : (
                      option.label
                    )}
                  </h4>
                  <ul className="space-y-2">
                    {option.clues.map((clue, i) => (
                      <li key={i} className="flex items-start gap-3 text-slate-400 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-primary mt-1.5 shrink-0" />
                        {clue}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="glass-card p-8 bg-accent-primary/5 border-accent-primary/20">
        <h3 className="text-xl font-bold mb-4">How to Mind Read</h3>
        <p className="text-slate-400 leading-relaxed">
          Identify one dominant trait from each axis. Combine the letters to find her 3-letter type.
          For example, if she is a Tester, a Denier, and a Realist, her type is TDR (The Private Dancer).
          Use the Encyclopedia to look up the specific strategy for that type.
        </p>
      </div>
    </div>
  );
}

// Re-export for consumers that want the icon alongside this component.
export { UserCheck as ManualReferenceIcon };
