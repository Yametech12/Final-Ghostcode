import React, { useState } from 'react';
import { User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';

interface ProfileCardProps {
  onEditProfile?: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ onEditProfile }) => {
  const auth = useAuth();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  if (!auth) return null;
  const { user, userData } = auth;

  const displayImage = userData?.photoURL;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / 25;
    const y = (e.clientY - rect.top - rect.height / 2) / 25;
    setMousePosition({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
    setIsHovering(false);
  };

  return (
    <motion.div
      className="max-w-md mx-auto bg-mystic-900/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-accent-primary/5 overflow-hidden cursor-pointer group"
      style={{
        transform: isHovering 
          ? `perspective(1000px) rotateX(${-mousePosition.y}deg) rotateY(${mousePosition.x}deg) translateY(-8px)`
          : 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)',
        transition: 'transform 0.15s ease-out, box-shadow 0.3s ease'
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={handleMouseLeave}
    >
      {/* Animated Banner with parallax */}
      <div className="h-40 relative overflow-hidden">
        <motion.div 
          className="absolute inset-0 bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary bg-[length:200%_200%]"
          animate={{ 
            backgroundPosition: ['0% 50%', '200% 50%', '0% 50%'] 
          }}
          transition={{ 
            duration: 8, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          style={{
            transform: isHovering 
              ? `translateX(${mousePosition.x * 2}px) translateY(${mousePosition.y * 2}px) scale(1.1)`
              : 'translateX(0) translateY(0) scale(1)',
            transition: 'transform 0.15s ease-out'
          }}
        />
        
        {/* Atmospheric glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-mystic-900/80" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-mystic-900/90 to-transparent" />
        
        {/* Floating particles */}
        {isHovering && (
          <>
            <motion.div 
              className="absolute w-2 h-2 rounded-full bg-white/30 blur-sm"
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 1, 0], y: -40 }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ left: '20%' }}
            />
            <motion.div 
              className="absolute w-1.5 h-1.5 rounded-full bg-accent-primary/40 blur-sm"
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 1, 0], y: -30 }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
              style={{ left: '60%' }}
            />
            <motion.div 
              className="absolute w-1 h-1 rounded-full bg-white/20 blur-sm"
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 1, 0], y: -50 }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
              style={{ left: '80%' }}
            />
          </>
        )}
      </div>

      {/* Profile Content */}
      <div className="px-8 pb-8 relative -mt-20">
        {/* Avatar Container with parallax */}
        <div className="relative flex justify-center mb-6">
          <motion.div 
            className="relative"
            style={{
              transform: isHovering 
                ? `translateY(${mousePosition.y * -1.5}px) translateX(${mousePosition.x * 0.5}px) scale(1.05)`
                : 'translateY(0) translateX(0) scale(1)',
              transition: 'transform 0.15s ease-out'
            }}
          >
            {/* Animated Glow Effect */}
            <motion.div 
              className="absolute -inset-4 rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary blur-xl"
              animate={{ 
                opacity: isHovering ? [0.4, 0.6, 0.4] : [0.2, 0.3, 0.2],
                scale: isHovering ? [1, 1.1, 1] : [1, 1.05, 1]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            {/* Avatar */}
            <motion.div 
              className="relative w-32 h-32 rounded-full p-1.5 bg-mystic-900 shadow-2xl"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-mystic-800 border-2 border-gradient-to-r from-accent-primary to-accent-secondary">
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-mystic-800 to-mystic-900">
                    <UserIcon size={56} className="text-mystic-600" />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Online/Status Indicator with pulse animation */}
            <motion.div 
              className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-mystic-900 shadow-lg shadow-green-500/50"
              animate={{ 
                scale: [1, 1.2, 1],
                boxShadow: [
                  '0 0 0 0 rgba(34, 197, 94, 0.4)',
                  '0 0 0 10px rgba(34, 197, 94, 0)',
                  '0 0 0 0 rgba(34, 197, 94, 0)'
                ]
              }}
              transition={{ 
                duration: 2.5, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileCard;