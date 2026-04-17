import React, { useState } from 'react';
import { Camera, Loader2, User, AlertCircle, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export default function ProfilePhotoUpload() {
  const auth = useAuth();
  if (!auth) return null;
  const { user, updateUserProfile } = auth;
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Basic validation
      if (!file.type.startsWith('image/')) {
        setUploadError("Please select a valid image file.");
        toast.error("Invalid file type.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit for input
        setUploadError("Image is too large. Please select a file under 10MB.");
        toast.error("File too large.");
        return;
      }

      try {
        setIsCompressing(true);
        const options = {
          maxSizeMB: 0.5, // Aim for 500KB
          maxWidthOrHeight: 1024,
          useWebWorker: true
        };

        const compressedFile = await imageCompression(file, options);

        // Convert to base64 for direct upload
        const reader = new FileReader();
        reader.addEventListener('load', async () => {
          const base64Data = reader.result as string;

          // Check size after compression
          const sizeInBytes = (base64Data.length * 3) / 4;
          if (sizeInBytes > 800 * 1024) {
            setUploadError('Image is too large even after compression. Please use a smaller image.');
            toast.error('Image too large');
            setIsCompressing(false);
            return;
          }

          // Upload to storage
          await handleUpload(base64Data);
          setIsCompressing(false);
        });
        reader.addEventListener('error', () => {
          setUploadError("Failed to read the image file.");
          setIsCompressing(false);
        });
        reader.readAsDataURL(compressedFile);
      } catch (error: any) {
        console.error("Error compressing image:", error);
        setUploadError(`Compression failed: ${error.message || 'Unknown error'}`);
        toast.error("Failed to process image.");
        setIsCompressing(false);
      }
    }
  };

  const handleUpload = async (base64Data: string) => {
    if (!user) return;

    try {
      setIsUploading(true);
      setUploadError(null);

      // Convert base64 to blob for upload
      const response = await fetch(base64Data);
      const blob = await response.blob();
      const fileName = `profile-${Date.now()}.jpg`;

      try {
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('user-uploads')
          .upload(`users/${user.id}/${fileName}`, blob, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('user-uploads')
          .getPublicUrl(`users/${user.id}/${fileName}`);

        const publicUrl = urlData.publicUrl;

        // Update user profile in database
        const { error: dbError } = await supabase
          .from('users')
          .update({ photoURL: publicUrl })
          .eq('uid', user.id);

        if (dbError) throw dbError;

        // Update local profile
        try {
          await updateUserProfile({ photoURL: publicUrl });
        } catch (err: any) {
          console.warn("Failed to update local profile, but photo was saved:", err);
        }

        toast.success('Profile photo updated successfully!');
      } catch (storageError: any) {
        console.error("Storage upload failed:", storageError);

        // Fallback: Store base64 directly in database
        console.info("Falling back to database storage");
        try {
          const { error: dbError } = await supabase
            .from('users')
            .update({ photoURL: base64Data })
            .eq('uid', user.id);

          if (dbError) throw dbError;

          try {
            await updateUserProfile({ photoURL: base64Data });
          } catch (err: any) {
            console.warn("Failed to update local profile:", err);
          }

          toast.success('Profile photo updated! (Using database storage)');
        } catch (dbFallbackError: any) {
          console.error("Database fallback also failed:", dbFallbackError);
          throw dbFallbackError;
        }
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      if (error.message?.includes('permission') || error.code === 'PGRST301') {
        setUploadError("Permission denied. Your account may not have permission to update this profile.");
        toast.error("Permission denied.");
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        setUploadError("Network error. Please check your connection and try again.");
        toast.error("Network error.");
      } else {
        setUploadError(error.message || "An error occurred while processing the image.");
        toast.error(error.message || "Processing error.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-4">
      <div 
        className="relative group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Outer Glow Effect - Using radial gradient for better stability and to prevent clipping */}
        <motion.div 
          animate={{ 
            scale: isHovered ? 1.2 : 1,
            opacity: isHovered ? 0.8 : 0.3
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%] pointer-events-none transition-all duration-700 z-0"
          style={{
            background: 'radial-gradient(circle, rgba(255, 75, 107, 0.4) 0%, rgba(255, 75, 107, 0.1) 40%, transparent 70%)'
          }}
        />

        <motion.div 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-mystic-800 group-hover:border-accent-primary/50 transition-all duration-500 shadow-[0_0_40px_rgba(0,0,0,0.6)] z-10 bg-mystic-900"
        >
          <AnimatePresence mode="wait">
            {user?.photoURL ? (
              <motion.img 
                key="photo"
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                src={user.photoURL} 
                alt={user.displayName || 'Profile'} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full flex items-center justify-center"
              >
                <User className="w-16 h-16 text-slate-700" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Shimmer Effect on Hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-700">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
          </div>
          
          <label className="absolute inset-0 bg-mystic-950/80 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-all duration-500 backdrop-blur-md">
            {isCompressing || isUploading ? (
              <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
            ) : (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={isHovered ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
                transition={{ type: "spring", damping: 15 }}
                className="flex flex-col items-center px-4 text-center"
              >
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-accent-primary/20 flex items-center justify-center mb-2 md:mb-3 border border-accent-primary/30 shadow-inner">
                  <Upload className="w-5 h-5 md:w-6 md:h-6 text-accent-primary" />
                </div>
                <span className="text-[9px] md:text-[10px] font-black text-white uppercase tracking-[0.2em] drop-shadow-md leading-tight">Update Photo</span>
              </motion.div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isCompressing || isUploading}
              className="hidden"
            />
          </label>
        </motion.div>
        
        {/* Premium Camera Badge Indicator */}
        <motion.div 
          initial={false}
          animate={{ 
            scale: isHovered ? 1.15 : 1,
            rotate: isHovered ? -10 : 0,
            y: isHovered ? -5 : 0,
            backgroundColor: isHovered ? 'var(--color-accent-primary)' : 'var(--color-mystic-800)',
            boxShadow: isHovered ? '0 10px 25px -5px rgba(255, 75, 107, 0.5)' : '0 4px 15px rgba(0,0,0,0.5)'
          }}
          className="absolute bottom-1 right-1 md:bottom-2 md:right-2 w-11 h-11 bg-mystic-800 text-white rounded-2xl shadow-lg border-2 border-mystic-950 flex items-center justify-center z-20 transition-colors duration-300"
        >
          <Camera className={cn("w-5 h-5 transition-colors", isHovered ? "text-white" : "text-slate-400")} />
        </motion.div>
      </div>
      
      <AnimatePresence>
        {uploadError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 w-max max-w-[280px] bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-xl flex items-start gap-3 z-30 backdrop-blur-md"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-tight">{uploadError}</span>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
