import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Phone, Instagram, Twitter, Save, Loader2, Upload, Camera } from 'lucide-react';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import ImageCropper from './ImageCropper';

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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cropperImage, setCropperImage] = useState<string | null>(null); // URL for cropper

  const { userData, updateUserData, updateUserProfile } = auth || {};

  // Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

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

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    // Open cropper with the selected image
    const url = URL.createObjectURL(file);
    setCropperImage(url);
    // Reset the input so the same file can be re-selected
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    // Close cropper
    if (cropperImage) {
      URL.revokeObjectURL(cropperImage);
      setCropperImage(null);
    }

    // Auto-upload
    if (!userData?.id) return;
    setUploadingPhoto(true);
    try {
      // Compress and convert to WebP for smaller upload size
      const { compressImage } = await import('../utils/imageCompression');
      const compressedDataUrl = await compressImage(croppedBlob, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 800,
        preferWebP: true,
      });

      // Convert compressed data URL back to a File
      const compressedResponse = await fetch(compressedDataUrl);
      const compressedBlob = await compressedResponse.blob();
      const ext = compressedBlob.type === 'image/webp' ? 'webp' : 'jpg';
      const compressedFile = new File([compressedBlob], `profile-${Date.now()}.${ext}`, { type: compressedBlob.type });

      setPhotoFile(compressedFile);
      setPhotoPreview(URL.createObjectURL(compressedBlob));

      const fileName = `${userData.id}/profile-${Date.now()}.${ext}`;
      const { error } = await supabase
        .storage
        .from('user-uploads')
        .upload(fileName, compressedFile, {
          contentType: compressedBlob.type,
          upsert: false
        });
      if (error) throw error;

      const { data: { publicUrl } } = supabase
        .storage
        .from('user-uploads')
        .getPublicUrl(fileName);

      setPhotoUrl(publicUrl);
      setPhotoPreview(publicUrl);
      await updateUserProfile({ photoURL: publicUrl });
      toast.success('Profile photo updated!');
    } catch (error: any) {
      console.error('Photo upload error:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCropCancel = () => {
    if (cropperImage) {
      URL.revokeObjectURL(cropperImage);
      setCropperImage(null);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoUrl(null);
    setPhotoPreview(null);
    if (userData?.id) {
      updateUserProfile({ photoURL: undefined });
    }
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
      setPhotoUrl(userData.photoURL);
      setPhotoPreview(userData.photoURL);
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
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen && !cropperImage) return null;

  const modalPortal = isOpen ? createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
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
          <div className="p-6 border-b border-slate-700/30 flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-100">
              <User aria-hidden="true" className="w-5 h-5 text-accent-primary" />
              Edit Profile
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X aria-hidden="true" className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide" data-lenis-prevent>
            {/* Photo Upload Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  Profile Photo
                </label>
                <div className="flex items-center gap-2">
               <button
                 type="button"
                 onClick={() => document.getElementById('photo-input')?.click()}
                 disabled={uploadingPhoto}
                 className={`flex items-center gap-2 px-3 py-2 bg-white/5 border rounded-lg text-sm font-medium 
                  ${uploadingPhoto ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10 transition-colors'}`}
                 aria-label="Change profile photo"
               >
                 <Upload className="w-4 h-4" aria-hidden="true" />
                 {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
               </button>
               {photoUrl && (
                 <button
                   type="button"
                   onClick={handleRemovePhoto}
                   className="flex items-center gap-2 px-3 py-2 bg-white/5 border rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/20 hover:text-white transition-colors"
                   aria-label="Remove profile photo"
                 >
                   <X className="w-4 h-4" aria-hidden="true" />
                   Remove
                 </button>
               )}
                </div>
              </div>
              
              <input
                type="file"
                id="photo-input"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoChange}
              />
              
              {/* Photo Preview */}
              {photoPreview && (
                <div className="relative aspect-square w-full bg-white/5 rounded-xl overflow-hidden">
                  <img
                    src={photoPreview}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                  {uploadingPhoto && (
                    <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
              )}
              
              {!photoPreview && userData?.photoURL && (
                <div className="relative aspect-square w-full bg-white/5 rounded-xl overflow-hidden">
                  <img
                    src={userData.photoURL}
                    alt="Current profile photo"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              {!photoPreview && !userData?.photoURL && (
                <div className="relative aspect-square w-full bg-white/5 rounded-xl flex items-center justify-center text-slate-500">
                  <Camera className="w-8 h-8 opacity-50" />
                  <p className="mt-2 text-[12px]">No photo selected</p>
                </div>
              )}
            </div>
            
            {/* Form Fields */}
            <div className="space-y-4">
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
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  ) : null;

  // Render cropper portal separately when active
  const cropperPortal = cropperImage ? createPortal(
    <ImageCropper
      imageUrl={cropperImage}
      onCrop={handleCropComplete}
      onCancel={handleCropCancel}
    />,
    document.body
  ) : null;

  return (
    <>
      {modalPortal}
      {cropperPortal}
    </>
  );
}
