import { useState, useMemo } from 'react';
import { Search, Check, ChevronRight, Globe } from 'lucide-react';
import { COUNTRY_PRESETS, type CountryPreset } from '../../lib/countryPresets';
import { SUPPORTED_CURRENCIES } from '../../lib/currency';

interface Props {
  onClose: () => void;
  onApply: (preset: CountryPreset) => void;
  currentLang: string;
}

const STEP_LABELS = ['Quốc gia', 'Xác nhận', 'Hoàn tất'];

export function RegionalWizardModal({ onClose, onApply, currentLang }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<CountryPreset | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return COUNTRY_PRESETS.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.nameVi.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q),
    );
  }, [search]);

  const currencyLabel = (code: string) => {
    const c = SUPPORTED_CURRENCIES.find(x => x.code === code);
    if (!c) return code;
    return `${c.symbol} ${c.code} — ${currentLang === 'vi' ? c.nameVi : c.name}`;
  };

  const handleApply = () => {
    if (!selected) return;
    onApply(selected);
    setStep(3);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-brand-green/10 border border-brand-green/30 flex items-center justify-center">
              <Globe size={18} className="text-brand-green" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Cài đặt Vùng & Quốc gia</h2>
              <p className="text-xs text-text-secondary">Tự động gợi ý múi giờ, tiền tệ và định dạng theo quốc gia</p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-0">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const done = step > n;
              const active = step === n;
              return (
                <div key={n} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      done ? 'bg-brand-green text-black' :
                      active ? 'bg-brand-green/20 border border-brand-green text-brand-green' :
                      'bg-surface border border-border-subtle text-text-muted'
                    }`}>
                      {done ? <Check size={12} /> : n}
                    </div>
                    <span className={`text-xs font-medium ${active ? 'text-text-primary' : 'text-text-muted'}`}>{label}</span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`flex-1 h-px mx-3 ${step > n ? 'bg-brand-green/40' : 'bg-border-subtle'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* Step 1: Pick country */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Tìm quốc gia..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-surface border border-border-subtle rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-green"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                {filtered.map(p => {
                  const isSelected = selected?.code === p.code;
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => setSelected(p)}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center ${
                        isSelected
                          ? 'border-brand-green bg-brand-green/5 shadow-sm shadow-brand-green/10'
                          : 'border-border-subtle hover:border-brand-green/40 hover:bg-surface'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-brand-green flex items-center justify-center">
                          <Check size={10} className="text-black" />
                        </div>
                      )}
                      <span className="text-2xl leading-none">{p.flag}</span>
                      <span className={`text-xs font-medium leading-tight ${isSelected ? 'text-brand-green' : 'text-text-primary'}`}>
                        {currentLang === 'vi' ? p.nameVi : p.name}
                      </span>
                      <span className="text-[10px] text-text-muted">{p.currency}</span>
                    </button>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <p className="text-center text-text-muted text-sm py-8">Không tìm thấy quốc gia nào.</p>
              )}
            </div>
          )}

          {/* Step 2: Confirm */}
          {step === 2 && selected && (
            <div className="space-y-4">
              {/* Country header */}
              <div className="flex items-center gap-4 p-4 bg-surface rounded-xl border border-border-subtle">
                <span className="text-5xl">{selected.flag}</span>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    {currentLang === 'vi' ? selected.nameVi : selected.name}
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Các cài đặt sau đây sẽ được gợi ý dựa trên quốc gia này.
                  </p>
                </div>
              </div>

              {/* Config preview table */}
              <div className="border border-border-subtle rounded-xl overflow-hidden">
                {[
                  { icon: '🕐', label: 'Múi giờ', value: selected.timezone, detail: '' },
                  { icon: '💰', label: 'Tiền tệ', value: currencyLabel(selected.currency), detail: '' },
                  { icon: '🌐', label: 'Ngôn ngữ', value: selected.language === 'vi' ? 'Tiếng Việt' : 'English (US)', detail: '' },
                  { icon: '📅', label: 'Định dạng ngày', value: selected.dateFormat, detail: 'Ví dụ: ' + new Date().toLocaleDateString('vi-VN') },
                  { icon: '🔢', label: 'Định dạng số', value: selected.numberFormat, detail: `Thập phân: "${selected.numberSeparator.decimal}" · Phân cách nghìn: "${selected.numberSeparator.thousands}"` },
                ].map((row, i) => (
                  <div key={i} className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? 'border-t border-border-subtle' : ''}`}>
                    <span className="text-base w-6 text-center shrink-0">{row.icon}</span>
                    <span className="text-sm text-text-secondary w-36 shrink-0">{row.label}</span>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-text-primary">{row.value}</span>
                      {row.detail && <p className="text-xs text-text-muted mt-0.5">{row.detail}</p>}
                    </div>
                    <Check size={14} className="text-brand-green shrink-0" />
                  </div>
                ))}
              </div>

              {/* Info note */}
              <div className="flex gap-2.5 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <span className="text-blue-400 text-sm shrink-0">💡</span>
                <p className="text-xs text-text-secondary">
                  Đây chỉ là <strong className="text-text-primary">gợi ý</strong> — bạn vẫn có thể điều chỉnh từng cài đặt riêng lẻ sau khi áp dụng.
                  {selected.currency === 'USD' && selected.code !== 'US' && (
                    <span className="block mt-1 text-amber-400">⚠️ Tiền tệ gốc của {selected.nameVi} chưa có trong danh sách — đang dùng USD làm mặc định.</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && selected && (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-brand-green/10 border-2 border-brand-green flex items-center justify-center">
                <Check size={28} className="text-brand-green" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">Đã áp dụng!</h3>
                <p className="text-sm text-text-secondary max-w-sm">
                  Cài đặt vùng cho <strong>{selected.flag} {currentLang === 'vi' ? selected.nameVi : selected.name}</strong> đã được áp dụng.
                  Nhấn <strong>Lưu thay đổi</strong> để lưu vĩnh viễn.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {[selected.timezone, selected.currency, selected.dateFormat].map(v => (
                  <span key={v} className="text-xs px-3 py-1 rounded-full bg-brand-green/10 text-brand-green border border-brand-green/20">{v}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3 border-t border-border-subtle shrink-0 flex items-center justify-between">
          {step === 3 ? (
            <div className="flex-1" />
          ) : (
            <button type="button" onClick={step === 1 ? onClose : () => setStep(s => (s - 1) as 1 | 2 | 3)}
              className="px-4 py-2 text-sm text-text-secondary border border-border-subtle rounded-lg hover:text-text-primary">
              {step === 1 ? 'Huỷ' : '← Quay lại'}
            </button>
          )}

          {step === 1 && (
            <button type="button" disabled={!selected} onClick={() => setStep(2)}
              className="px-5 py-2 text-sm bg-brand-green text-black font-medium rounded-lg disabled:opacity-40 flex items-center gap-2">
              Tiếp theo <ChevronRight size={14} />
            </button>
          )}
          {step === 2 && (
            <button type="button" onClick={handleApply}
              className="px-5 py-2 text-sm bg-brand-green text-black font-medium rounded-lg flex items-center gap-2">
              <Check size={14} /> Áp dụng gợi ý
            </button>
          )}
          {step === 3 && (
            <button type="button" onClick={onClose}
              className="px-6 py-2 text-sm bg-brand-green text-black font-medium rounded-lg">
              Đóng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
