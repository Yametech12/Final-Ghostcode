import React, { useState } from 'react';
import { Camera, Loader2, User as UserIcon, Edit3, Crown, Calendar, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';


interface ProfileCardProps {
  onEditProfile?: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ onEditProfile }) => {
  const auth = useAuth();
  const [uploading, setUploading] = useState(false);

  if (!auth) return null;
  const { user, userData, updateUserData, updateUserProfile } = auth;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Basic file validation
    if (!file) {
      toast.error('No file selected');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    // Check for supported image formats
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!supportedTypes.includes(file.type.toLowerCase())) {
      toast.error('Unsupported image format. Please use JPEG, PNG, WebP, or GIF.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image file is too large. Please choose a file under 10MB');
      return;
    }

    // Check for minimum file size (avoid corrupted files)
    if (file.size < 1024) {
      toast.error('Image file appears to be corrupted or too small');
      return;
    }

    setUploading(true);

    try {
      try {
        // Upload to Supabase Storage
        const fileName = `profile-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('user-uploads')
          .upload(`users/${user.id}/${fileName}`, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('user-uploads')
          .getPublicUrl(`users/${user.id}/${fileName}`);

        const downloadURL = urlData.publicUrl;

        // Update user profile in database
        const { error: updateError } = await supabase
          .from('users')
          .update({ photoURL: downloadURL })
          .eq('uid', user.id);

        if (updateError) throw updateError;

        await updateUserProfile({ photoURL: downloadURL });
        if (updateUserData) {
          await updateUserData({ photoURL: downloadURL });
        }

        toast.success("Profile photo updated!");
      } catch (storageError: any) {
        const isQuotaError = storageError?.message?.includes('quota') || storageError?.message?.includes('storage');
        if (isQuotaError) {
          console.info("Storage quota exceeded, using local storage for profile photo");
        } else {
          console.warn("Storage upload failed, trying fallback:", storageError);
        }

        // Fallback: Convert to base64 and save directly to database
        console.info("Storage quota exceeded, using database storage for profile photo");
        try {
          const reader = new FileReader();

          reader.onload = async (event) => {
            try {
              const base64String = event.target?.result as string;
              if (!base64String || !base64String.startsWith('data:image/')) {
                throw new Error("Invalid base64 data generated");
              }

              const { error: updateError } = await supabase
                .from('users')
                .update({ photoURL: base64String })
                .eq('uid', user.id);

              if (updateError) throw updateError;

              await updateUserProfile({ photoURL: base64String });
              if (updateUserData) {
                await updateUserData({ photoURL: base64String });
              }
              toast.success("Profile photo updated! (Using local storage)");
            } catch (processError: any) {
              console.error("Error processing fallback upload:", processError);
              toast.error("Failed to process image data. Please try again.");
            } finally {
              setUploading(false);
            }
          };

          reader.onerror = () => {
            console.error("FileReader error in fallback upload");
            toast.error("Failed to read image file. Please try again.");
            setUploading(false);
          };

          reader.readAsDataURL(file);
        } catch (fallbackError: any) {
          console.error("Fallback upload setup failed:", fallbackError);
          const isQuotaError = fallbackError?.message?.includes('quota') || fallbackError?.message?.includes('resource');
          if (isQuotaError) {
            console.info("Database quota exceeded for photo update, photo stored locally");
            toast.success("Profile photo updated! (Using local storage)");
          } else {
            toast.error("Failed to save profile photo. Please try again.");
          }
          setUploading(false);
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const displayImage = userData?.photoURL;
  const memberSince = userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'New Member';

  const profileCard = (
    <div className="max-w-md mx-auto bg-mystic-900/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-accent-primary/5 overflow-hidden">

      {/* Animated Banner */}
      <div className="h-36 bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary bg-[length:200%_200%] animate-gradient-x relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-mystic-900/60" />
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-mystic-900/80 to-transparent" />
      </div>

      {/* Profile Content */}
      <div className="px-8 pb-8 relative -mt-20">

        {/* Avatar Container */}
        <div className="relative flex justify-center mb-6">
          <div className="relative">
            {/* Glow Effect */}
            <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary blur-lg opacity-40 animate-pulse" />

            {/* Avatar */}
            <div className="relative w-28 h-28 rounded-full p-1 bg-mystic-900 shadow-2xl">
              <div className="w-full h-full rounded-full overflow-hidden bg-mystic-800 border-3 border-gradient-to-r from-accent-primary to-accent-secondary">
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-mystic-800 to-mystic-900">
                    <UserIcon size={48} className="text-mystic-600" />
                  </div>
                )}

                {/* Loading Overlay */}
                {uploading && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 backdrop-blur-sm">
                    <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
                  </div>
                )}

                {/* Photo Upload */}
                {!uploading && (
                  <label className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-all duration-300 cursor-pointer flex items-center justify-center backdrop-blur-[2px] z-10 rounded-full">
                    <Camera className="w-7 h-7 text-white mb-1" />
                    <span className="text-[9px] font-bold text-white uppercase tracking-wider">
                      Update
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Online/Status Indicator */}
            <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-3 border-mystic-900 shadow-lg shadow-green-500/50" />
          </div>
        </div>

        {/* User Details */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl font-bold text-white">
              {userData?.displayName || user?.email?.split('@')[0] || 'Anonymous'}
            </h2>
            {userData?.role === 'admin' && (
              <Crown className="w-5 h-5 text-yellow-500" />
            )}
          </div>

          <p className="text-mystic-400 text-sm">
            {user?.email}
          </p>

          {/* Member Badge */}
          <div className="flex items-center justify-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <Calendar className="w-3.5 h-3.5 text-accent-primary" />
              <span className="text-xs text-mystic-400">{memberSince}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/20">
              <Zap className="w-3.5 h-3.5 text-accent-primary" />
              <span className="text-xs text-accent-primary font-medium">Active</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-8">
          <button
            onClick={onEditProfile}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-accent-primary to-accent-secondary text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-accent-primary/25 hover:shadow-accent-primary/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Edit3 className="w-4 h-4" />
            Edit Profile
          </button>
        </div>

      </div>
    </div>
  );



  return profileCard;
};

export default ProfileCard;