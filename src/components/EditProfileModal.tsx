import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Phone, Instagram, Twitter, Save, Loader2 } from 'lucide-react';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { toast } from 'sonner';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const auth = useEnhancedAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    phone: '',
    instagram: '',
    twitter: '',
  });

  const { userData, updateUserData } = auth || {};

  const validateField = (name: string, value: string) => {
    const newErrors = { ...errors };

    switch (name) {
      case 'displayName':
        if (!value.trim()) {
          newErrors.displayName = 'Display name is required';
        } else if (value.length > 50) {
          newErrors.displayName = 'Must be less than 50 characters';
        } else {
          delete newErrors.displayName;
        }
        break;
      case 'bio':
        if (value.length > 500) {
          newErrors.bio = 'Must be less than 500 characters';
        } else {
          delete newErrors.bio;
        }
        break;
      case 'phone':
        if (value && !/^[+]?[\d\s\-\(\)]{10,}$/.test(value)) {
          newErrors.phone = 'Invalid phone number format';
        } else {
          delete newErrors.phone;
        }
        break;
      case 'instagram':
        if (value && !/^@?[a-zA-Z0-9._]{1,30}$/.test(value)) {
          newErrors.instagram = 'Invalid Instagram username';
        } else {
          delete newErrors.instagram;
        }
        break;
      case 'twitter':
        if (value && !/^@?[a-zA-Z0-9_]{1,15}$/.test(value)) {
          newErrors.twitter = 'Invalid Twitter username';
        } else {
          delete newErrors.twitter;
        }
        break;
    }

    setErrors(newErrors);
  };

  const handleFieldChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  useEffect(() => {
    if (userData) {
      setFormData({
        displayName: userData.displayName || '',
        bio: userData.bio || '',
        phone: userData.contactInfo?.phone || '',
        instagram: userData.contactInfo?.instagram || '',
        twitter: userData.contactInfo?.twitter || '',
      });
    }
  }, [userData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.displayName.trim()) {
      toast.error('Display name is required');
      return;
    }

    if (formData.displayName.length > 50) {
      toast.error('Display name must be less than 50 characters');
      return;
    }

    if (formData.bio && formData.bio.length > 500) {
      toast.error('Bio must be less than 500 characters');
      return;
    }

    setLoading(true);
    try {
      await updateUserData({
        displayName: formData.displayName.trim(),
        bio: formData.bio.trim(),
        contactInfo: {
          phone: formData.phone.trim(),
          instagram: formData.instagram.trim(),
          twitter: formData.twitter.trim(),
        }
      });
      toast.success('Profile updated successfully');
      onClose();
      onClose();
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
      />
      
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <User className="w-5 h-5 text-accent-primary" />
            Edit Profile
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide" data-lenis-prevent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Display Name</label>
                <span className={`text-[9px] ${formData.displayName.length > 50 ? 'text-red-400' : 'text-slate-500'}`}>
                  {formData.displayName.length}/50
                </span>
              </div>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => handleFieldChange('displayName', e.target.value)}
                className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white focus:outline-none transition-colors ${
                  errors.displayName
                    ? 'border-red-500/50 focus:border-red-500'
                    : 'border-white/10 focus:border-accent-primary/50'
                }`}
                placeholder="Your name"
                maxLength={50}
              />
              {errors.displayName && (
                <p className="text-[9px] text-red-400">{errors.displayName}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Bio</label>
                <span className={`text-[9px] ${formData.bio.length > 500 ? 'text-red-400' : 'text-slate-500'}`}>
                  {formData.bio.length}/500
                </span>
              </div>
              <textarea
                value={formData.bio}
                onChange={(e) => handleFieldChange('bio', e.target.value)}
                className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white focus:outline-none min-h-[100px] resize-none transition-colors ${
                  errors.bio
                    ? 'border-red-500/50 focus:border-red-500'
                    : 'border-white/10 focus:border-accent-primary/50'
                }`}
                placeholder="A short bio about yourself..."
                maxLength={500}
              />
              {errors.bio && (
                <p className="text-[9px] text-red-400">{errors.bio}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    className={`w-full bg-white/5 border rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none transition-colors ${
                      errors.phone
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-white/10 focus:border-accent-primary/50'
                    }`}
                    placeholder="+1 234..."
                  />
                </div>
                {errors.phone && (
                  <p className="text-[9px] text-red-400">{errors.phone}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Instagram</label>
                <div className="relative">
                  <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={formData.instagram}
                    onChange={(e) => handleFieldChange('instagram', e.target.value)}
                    className={`w-full bg-white/5 border rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none transition-colors ${
                      errors.instagram
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-white/10 focus:border-accent-primary/50'
                    }`}
                    placeholder="@username"
                  />
                </div>
                {errors.instagram && (
                  <p className="text-[9px] text-red-400">{errors.instagram}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Twitter / X</label>
              <div className="relative">
                <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={formData.twitter}
                  onChange={(e) => handleFieldChange('twitter', e.target.value)}
                  className={`w-full bg-white/5 border rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none transition-colors ${
                    errors.twitter
                      ? 'border-red-500/50 focus:border-red-500'
                      : 'border-white/10 focus:border-accent-primary/50'
                  }`}
                  placeholder="@username"
                />
              </div>
              {errors.twitter && (
                <p className="text-[9px] text-red-400">{errors.twitter}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-4 rounded-xl accent-gradient text-white font-bold shadow-lg shadow-accent-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
