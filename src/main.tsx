import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import Student from './pages/Student';
import Result from './pages/Result';
import TeacherLayout from './pages/TeacherLayout';
import Questions from './pages/Questions';
import Records from './pages/Records';
import Editor from './pages/Editor';
import { Footer, Header } from './components/ui';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Student />} />
        <Route path="/questions/:id" element={<Student />} />
        <Route path="/results/:receipt" element={<Result />} />
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
