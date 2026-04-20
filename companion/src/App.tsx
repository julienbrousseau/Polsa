import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import AddTransaction from './pages/AddTransaction';
import PendingList from './pages/PendingList';
import Sync from './pages/Sync';

export default function App() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/add" element={<AddTransaction />} />
        <Route path="/add/:accountId" element={<AddTransaction />} />
        <Route path="/pending" element={<PendingList />} />
        <Route path="/sync" element={<Sync />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
