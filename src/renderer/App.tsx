import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AccountList from './pages/AccountList';
import AccountDetail from './pages/AccountDetail';
import AccountForm from './pages/AccountForm';
import Search from './pages/Search';
import Categories from './pages/Categories';
import CategoryDetail from './pages/CategoryDetail';
import RecurringList from './pages/RecurringList';
import RecurringForm from './pages/RecurringForm';
import Reconcile from './pages/Reconcile';
import BudgetOverview from './pages/BudgetOverview';
import BudgetSetup from './pages/BudgetSetup';
import MobileSync from './pages/MobileSync';
import ClosedAccounts from './pages/ClosedAccounts';
import Insights from './pages/Insights';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/search" element={<Search />} />
        <Route path="/accounts" element={<AccountList />} />
        <Route path="/accounts/new" element={<AccountForm />} />
        <Route path="/accounts/:id" element={<AccountDetail />} />
        <Route path="/accounts/:id/edit" element={<AccountForm />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/categories/:id" element={<CategoryDetail />} />
        <Route path="/recurring" element={<RecurringList />} />
        <Route path="/recurring/new" element={<RecurringForm />} />
        <Route path="/recurring/:id/edit" element={<RecurringForm />} />
        <Route path="/reconcile" element={<Reconcile />} />
        <Route path="/budgets" element={<BudgetOverview />} />
        <Route path="/budgets/setup" element={<BudgetSetup />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/sync" element={<MobileSync />} />
        <Route path="/closed-accounts" element={<ClosedAccounts />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
