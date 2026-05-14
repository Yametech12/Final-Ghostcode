export interface UserData {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  bio?: string;
  contactInfo?: {
    phone?: string;
    instagram?: string;
    twitter?: string;
  };
  role: 'user' | 'admin';
  createdAt: any;
  lastLoginAt?: any;
}

export interface Favorite {
  id?: string;
  userId: string;
  contentId: string;
  contentType: "type" | "guide" | "calibration";
  category: "Personality" | "Content" | "Assessment";
  title: string;
  timestamp: any;
}
