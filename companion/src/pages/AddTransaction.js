import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAllAccounts, getAllCategories, getAllSubcategories, addPendingTransaction } from '../db';
import { todayISO } from '../lib/format';
export default function AddTransaction() {
    const { accountId: paramAccountId } = useParams();
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [date, setDate] = useState(todayISO());
    const [amountStr, setAmountStr] = useState('');
    const [isExpense, setIsExpense] = useState(true);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        Promise.all([getAllAccounts(), getAllCategories(), getAllSubcategories()]).then(([accs, cats, subs]) => {
            setAccounts(accs);
            setCategories(cats);
            setSubcategories(subs);
            if (paramAccountId) {
                const id = parseInt(paramAccountId, 10);
                if (accs.some(a => a.id === id)) {
                    setSelectedAccountId(id);
                }
            }
            else if (accs.length > 0) {
                setSelectedAccountId(accs[0].id);
            }
        });
    }, [paramAccountId]);
    const filteredSubs = selectedCategoryId
        ? subcategories.filter(s => s.categoryId === selectedCategoryId)
        : [];
    const handleSave = async () => {
        setError('');
        if (!selectedAccountId) {
            setError('Please select an account');
            return;
        }
        if (!amountStr) {
            setError('Please enter an amount');
            return;
        }
        if (!date) {
            setError('Please enter a date');
            return;
        }
        const parsedAmount = Math.round(parseFloat(amountStr) * 100);
        if (isNaN(parsedAmount) || parsedAmount === 0) {
            setError('Please enter a valid amount');
            return;
        }
        const finalAmount = isExpense ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
        setSaving(true);
        try {
            await addPendingTransaction({
                id: crypto.randomUUID(),
                accountId: selectedAccountId,
                date,
                amount: finalAmount,
                subcategoryId: selectedSubcategoryId ? selectedSubcategoryId : null,
                description: description.trim(),
                createdAt: new Date().toISOString(),
                synced: false,
            });
            navigate('/');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save transaction');
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs("div", { className: "flex flex-col min-h-[100dvh]", children: [_jsxs("header", { className: "glass border-b border-[var(--color-border-glass)] px-4 py-4 flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "text-[var(--color-accent-light)] text-sm", children: "\u2190 Back" }), _jsx("h1", { className: "text-base font-bold text-[var(--color-text-primary)]", children: "New Transaction" })] }), _jsxs("div", { className: "flex-1 overflow-y-auto px-4 py-4 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5", children: "Account" }), _jsxs("select", { value: selectedAccountId, onChange: e => setSelectedAccountId(e.target.value ? parseInt(e.target.value, 10) : ''), className: "input-cyber w-full rounded-xl px-4 py-3 text-sm", children: [_jsx("option", { value: "", children: "Select account..." }), accounts.map(a => (_jsx("option", { value: a.id, children: a.name }, a.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5", children: "Date" }), _jsx("input", { type: "date", value: date, onChange: e => setDate(e.target.value), className: "input-cyber w-full rounded-xl px-4 py-3 text-sm" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5", children: "Amount" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", onClick: () => setIsExpense(!isExpense), className: `rounded-xl px-4 py-3 text-sm font-bold shrink-0 transition-colors ${isExpense
                                            ? 'bg-[var(--color-negative)]/20 text-[var(--color-negative)] border border-[var(--color-negative)]/30'
                                            : 'bg-[var(--color-positive)]/20 text-[var(--color-positive)] border border-[var(--color-positive)]/30'}`, children: isExpense ? '−' : '+' }), _jsx("input", { type: "number", inputMode: "decimal", step: "0.01", min: "0", placeholder: "0.00", value: amountStr, onChange: e => setAmountStr(e.target.value), className: "input-cyber flex-1 rounded-xl px-4 py-3 text-lg font-mono tabular-nums" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5", children: "Category" }), _jsxs("select", { value: selectedCategoryId, onChange: e => {
                                    const val = e.target.value ? parseInt(e.target.value, 10) : '';
                                    setSelectedCategoryId(val);
                                    setSelectedSubcategoryId('');
                                }, className: "input-cyber w-full rounded-xl px-4 py-3 text-sm", children: [_jsx("option", { value: "", children: "None" }), categories.map(c => (_jsx("option", { value: c.id, children: c.name }, c.id)))] })] }), filteredSubs.length > 0 && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5", children: "Subcategory" }), _jsxs("select", { value: selectedSubcategoryId, onChange: e => setSelectedSubcategoryId(e.target.value ? parseInt(e.target.value, 10) : ''), className: "input-cyber w-full rounded-xl px-4 py-3 text-sm", children: [_jsx("option", { value: "", children: "None" }), filteredSubs.map(s => (_jsx("option", { value: s.id, children: s.name }, s.id)))] })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5", children: "Note" }), _jsx("input", { type: "text", value: description, onChange: e => setDescription(e.target.value), placeholder: "e.g. Coffee at Starbucks", className: "input-cyber w-full rounded-xl px-4 py-3 text-sm" })] })] }), _jsxs("div", { className: "sticky bottom-0 px-4 py-3 safe-area-bottom bg-[var(--color-bg-base)]/90 backdrop-blur-sm border-t border-[var(--color-border-glass)]", children: [error && (_jsx("p", { className: "text-xs text-[var(--color-negative)] text-center mb-2", children: error })), _jsx("button", { onClick: handleSave, disabled: saving, className: "btn-neon w-full py-3.5 rounded-xl text-sm font-medium disabled:opacity-40", children: saving ? 'Saving...' : 'Save Transaction' })] })] }));
}
//# sourceMappingURL=AddTransaction.js.map