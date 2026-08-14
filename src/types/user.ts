export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin' | 'instructor';
  avatar?: string;
  avatarColor?: string;
  authProvider: 'google' | 'email';
  planId: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  lastLoginAt: string;
}

export interface LearningHistoryRecord {
  id: string;
  userId: string;
  lessonId: string;
  lessonTitle: string;
  action: 'theory_read' | 'quiz_passed' | 'code_passed' | 'sprint_passed' | 'final_certified';
  score?: number;
  details?: string;
  timestamp: string;
}

export interface CoursePlan {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  price: number;
  billingPeriod: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  isActive: boolean;
}
