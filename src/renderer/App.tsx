import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AccountList from './pages/AccountList';
import AccountDetail from './pages/AccountDetail';
import AccountForm from './pages/AccountForm';
import Categories from './pages/Categories';
import CategoryDetail from './pages/CategoryDetail';
import RecurringList from './pages/RecurringList';
import RecurringForm from './pages/RecurringForm';

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
        <Route path="/recurring" element={<RecurringList />} />
        <Route path="/recurring/new" element={<RecurringForm />} />
        <Route path="/recurring/:id/edit" element={<RecurringForm />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
