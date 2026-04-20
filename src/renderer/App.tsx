import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AccountList from './pages/AccountList';
import AccountDetail from './pages/AccountDetail';
import AccountForm from './pages/AccountForm';
import Categories from './pages/Categories';
import CategoryDetail from './pages/CategoryDetail';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<AccountList />} />
        <Route path="/accounts/new" element={<AccountForm />} />
        <Route path="/accounts/:id" element={<AccountDetail />} />
        <Route path="/accounts/:id/edit" element={<AccountForm />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/categories/:id" element={<CategoryDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
