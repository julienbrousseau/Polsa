import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import AddTransaction from './pages/AddTransaction';
import PendingList from './pages/PendingList';
import Sync from './pages/Sync';
export default function App() {
    return (_jsx("div", { className: "flex flex-col min-h-[100dvh]", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Home, {}) }), _jsx(Route, { path: "/add", element: _jsx(AddTransaction, {}) }), _jsx(Route, { path: "/add/:accountId", element: _jsx(AddTransaction, {}) }), _jsx(Route, { path: "/pending", element: _jsx(PendingList, {}) }), _jsx(Route, { path: "/sync", element: _jsx(Sync, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }));
}
//# sourceMappingURL=App.js.map