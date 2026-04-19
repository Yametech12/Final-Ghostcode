import React from 'react';
import { User as UserIcon, Edit3, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';


interface ProfileCardProps {
  onEditProfile?: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ onEditProfile }) => {
  const auth = useAuth();

  if (!auth) return null;
  const { user, userData } = auth;

  const displayImage = userData?.photoURL;

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
              </div>
            </div>

            {/* Online/Status Indicator */}
            <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-3 border-mystic-900 shadow-lg shadow-green-500/50" />
          </div>
        </div>

      </div>
    </div>
  );

  return profileCard;
};

export default ProfileCard;