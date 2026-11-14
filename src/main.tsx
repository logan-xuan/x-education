import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import Student from './pages/Student';
import Result from './pages/Result';
import TeacherLayout from './pages/TeacherLayout';
import Questions from './pages/Questions';
import Records from './pages/Records';
import Editor from './pages/Editor';
import StudentLayout from './pages/StudentLayout';
import StudentLogin from './pages/StudentLogin';
import StudentWork from './pages/StudentWork';
import { Footer, Header } from './components/ui';
import './styles.css';
import './student-theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<StudentLogin />} />
        <Route element={<StudentLayout />}>
          <Route path="/" element={<Student />} />
          <Route path="/questions/:id" element={<Student />} />
          <Route path="/results/:receipt" element={<Result />} />
          <Route path="/my-submissions" element={<StudentWork />} />
        </Route>
        <Route path="/teacher" element={<TeacherLayout />}>
          <Route index element={<Questions />} />
          <Route path="records" element={<Records />} />
          <Route path="questions/new" element={<Editor />} />
          <Route path="questions/:id/edit" element={<Editor />} />
        </Route>
        <Route
          path="*"
          element={
            <>
              <Header />
              <main className="empty-state">
                <h1>页面没有找到</h1>
                <p>请检查链接，或返回课堂任务。</p>
                <Link to="/" className="button">
                  返回课堂任务
                </Link>
              </main>
              <Footer />
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
