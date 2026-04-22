import { useRef, useState, useEffect } from 'react';
import { X, Download, Share2, Check, Crown, Zap, FileText, Award } from 'lucide-react';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import Logo from './Logo';

interface ProfileCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentsCount: number;
  achievementsCount?: number;
  fieldReportsCount?: number;
}

export default function ProfileCardModal({ isOpen, onClose, assessmentsCount, achievementsCount = 0, fieldReportsCount = 0 }: ProfileCardModalProps) {
  const auth = useEnhancedAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  const { user, userData } = auth || {};

  useEffect(() => {
    if (!isOpen) return;
    
    const loadPhoto = async () => {
      const sourceUrl = user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || 'O'}&background=random`;
      
      if (sourceUrl.startsWith('data:')) {
        setPhotoDataUrl(sourceUrl);
        return;
      }

      const fetchAsBase64 = async (url: string): Promise<string> => {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      try {
        const base64 = await fetchAsBase64(sourceUrl);
        setPhotoDataUrl(base64);
      } catch {
        try {
          const fallbackUrl = `https://ui-avatars.com/api/?name=${user?.displayName || 'O'}&background=random`;
          const fallbackBase64 = await fetchAsBase64(fallbackUrl);
          setPhotoDataUrl(fallbackBase64);
        } catch {
          setPhotoDataUrl('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        }
      }
    };

    loadPhoto();
  }, [isOpen, user?.photoURL, user?.displayName]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: '#0f0f1a',
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `epimetheus-profile-${user?.displayName || 'operative'}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Profile card downloaded!');
    } catch (error: any) {
      console.error('Error generating card:', error);
      toast.error(`Failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyLink = () => {
    const profileLink = `${window.location.origin}/profiles`;
    navigator.clipboard.writeText(profileLink);
    setCopied(true);
    toast.success('Profile link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-mystic-950/90 backdrop-blur-md">
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-end">
          <button 
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* The Card */}
        <div 
          ref={cardRef}
          className="relative overflow-hidden rounded-3xl bg-mystic-900 border border-white/10 p-6 sm:p-8 shadow-2xl"
        >
          {/* Background Effects */}
          <div className="absolute top-[-30%] right-[-20%] w-[80%] h-[80%] bg-accent-primary/20 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-30%] left-[-20%] w-[80%] h-[80%] bg-accent-secondary/20 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <Logo size="sm" className="glow-accent" />
              <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-accent-primary/20 to-accent-secondary/20 border border-accent-primary/30">
                <span className="text-[10px] font-bold text-accent-primary uppercase tracking-widest">Operative</span>
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/10 shadow-lg">
                  <img 
                    src={photoDataUrl || user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || 'O'}&background=random`} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                </div>
                {userData?.role === 'admin' && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-lg flex items-center justify-center shadow-lg">
                    <Crown className="w-3.5 h-3.5 text-black" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white truncate">{userData?.displayName || 'Operative'}</h2>
                </div>
                <p className="text-xs text-accent-primary font-mono truncate mt-1">{user?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-[9px] text-green-400 font-medium">Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bio */}
            {userData?.bio && (
              <p className="text-sm text-slate-300 italic border-l-2 border-accent-primary/50 pl-4">
                "{userData.bio}"
              </p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                <FileText className="w-4 h-4 mx-auto text-accent-primary mb-1" />
                <div className="text-lg font-black text-white">{assessmentsCount}</div>
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Calibrate</div>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                <Zap className="w-4 h-4 mx-auto text-accent-secondary mb-1" />
                <div className="text-lg font-black text-white">{fieldReportsCount}</div>
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Reports</div>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                <Award className="w-4 h-4 mx-auto text-yellow-500 mb-1" />
                <div className="text-lg font-black text-white">{achievementsCount}</div>
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Badges</div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-2">
              <p className="text-[9px] text-slate-600 font-mono tracking-widest">EPIMETHEUS SYSTEM • {new Date().getFullYear()}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            disabled={isExporting || !photoDataUrl}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary text-white font-bold shadow-lg shadow-accent-primary/25 hover:shadow-accent-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Generating...' : 'Download Card'}
          </button>
          <button
            onClick={handleCopyLink}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Share Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
