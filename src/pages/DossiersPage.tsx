import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Plus, Search, User, Calendar, Trash2, Edit3, X, Loader2 } from 'lucide-react';
import { personalityTypes } from '../data/personalityTypes';
import { toast } from 'sonner';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { supabase } from '../lib/supabase';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { cn } from '../lib/utils';

interface Dossier {
  id: string;
  name: string;
  type_id: string;
  phase: 'Intrigue' | 'Arousal' | 'Comfort' | 'Devotion';
  notes: string;
  last_interaction: string;
  created_at: string;
}

export default function DossiersPage() {
  const auth = useEnhancedAuth();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState(personalityTypes[0].id);
  const [phase, setPhase] = useState<Dossier['phase']>('Intrigue');
  const [notes, setNotes] = useState('');
  const [lastInteraction, setLastInteraction] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const { user } = auth || {};

  useEffect(() => {
    const loadDossiers = async () => {
      setLoading(true);
      if (user) {
        try {
           const { data: dossiers, error } = await supabase
             .from('dossiers')
             .select('*')
             .eq('user_id', user.id);
          if (error) throw error;
           const loadedDossiers: Dossier[] = [];
           dossiers.forEach((data) => {
             loadedDossiers.push({
               id: data.id,
               name: data.name,
               type_id: data.type_id,
               phase: data.phase,
               notes: data.notes || '',
               last_interaction: data.last_interaction || '',
               created_at: data.created_at || new Date().toISOString()
             });
           });
           // Sort by newest first
           loadedDossiers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setDossiers(loadedDossiers);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'dossiers');
        }
      } else {
        const saved = localStorage.getItem('epimetheus_dossiers');
        if (saved) {
          try {
            setDossiers(JSON.parse(saved));
          } catch {
            console.error('Failed to parse dossiers');
          }
        }
      }
      setLoading(false);
    };
    loadDossiers().catch(err => {
      console.error("Unhandled error in DossiersPage loadDossiers:", err);
      setLoading(false);
    });
  }, [user]);

  const saveDossiers = async (newDossiers: Dossier[]) => {
    setDossiers(newDossiers);
    if (!user) {
      try {
        localStorage.setItem('epimetheus_dossiers', JSON.stringify(newDossiers));
      } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.message?.includes('exceeded the quota')) {
          console.warn("localStorage quota exceeded for dossiers, keeping only last 20 items...");
          try {
            const lastItems = newDossiers.slice(0, 20);
            localStorage.setItem('epimetheus_dossiers', JSON.stringify(lastItems));
          } catch (finalError) {
            console.error("Failed to save dossiers to localStorage", finalError);
          }
        } else {
          console.error("Failed to save dossiers", e);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      const updatedDossier = { name, type_id: typeId, phase, notes, last_interaction: lastInteraction };
      
      if (user) {
        try {
          const { error } = await supabase
            .from('dossiers')
            .update(updatedDossier)
            .eq('id', editingId);
          if (error) throw error;
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `dossiers/${editingId}`);
          return;
        }
      }
      
      saveDossiers(dossiers.map(d => d.id === editingId ? { ...d, ...updatedDossier } : d));
    } else {
       const newDossierData = {
         name,
         type_id: typeId,
         phase,
         notes,
         last_interaction: lastInteraction || new Date().toISOString().split('T')[0],
       };

       let newId = Date.now().toString();
       let createdAtStr = new Date().toISOString();

       if (user) {
         try {
           const { data, error } = await supabase
             .from('dossiers')
             .insert({
               ...newDossierData,
               user_id: user.id,
               created_at: new Date().toISOString()
             })
             .select()
             .single();
          if (error) throw error;
          newId = data.id;
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'dossiers');
          return;
        }
      }

       const newDossier: Dossier = {
         id: newId,
         ...newDossierData,
         created_at: createdAtStr
       };
      
      saveDossiers([newDossier, ...dossiers]);
    }
    closeModal();
  };

   const handleEdit = (dossier: Dossier) => {
     setEditingId(dossier.id);
     setName(dossier.name);
     setTypeId(dossier.type_id as any);
     setPhase(dossier.phase);
     setNotes(dossier.notes);
     setLastInteraction(dossier.last_interaction);
     setIsModalOpen(true);
   };

  const handleDelete = async (id: string) => {
    if (confirmingDelete !== id) {
      setConfirmingDelete(id);
      toast("Click again to confirm deletion", {
        action: {
          label: "Confirm",
          onClick: () => {
            handleDelete(id).catch(err => {
              console.error("Dossier deletion failed:", err);
            });
          }
        }
      });
      return;
    }
    
    if (user) {
      try {
        const { error } = await supabase
          .from('dossiers')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `dossiers/${id}`);
        return;
      }
    }
    
    saveDossiers(dossiers.filter(d => d.id !== id));
    toast.success("Dossier deleted successfully.");
    setConfirmingDelete(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setName('');
    setTypeId(personalityTypes[0].id);
    setPhase('Intrigue');
    setNotes('');
    setLastInteraction('');
  };

   const filteredDossiers = dossiers.filter(d => 
     d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     d.type_id.toLowerCase().includes(searchQuery.toLowerCase())
   );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-700/30 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" aria-hidden="true" />
            <span className="eyebrow text-accent-primary">Target Tracking</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-50">
            Subject Dossiers
          </h1>
        </div>
        <div className="text-left md:text-right mt-4 md:mt-0 w-full md:w-auto">
          <p className="eyebrow">
            Active Targets: <span className="tabular-nums">{dossiers.length}</span>
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full md:w-auto mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl accent-gradient text-mystic-950 text-sm font-semibold tracking-wide shadow-lg shadow-accent-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            <Plus aria-hidden="true" className="w-4 h-4" strokeWidth={1.5} />
            New Dossier
          </button>
        </div>
      </div>

      <div className="relative group max-w-md mb-8">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search aria-hidden="true" className="w-5 h-5 text-slate-500 group-focus-within:text-accent-primary transition-colors" strokeWidth={1.5} />
        </div>
        <input
          type="text"
          placeholder="Search dossiers by name or type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            'w-full bg-mystic-800/50 border border-slate-700/30 rounded-2xl py-3 pl-12 pr-4 text-slate-100 placeholder:text-slate-500 text-sm',
            'focus:outline-none focus:border-accent-primary/60 focus:shadow-[0_0_0_3px_rgba(232,199,126,0.12)]',
            'transition-[border-color,box-shadow] duration-200'
          )}
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 aria-hidden="true" className="w-8 h-8 text-accent-primary animate-spin" />
        </div>
      ) : filteredDossiers.length === 0 ? (
        <div className="text-center py-20 glass-card">
          <FileText aria-hidden="true" className="w-12 h-12 text-slate-600 mx-auto mb-4" strokeWidth={1.5} />
          <h3 className="text-xl font-semibold text-slate-100 mb-2">No Dossiers Found</h3>
          <p className="text-slate-500">Create a new dossier to start tracking a subject.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDossiers.map((dossier) => {
            const type = personalityTypes.find((p) => p.id === dossier.type_id);
            return (
              <div
                key={dossier.id}
                className="glass-card p-6 relative group hover:border-accent-primary/25 transition-colors"
              >
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(dossier)}
                    aria-label={`Edit ${dossier.name}`}
                    className="p-2 rounded-lg bg-white/5 border border-slate-700/30 text-slate-400 hover:text-slate-100 hover:border-accent-primary/20 transition-colors"
                  >
                    <Edit3 aria-hidden="true" className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => {
                      handleDelete(dossier.id).catch((err) => {
                        console.error('Dossier deletion failed:', err);
                      });
                    }}
                    aria-label={`Delete ${dossier.name}`}
                    className="p-2 rounded-lg bg-status-error/10 border border-status-error/20 text-status-error hover:bg-status-error/20 transition-colors"
                  >
                    <Trash2 aria-hidden="true" className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center shrink-0">
                    <User aria-hidden="true" className="w-6 h-6 text-accent-primary" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold text-slate-100 truncate">{dossier.name}</h3>
                    <p className="text-xs font-mono text-accent-primary uppercase tracking-widest truncate">{type?.name || dossier.type_id}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="eyebrow block mb-1">Current Phase</span>
                    <div className="inline-flex px-3 py-1 rounded-lg bg-white/5 border border-slate-700/30 text-xs font-medium text-slate-200 tracking-wide">
                      {dossier.phase}
                    </div>
                  </div>

                  <div>
                    <span className="eyebrow block mb-1">Last Interaction</span>
                    <div className="flex items-center gap-2 text-sm text-slate-400 tabular-nums">
                      <Calendar aria-hidden="true" className="w-4 h-4" strokeWidth={1.5} />
                      {dossier.last_interaction || '—'}
                    </div>
                  </div>

                  {dossier.notes && (
                    <div>
                      <span className="eyebrow block mb-1">Field Notes</span>
                      <p className="text-sm text-slate-400 line-clamp-3 bg-mystic-950/50 p-3 rounded-xl border border-slate-700/30 leading-relaxed">
                        {dossier.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeModal}
              className="absolute inset-0 bg-mystic-950/80 backdrop-blur-md"
              aria-hidden="true"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="relative w-full max-w-lg bg-mystic-900/95 backdrop-blur-xl border border-accent-primary/8 rounded-2xl shadow-[0_24px_80px_-16px_rgba(0,0,0,0.65)] overflow-hidden"
            >
              <div className="p-6 border-b border-slate-700/30 flex justify-between items-center">
                <h2 className="text-xl font-semibold tracking-tight text-slate-100">{editingId ? 'Edit Dossier' : 'New Dossier'}</h2>
                <button
                  onClick={closeModal}
                  aria-label="Close"
                  className="p-2 rounded-xl hover:bg-white/5 text-slate-400 transition-colors"
                >
                  <X aria-hidden="true" className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="eyebrow ml-1">Subject Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-mystic-950/50 border border-slate-700/30 rounded-xl py-3 px-4 text-slate-100 focus:outline-none focus:border-accent-primary/60 focus:shadow-[0_0_0_3px_rgba(232,199,126,0.12)] transition-[border-color,box-shadow] duration-200"
                    placeholder="Enter name or alias..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="eyebrow ml-1">Personality Type</label>
                    <select
                      value={typeId}
                      onChange={(e) => setTypeId(e.target.value as any)}
                      className="custom-select w-full bg-mystic-950/50 border border-slate-700/30 text-slate-100"
                    >
                      {personalityTypes.map((pt) => (
                        <option key={pt.id} value={pt.id}>
                          {pt.name} ({pt.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="eyebrow ml-1">Current Phase</label>
                    <select
                      value={phase}
                      onChange={(e) => setPhase(e.target.value as Dossier['phase'])}
                      className="custom-select w-full bg-mystic-950/50 border border-slate-700/30 text-slate-100"
                    >
                      <option value="Intrigue">Intrigue</option>
                      <option value="Arousal">Arousal</option>
                      <option value="Comfort">Comfort</option>
                      <option value="Devotion">Devotion</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="eyebrow ml-1">Last Interaction Date</label>
                  <input
                    type="date"
                    value={lastInteraction}
                    onChange={(e) => setLastInteraction(e.target.value)}
                    className="w-full bg-mystic-950/50 border border-slate-700/30 rounded-xl py-3 px-4 text-slate-100 tabular-nums focus:outline-none focus:border-accent-primary/60 focus:shadow-[0_0_0_3px_rgba(232,199,126,0.12)] transition-[border-color,box-shadow] duration-200"
                  />
                </div>

                <div className="space-y-2">
                  <label className="eyebrow ml-1">Field Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full bg-mystic-950/50 border border-slate-700/30 rounded-xl py-3 px-4 text-slate-100 leading-relaxed focus:outline-none focus:border-accent-primary/60 focus:shadow-[0_0_0_3px_rgba(232,199,126,0.12)] transition-[border-color,box-shadow] duration-200 resize-none"
                    placeholder="Observations, triggers, red flags..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/30">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-5 py-2.5 rounded-xl bg-white/5 border border-slate-700/30 text-slate-100 font-semibold tracking-wide hover:bg-white/8 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl accent-gradient text-mystic-950 font-semibold tracking-wide shadow-lg shadow-accent-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    {editingId ? 'Save Changes' : 'Create Dossier'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
