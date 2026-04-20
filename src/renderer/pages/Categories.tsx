import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CategoryWithSubs } from '../../shared/types';

declare global {
  interface Window {
    polsa: any;
  }
}

export default function Categories() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryWithSubs[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubName, setNewSubName] = useState<{ categoryId: number; name: string } | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ id: number; name: string } | null>(null);
  const [editingSub, setEditingSub] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const newCatInputRef = useRef<HTMLInputElement>(null);
  const editCatInputRef = useRef<HTMLInputElement>(null);
  const editSubInputRef = useRef<HTMLInputElement>(null);
  const newSubInputRef = useRef<HTMLInputElement>(null);

  const loadCategories = useCallback(async () => {
    try {
      const data = await window.polsa.categories.list();
      setCategories(data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Focus inputs when editing starts
  useEffect(() => {
    editCatInputRef.current?.focus();
  }, [editingCategory]);
  useEffect(() => {
    editSubInputRef.current?.focus();
  }, [editingSub]);
  useEffect(() => {
    newSubInputRef.current?.focus();
  }, [newSubName]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      setError(null);
      await window.polsa.categories.create({ name });
      setNewCategoryName('');
      await loadCategories();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRenameCategory = async () => {
    if (!editingCategory) return;
    const name = editingCategory.name.trim();
    if (!name) {
      setEditingCategory(null);
      return;
    }
    try {
      setError(null);
      await window.polsa.categories.rename({ id: editingCategory.id, name });
      setEditingCategory(null);
      await loadCategories();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!window.confirm(`Delete category "${name}" and all its subcategories? Transactions will become uncategorised.`)) return;
    try {
      setError(null);
      await window.polsa.categories.delete(id);
      await loadCategories();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCreateSubcategory = async () => {
    if (!newSubName || !newSubName.name.trim()) {
      setNewSubName(null);
      return;
    }
    try {
      setError(null);
      await window.polsa.subcategories.create({ categoryId: newSubName.categoryId, name: newSubName.name.trim() });
      setNewSubName(null);
      // Auto-expand the parent
      setExpanded((prev) => new Set(prev).add(newSubName.categoryId));
      await loadCategories();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRenameSubcategory = async () => {
    if (!editingSub) return;
    const name = editingSub.name.trim();
    if (!name) {
      setEditingSub(null);
      return;
    }
    try {
      setError(null);
      await window.polsa.subcategories.rename({ id: editingSub.id, name });
      setEditingSub(null);
      await loadCategories();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteSubcategory = async (id: number, name: string) => {
    if (!window.confirm(`Delete subcategory "${name}"? Transactions will become uncategorised.`)) return;
    try {
      setError(null);
      await window.polsa.subcategories.delete(id);
      await loadCategories();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h1 className="mb-5 text-sm font-bold uppercase tracking-[0.15em] neon-text-subtle text-[var(--color-accent-light)]">
        Categories
      </h1>

      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 px-4 py-2 text-xs text-[var(--color-negative)]">
          {error}
        </div>
      )}

      {/* New category input */}
      <div className="mb-4 flex gap-2">
        <input
          ref={newCatInputRef}
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
          placeholder="New category name…"
          className="input-cyber flex-1 rounded-lg px-3 py-2 text-xs"
        />
        <button
          onClick={handleCreateCategory}
          disabled={!newCategoryName.trim()}
          className="btn-neon rounded-lg px-4 py-2 text-xs font-semibold tracking-wide disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      {/* Category list */}
      {categories.length === 0 ? (
        <div className="glass-strong rounded-xl p-8 text-center">
          <p className="text-xs text-[var(--color-text-muted)]">
            No categories yet. Create one above to start organising your transactions.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {categories.map((cat) => (
            <div key={cat.id} className="glass-strong rounded-xl overflow-hidden">
              {/* Category row */}
              <div className="flex items-center gap-2 px-3 py-2.5 group">
                <button
                  onClick={() => toggleExpand(cat.id)}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-accent-light)] transition-colors w-4 flex-shrink-0 text-xs"
                >
                  <span className={`inline-block transition-transform ${expanded.has(cat.id) ? 'rotate-90' : ''}`}>▸</span>
                </button>

                {editingCategory?.id === cat.id ? (
                  <input
                    ref={editCatInputRef}
                    type="text"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameCategory();
                      if (e.key === 'Escape') setEditingCategory(null);
                    }}
                    onBlur={handleRenameCategory}
                    className="flex-1 rounded bg-[var(--color-bg-deep)] border border-[var(--color-accent)]/40 px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:shadow-[0_0_8px_rgba(168,85,247,0.2)]"
                  />
                ) : (
                  <span
                    className="flex-1 text-xs font-semibold text-[var(--color-text-primary)] cursor-pointer hover:text-[var(--color-accent-light)] transition-colors"
                    onClick={() => navigate(`/categories/${cat.id}`)}
                    onDoubleClick={() => setEditingCategory({ id: cat.id, name: cat.name })}
                  >
                    {cat.name}
                    <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">
                      ({cat.subcategories.length})
                    </span>
                  </span>
                )}

                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setNewSubName({ categoryId: cat.id, name: '' })}
                    className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/5 transition-colors"
                    title="Add subcategory"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEditingCategory({ id: cat.id, name: cat.name })}
                    className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/5 transition-colors"
                    title="Rename"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-negative)] hover:bg-[var(--color-negative)]/5 transition-colors"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Subcategories (expanded) */}
              {expanded.has(cat.id) && (
                <div className="border-t border-[var(--color-accent)]/5 pl-8 pr-3 py-1">
                  {cat.subcategories.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 py-1.5 group/sub">
                      {editingSub?.id === sub.id ? (
                        <input
                          ref={editSubInputRef}
                          type="text"
                          value={editingSub.name}
                          onChange={(e) => setEditingSub({ ...editingSub, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubcategory();
                            if (e.key === 'Escape') setEditingSub(null);
                          }}
                          onBlur={handleRenameSubcategory}
                          className="flex-1 rounded bg-[var(--color-bg-deep)] border border-[var(--color-accent)]/40 px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:shadow-[0_0_8px_rgba(168,85,247,0.2)]"
                        />
                      ) : (
                        <span
                          className="flex-1 text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-accent-light)] transition-colors"
                          onClick={() => navigate(`/categories/${cat.id}?sub=${sub.id}`)}
                          onDoubleClick={() => setEditingSub({ id: sub.id, name: sub.name })}
                        >
                          {sub.name}
                        </span>
                      )}

                      <div className="flex gap-0.5 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingSub({ id: sub.id, name: sub.name })}
                          className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/5 transition-colors"
                          title="Rename"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteSubcategory(sub.id, sub.name)}
                          className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-negative)] hover:bg-[var(--color-negative)]/5 transition-colors"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* New subcategory input (inline) */}
                  {newSubName?.categoryId === cat.id ? (
                    <div className="flex items-center gap-2 py-1.5">
                      <input
                        ref={newSubInputRef}
                        type="text"
                        value={newSubName.name}
                        onChange={(e) => setNewSubName({ ...newSubName, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateSubcategory();
                          if (e.key === 'Escape') setNewSubName(null);
                        }}
                        onBlur={handleCreateSubcategory}
                        placeholder="Subcategory name…"
                        className="flex-1 rounded bg-[var(--color-bg-deep)] border border-[var(--color-accent)]/40 px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:shadow-[0_0_8px_rgba(168,85,247,0.2)]"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setNewSubName({ categoryId: cat.id, name: '' });
                        setExpanded((prev) => new Set(prev).add(cat.id));
                      }}
                      className="py-1.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent-light)] transition-colors"
                    >
                      + Add subcategory
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
