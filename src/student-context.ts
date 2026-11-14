import { createContext, useContext } from 'react';
import type { StudentProfile } from '../shared/model';

export const StudentContext = createContext<{
  student: StudentProfile;
  logout: () => Promise<void>;
} | null>(null);
export function useStudent() {
  const context = useContext(StudentContext);
  if (!context) throw new Error('学生页面需要先登录');
  return context;
}
