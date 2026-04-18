import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, Plus, Search, User, Calendar, Trash2, Edit3, X, Loader2 } from 'lucide-react';
import { personalityTypes } from '../data/personalityTypes';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

interface Dossier {
  id: string;
  name: string;
  typeId: string;
  phase: 'Intrigue' | 'Arousal' | 'Comfort' | 'Devotion';
  notes: string;
  lastInteraction: string;
  createdAt: string;
}

export default function DossiersPage() {
  const auth = useAuth();
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
            .eq('userId', user.id);
          if (error) throw error;
          const loadedDossiers: Dossier[] = [];
          dossiers.forEach((data) => {
            loadedDossiers.push({
              id: data.id,
              name: data.name,
              typeId: data.typeId,
              phase: data.phase,
              notes: data.notes || '',
              lastInteraction: data.lastInteraction || '',
              createdAt: data.createdAt || new Date().toISOString()
            });
          });
          // Sort by newest first
          loadedDossiers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setDossiers(loadedDossiers);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'dossiers');
        }
      } else {
        const saved = localStorage.getItem('epimetheus_dossiers');
        if (saved) {
          try {
            setDossiers(JSON.parse(saved));
          } catch (e) {
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
      const updatedDossier = { name, typeId, phase, notes, lastInteraction };
      
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
        typeId,
        phase,
        notes,
        lastInteraction: lastInteraction || new Date().toISOString().split('T')[0],
      };

      let newId = Date.now().toString();
      let createdAtStr = new Date().toISOString();

      if (user) {
        try {
          const { data, error } = await supabase
            .from('dossiers')
            .insert({
              ...newDossierData,
              userId: user.id,
              createdAt: new Date().toISOString()
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
        createdAt: createdAtStr
      };
      
      saveDossiers([newDossier, ...dossiers]);
    }
    closeModal();
  };

  const handleEdit = (dossier: Dossier) => {
    setEditingId(dossier.id);
    setName(dossier.name);
    setTypeId(dossier.typeId as any);
    setPhase(dossier.phase);
    setNotes(dossier.notes);
    setLastInteraction(dossier.lastInteraction);
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
    d.typeId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
            <span className="text-xs font-mono text-accent-primary tracking-widest uppercase">Target Tracking</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white uppercase">
            Subject Dossiers
          </h1>
        </div>
        <div className="text-left md:text-right mt-4 md:mt-0 w-full md:w-auto">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Active Targets: {dossiers.length}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full md:w-auto mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-xl accent-gradient text-white text-sm font-bold shadow-lg shadow-accent-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Dossier
          </button>
        </div>
      </div>

      <div className="relative group max-w-md mb-8">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-slate-500 group-focus-within:text-accent-primary transition-colors" />
        </div>
        <input
          type="text"
          placeholder="Search dossiers by name or type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#151619] border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-accent-primary/50 transition-all text-sm font-mono shadow-inner"
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
        </div>
      ) : filteredDossiers.length === 0 ? (
        <div className="text-center py-20 bg-[#151619] rounded-2xl border border-white/5">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Dossiers Found</h3>
          <p className="text-slate-500">Create a new dossier to start tracking a subject.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDossiers.map(dossier => {
            const type = personalityTypes.find(p => p.id === dossier.typeId);
            return (
              <div key={dossier.id} className="p-6 rounded-2xl bg-[#151619] border border-white/5 shadow-2xl relative group hover:border-accent-primary/30 transition-all">
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(dossier)} className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      handleDelete(dossier.id).catch(err => {
                        console.error("Dossier deletion failed:", err);
                      });
                    }} 
                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-accent-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{dossier.name}</h3>
                    <p className="text-xs font-mono text-accent-primary uppercase tracking-widest">{type?.name || dossier.typeId}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Current Phase</span>
                    <div className="inline-flex px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-slate-300">
                      {dossier.phase}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Last Interaction</span>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Calendar className="w-4 h-4" />
                      {dossier.lastInteraction}
                    </div>
                  </div>

                  {dossier.notes && (
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Field Notes</span>
                      <p className="text-sm text-slate-400 line-clamp-3 bg-[#0a0a0a] p-3 rounded-xl border border-white/5">
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
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-[#151619] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
              <h2 className="text-xl font-bold text-white">{editingId ? 'Edit Dossier' : 'New Dossier'}</h2>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Subject Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-all"
                  placeholder="Enter name or alias..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Personality Type</label>
                  <select
                    value={typeId}
                    onChange={e => setTypeId(e.target.value as any)}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-all appearance-none"
                  >
                    {personalityTypes.map(pt => (
                      <option key={pt.id} value={pt.id}>{pt.name} ({pt.id})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Current Phase</label>
                  <select
                    value={phase}
                    onChange={e => setPhase(e.target.value as Dossier['phase'])}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-all appearance-none"
                  >
                    <option value="Intrigue">Intrigue</option>
                    <option value="Arousal">Arousal</option>
                    <option value="Comfort">Comfort</option>
                    <option value="Devotion">Devotion</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Last Interaction Date</label>
                <input
                  type="date"
                  value={lastInteraction}
                  onChange={e => setLastInteraction(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Field Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-all resize-none"
                  placeholder="Observations, triggers, red flags..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl accent-gradient text-white font-bold shadow-lg shadow-accent-primary/20 hover:scale-105 active:scale-95 transition-all"
                >
                  {editingId ? 'Save Changes' : 'Create Dossier'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
