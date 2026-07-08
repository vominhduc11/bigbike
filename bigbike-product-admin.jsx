import React, { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, Search, X, Save, ArrowLeft, Package,
  AlertCircle, Loader2, HardHat, Footprints, Hand, Shirt, Shield, Image,
} from 'lucide-react';

const STORAGE_KEY = 'bigbike-products';

const CATEGORIES = [
  { value: 'helmet', label: 'Mũ bảo hiểm', color: '#3b6e91', Icon: HardHat },
  { value: 'gloves', label: 'Găng tay', color: '#b8863b', Icon: Hand },
  { value: 'armor', label: 'Áo giáp', color: '#5b6470', Icon: Shield },
  { value: 'shoes', label: 'Giày', color: '#2f6b5e', Icon: Footprints },
  { value: 'pants', label: 'Quần bảo hộ', color: '#6d5a7c', Icon: Shirt },
  { value: 'accessories', label: 'Phụ kiện', color: '#8a8478', Icon: Package },
];

const STATUSES = [
  { value: 'selling', label: 'Đang bán', text: '#15803d', bg: '#ecfdf3', dot: '#22c55e' },
  { value: 'draft', label: 'Nháp', text: '#854d0e', bg: '#fefce8', dot: '#eab308' },
  { value: 'discontinued', label: 'Ngừng bán', text: '#52525b', bg: '#f4f4f5', dot: '#a1a1aa' },
];

const CERTIFICATIONS = ['DOT', 'ECE 22.05', 'ECE 22.06', 'SNI', 'Khác'];

const inputClass = 'field-input';

