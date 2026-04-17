import React from 'react';
import { BookA, Search } from 'lucide-react';
import GlossaryText, { glossaryTerms } from '../components/GlossaryText';

export default function GlossaryPage() {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredTerms = glossaryTerms.filter(t => 
    t.term.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.definition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-sm font-medium">
          <BookA className="w-4 h-4" />
          Terminology
        </div>
        <h1 className="text-4xl md:text-6xl font-bold">Glossary</h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Master the language of the EPIMETHEUS system.
        </p>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-slate-500" />
        </div>
        <input 
          type="text"
          placeholder="Search terms..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-primary/50 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredTerms.map((item) => (
          <div 
            key={item.term}
            className="glass-card p-6 space-y-3 hover:bg-white/5 transition-colors"
          >
            <h3 className="text-xl font-bold text-accent-primary">{item.term}</h3>
            <p className="text-slate-300 leading-relaxed"><GlossaryText text={item.definition} /></p>
          </div>
        ))}
        {filteredTerms.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            No terms found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
}