function emptyProduct() {
  return {
    id: null,
    name: '',
    category: '',
    brand: '',
    sku: '',
    status: 'draft',
    price: '',
    comparePrice: '',
    stockQuantity: '',
    sizes: [],
    colors: [],
    shortDescription: '',
    description: '',
    images: [],
    material: '',
    safetyCertification: '',
    weight: '',
  };
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getCategoryMeta(value) {
  return CATEGORIES.find((c) => c.value === value);
}

function getStatusMeta(value) {
  return STATUSES.find((s) => s.value === value) || STATUSES[1];
}

function formatVND(value) {
  const num = Number(value);
  if (!value || isNaN(num)) return '';
  return num.toLocaleString('vi-VN') + ' đ';
}

export default function BigBikeProductAdmin() {
  const [view, setView] = useState('list');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyProduct());
  const [errors, setErrors] = useState({});
  const [sizeInput, setSizeInput] = useState('');
  const [colorInput, setColorInput] = useState('');
  const [toast, setToast] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY, false);
        if (!cancelled && result && result.value) {
          setProducts(JSON.parse(result.value));
        }
      } catch (e) {
        // Chưa có dữ liệu lưu trước đó — bắt đầu với danh mục trống.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  async function persist(next) {
    setProducts(next);
    try {
      const result = await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
      setStorageWarning(!result);
    } catch (e) {
      setStorageWarning(true);
    }
  }

  function openCreate() {
    setForm(emptyProduct());
    setErrors({});
    setSizeInput('');
    setColorInput('');
    setView('form');
  }

  function openEdit(product) {
    setForm({ ...emptyProduct(), ...product });
    setErrors({});
    setSizeInput('');
    setColorInput('');
    setView('form');
  }

  function validate(f) {
    const errs = {};
    if (!f.name.trim()) errs.name = 'Bắt buộc nhập tên sản phẩm';
    if (!f.category) errs.category = 'Bắt buộc chọn danh mục';
    if (f.price === '' || isNaN(Number(f.price)) || Number(f.price) <= 0) {
      errs.price = 'Giá phải là số dương';
    }
    if (f.comparePrice !== '' && (isNaN(Number(f.comparePrice)) || Number(f.comparePrice) < 0)) {
      errs.comparePrice = 'Giá so sánh không hợp lệ';
    }
    if (f.stockQuantity !== '' && (isNaN(Number(f.stockQuantity)) || Number(f.stockQuantity) < 0)) {
      errs.stockQuantity = 'Tồn kho không hợp lệ';
    }
    return errs;
  }

  async function handleSave() {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    const now = new Date().toISOString();
    const cleaned = { ...form, name: form.name.trim() };
    let next;
    if (cleaned.id) {
      next = products.map((p) => (p.id === cleaned.id ? { ...cleaned, updatedAt: now } : p));
    } else {
      next = [{ ...cleaned, id: genId(), createdAt: now, updatedAt: now }, ...products];
    }
    await persist(next);
    setSaving(false);
    setToast(cleaned.id ? 'Đã cập nhật sản phẩm' : 'Đã tạo sản phẩm mới');
    setView('list');
  }

  async function confirmDelete() {
    const next = products.filter((p) => p.id !== deleteTarget.id);
    await persist(next);
    setToast('Đã xóa sản phẩm');
    setDeleteTarget(null);
  }

  function addTag(kind) {
    const value = kind === 'sizes' ? sizeInput.trim() : colorInput.trim();
    if (!value) return;
    setForm((f) => ({ ...f, [kind]: [...f[kind], value] }));
    if (kind === 'sizes') setSizeInput(''); else setColorInput('');
  }

  function removeTag(kind, index) {
    setForm((f) => ({ ...f, [kind]: f[kind].filter((_, i) => i !== index) }));
  }

  function addImageField() {
    setForm((f) => ({ ...f, images: [...f.images, ''] }));
  }

  function updateImageField(index, value) {
    setForm((f) => ({ ...f, images: f.images.map((img, i) => (i === index ? value : img)) }));
  }

  function removeImageField(index) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }));
  }

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen font-body" style={{ background: '#f5f6f7', color: '#17181c' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

        .font-display { font-family: 'Oswald', sans-serif; }
        .font-body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
        .font-mono-data { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .tabular-nums { font-variant-numeric: tabular-nums; }

        .field-input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: #17181c;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .field-input:focus {
          outline: none;
          border-color: #ff0c09;
          box-shadow: 0 0 0 3px rgba(255, 12, 9, 0.15);
        }
        .field-input::placeholder { color: #b0b3ba; }

        .btn-primary { background: #ff0c09; color: #fff; transition: opacity 0.15s ease; }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        button:focus-visible {
          outline: 2px solid #ff0c09;
          outline-offset: 2px;
          border-radius: 4px;
        }

        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }
      `}</style>

      {view === 'list' ? (
        <ListView
          loading={loading}
          products={filtered}
          totalCount={products.length}
          search={search}
          onSearch={setSearch}
          onCreate={openCreate}
          onEdit={openEdit}
          onDeleteRequest={setDeleteTarget}
        />
      ) : (
        <FormView
          form={form}
          errors={errors}
          saving={saving}
          sizeInput={sizeInput}
          colorInput={colorInput}
          onSizeInputChange={setSizeInput}
          onColorInputChange={setColorInput}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onAddImage={addImageField}
          onUpdateImage={updateImageField}
          onRemoveImage={removeImageField}
          onCancel={() => setView('list')}
          onSave={handleSave}
        />
      )}

      {storageWarning && (
        <div
          className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-40 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg"
          style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Không lưu được vào bộ nhớ. Dữ liệu chỉ đang giữ tạm trong phiên này.</span>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg"
          style={{ background: '#17181c' }}
        >
          {toast}
        </div>
      )}

      {deleteTarget && (
        <DeleteModal
          product={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

// ---------- List view ----------

function ListView({ loading, products, totalCount, search, onSearch, onCreate, onEdit, onDeleteRequest }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1 mb-6">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#ff0c09' }} />
          <span className="text-xs font-semibold tracking-widest uppercase text-gray-500">BigBike Admin</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Quản lý sản phẩm
        </h1>
        <p className="text-sm text-gray-500">
          {totalCount} sản phẩm trong danh mục · đồ bảo hộ mô tô
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc SKU..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <button
          onClick={onCreate}
          className="btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Thêm sản phẩm
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Đang tải dữ liệu...
        </div>
      ) : products.length === 0 ? (
        <EmptyState hasSearch={!!search} onCreate={onCreate} />
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((p) => (
            <ProductRow key={p.id} product={p} onEdit={() => onEdit(p)} onDelete={() => onDeleteRequest(p)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ hasSearch, onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center rounded-xl border border-dashed border-gray-300">
      <Package className="w-8 h-8 text-gray-300" />
      <p className="text-sm text-gray-500">
        {hasSearch ? 'Không tìm thấy sản phẩm phù hợp.' : 'Chưa có sản phẩm nào trong danh mục.'}
      </p>
      {!hasSearch && (
        <button
          onClick={onCreate}
          className="text-sm font-semibold underline underline-offset-2"
          style={{ color: '#ff0c09' }}
        >
          Tạo sản phẩm đầu tiên
        </button>
      )}
    </div>
  );
}

function ProductRow({ product, onEdit, onDelete }) {
  const cat = getCategoryMeta(product.category);
  const status = getStatusMeta(product.status);
  const CatIcon = (cat && cat.Icon) || Package;
  const catColor = (cat && cat.color) || '#a1a1aa';
  const lowStock = product.stockQuantity !== '' && Number(product.stockQuantity) <= 5;

  return (
    <li className="flex items-stretch rounded-lg bg-white border border-gray-200 overflow-hidden hover:border-gray-300 transition-colors">
      <div className="w-1 flex-shrink-0" style={{ background: catColor }} />
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-3.5 min-w-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-md"
            style={{ background: `${catColor}1a` }}
          >
            <CatIcon className="w-4 h-4" style={{ color: catColor }} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{product.name || 'Chưa đặt tên'}</p>
            <p className="text-xs text-gray-400 font-mono-data truncate">
              {product.sku || '—'}{product.brand ? ` · ${product.brand}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0 pl-12 sm:pl-0">
          <span className="text-xs text-gray-500 w-20 hidden sm:inline">{(cat && cat.label) || '—'}</span>
          <span className="text-sm font-semibold tabular-nums w-24 text-right">
            {formatVND(product.price) || '—'}
          </span>
          <span
            className={`text-xs tabular-nums w-16 text-right ${lowStock ? 'font-semibold' : 'text-gray-500'}`}
            style={lowStock ? { color: '#b45309' } : undefined}
          >
            {product.stockQuantity !== '' ? `${product.stockQuantity} cái` : '—'}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
            style={{ background: status.bg, color: status.text }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />
            {status.label}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-auto sm:ml-0">
          <button
            onClick={onEdit}
            aria-label={`Sửa ${product.name}`}
            className="p-2 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            aria-label={`Xóa ${product.name}`}
            className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

// ---------- Form view ----------

function SectionCard({ eyebrow, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
      <p className="font-display text-xs font-semibold tracking-widest uppercase text-gray-400 mb-4">
        {eyebrow}
      </p>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Field({ label, required, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-700">
        {label}
        {required && <span style={{ color: '#ff0c09' }}> *</span>}
      </span>
      {children}
      {hint && !error && <span className="text-xs text-gray-400">{hint}</span>}
      {error && (
        <span className="flex items-center gap-1 text-xs" style={{ color: '#dc2626' }}>
          <AlertCircle className="w-3 h-3" />
          {error}
        </span>
      )}
    </div>
  );
}

function TagField({ label, placeholder, items, inputValue, onInputChange, onAdd, onRemove }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onAdd(); }
          }}
          placeholder={placeholder}
          className={inputClass}
        />
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Thêm ${label}`}
          className="flex-shrink-0 px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-gray-100 pl-2.5 pr-1 py-1 text-xs font-medium text-gray-700">
              {item}
              <button onClick={() => onRemove(i)} aria-label={`Xóa ${item}`} className="p-0.5 rounded-full hover:bg-gray-200">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FormView({
  form, errors, saving,
  sizeInput, colorInput, onSizeInputChange, onColorInputChange,
  onAddTag, onRemoveTag, onChange,
  onAddImage, onUpdateImage, onRemoveImage,
  onCancel, onSave,
}) {
  const isHelmet = form.category === 'helmet';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 pb-28">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onCancel}
          aria-label="Quay lại danh sách"
          className="p-2 -ml-2 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-400">
            {form.id ? 'Chỉnh sửa' : 'Sản phẩm mới'}
          </p>
          <h1 className="font-display text-2xl font-semibold">
            {form.name || 'Sản phẩm chưa đặt tên'}
          </h1>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard eyebrow="Thông tin cơ bản">
          <Field label="Tên sản phẩm" required error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="VD: Mũ bảo hiểm fullface SCS Bluetooth"
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Danh mục" required error={errors.category}>
              <select
                value={form.category}
                onChange={(e) => onChange({ category: e.target.value })}
                className={inputClass}
              >
                <option value="">-- Chọn danh mục --</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Thương hiệu">
              <input
                type="text"
                value={form.brand}
                onChange={(e) => onChange({ brand: e.target.value })}
                placeholder="VD: SCS, LS2, Royal..."
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="SKU">
              <input
                type="text"
                value={form.sku}
                onChange={(e) => onChange({ sku: e.target.value })}
                placeholder="VD: BB-HELM-001"
                className={`${inputClass} font-mono-data`}
              />
            </Field>

            <Field label="Trạng thái">
              <div className="flex gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => onChange({ status: s.value })}
                    className="flex-1 rounded-lg px-2 py-2 text-xs font-medium border hover:bg-gray-50 transition-colors"
                    style={
                      form.status === s.value
                        ? { background: s.bg, color: s.text, borderColor: s.dot }
                        : { background: 'white', color: '#9ca3af', borderColor: '#e5e7eb' }
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Giá & tồn kho">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Giá bán (đ)" required error={errors.price} hint={formatVND(form.price)}>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.price}
                onChange={(e) => onChange({ price: e.target.value })}
                placeholder="0"
                className={`${inputClass} tabular-nums`}
              />
            </Field>

            <Field
              label="Giá so sánh (đ)"
              error={errors.comparePrice}
              hint={form.comparePrice ? formatVND(form.comparePrice) : 'Tùy chọn — hiển thị giá gạch ngang'}
            >
              <input
                type="number"
                min="0"
                step="1000"
                value={form.comparePrice}
                onChange={(e) => onChange({ comparePrice: e.target.value })}
                placeholder="0"
                className={`${inputClass} tabular-nums`}
              />
            </Field>
          </div>

          <Field label="Số lượng tồn kho" error={errors.stockQuantity}>
            <input
              type="number"
              min="0"
              step="1"
              value={form.stockQuantity}
              onChange={(e) => onChange({ stockQuantity: e.target.value })}
              placeholder="0"
              className={`${inputClass} tabular-nums sm:w-1/2`}
            />
          </Field>
        </SectionCard>

        <SectionCard eyebrow="Biến thể">
          <TagField
            label="Kích thước"
            placeholder="VD: M, L, XL..."
            items={form.sizes}
            inputValue={sizeInput}
            onInputChange={onSizeInputChange}
            onAdd={() => onAddTag('sizes')}
            onRemove={(i) => onRemoveTag('sizes', i)}
          />
          <TagField
            label="Màu sắc"
            placeholder="VD: Đen nhám, Đỏ BigBike..."
            items={form.colors}
            inputValue={colorInput}
            onInputChange={onColorInputChange}
            onAdd={() => onAddTag('colors')}
            onRemove={(i) => onRemoveTag('colors', i)}
          />
        </SectionCard>

        <SectionCard eyebrow="Nội dung">
          <Field label="Mô tả ngắn">
            <input
              type="text"
              value={form.shortDescription}
              onChange={(e) => onChange({ shortDescription: e.target.value })}
              placeholder="Một câu hiển thị ở danh sách sản phẩm"
              className={inputClass}
            />
          </Field>

          <Field label="Mô tả chi tiết">
            <textarea
              value={form.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={4}
              placeholder="Thông tin đầy đủ về sản phẩm..."
              className={`${inputClass} resize-y`}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">Ảnh sản phẩm</span>
            {form.images.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-10 h-10 flex-shrink-0 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {url ? (
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <Image className="w-4 h-4 text-gray-300" />
                  )}
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => onUpdateImage(i, e.target.value)}
                  placeholder="https://..."
                  className={`${inputClass} flex-1`}
                />
                <button
                  onClick={() => onRemoveImage(i)}
                  aria-label="Xóa ảnh"
                  className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={onAddImage}
              className="self-start inline-flex items-center gap-1.5 text-xs font-semibold mt-1"
              style={{ color: '#ff0c09' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Thêm ảnh
            </button>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Thông số kỹ thuật">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Chất liệu">
              <input
                type="text"
                value={form.material}
                onChange={(e) => onChange({ material: e.target.value })}
                placeholder="VD: Da, Polyester, Nhựa ABS..."
                className={inputClass}
              />
            </Field>

            <Field label="Trọng lượng (g)">
              <input
                type="number"
                min="0"
                value={form.weight}
                onChange={(e) => onChange({ weight: e.target.value })}
                placeholder="0"
                className={`${inputClass} tabular-nums`}
              />
            </Field>
          </div>

          {isHelmet && (
            <Field label="Chứng nhận an toàn" hint="Áp dụng cho mũ bảo hiểm">
              <select
                value={form.safetyCertification}
                onChange={(e) => onChange({ safetyCertification: e.target.value })}
                className={inputClass}
              >
                <option value="">-- Chọn chứng nhận --</option>
                {CERTIFICATIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          )}
        </SectionCard>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 backdrop-blur border-t border-gray-200 px-4 py-3 sm:px-6"
        style={{ background: 'rgba(255,255,255,0.9)' }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100"
          >
            Hủy
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu sản phẩm
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ product, onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onCancel}
    >
      <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-4 h-4" style={{ color: '#dc2626' }} />
          </div>
          <h2 className="font-display text-lg font-semibold">Xóa sản phẩm?</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          "{product.name}" sẽ bị xóa khỏi danh mục. Hành động này không thể hoàn tác.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Hủy
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#dc2626' }}
          >
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}
