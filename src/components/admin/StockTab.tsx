import React, { useState, useEffect, useRef } from 'react';
import { usePos } from '../../context/PosContext';
import * as api from '../../utils/api';
import { MenuItem, StockMovement, StockUpdateItem } from '../../types';
import { 
    ClockIcon, 
    BoxIcon, 
    PlusIcon, 
    TrashIcon, 
    MinusCircleIcon, 
    CheckIcon, 
    ExclamationIcon 
} from '../common/Icons';

// --- Sub-Components for Tab Navigation ---
const TabButton = ({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) => (
    <button 
        onClick={onClick} 
        className={`flex items-center space-x-2 px-6 py-3 font-semibold transition-all border-b-2 ${
            active 
            ? 'border-highlight text-highlight bg-highlight/10' 
            : 'border-transparent text-text-secondary hover:text-text-main hover:bg-accent/50'
        }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

// --- Modal Component ---
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex justify-center items-center">
            <div className="bg-secondary rounded-lg shadow-xl w-full max-w-lg m-4 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-accent flex-shrink-0">
                    <h3 className="text-xl font-semibold text-text-main">{title}</h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-main text-2xl">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};

// --- History Modal Content (Aggregated) ---
interface HistoryViewProps {
    item: MenuItem;
    onClose: () => void;
}
const HistoryView: React.FC<HistoryViewProps> = ({ item, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        supply: { total: number; details: StockMovement[] };
        waste: { total: number; details: StockMovement[] };
        sale: { total: number; details: StockMovement[] };
    }>({ supply: { total: 0, details: [] }, waste: { total: 0, details: [] }, sale: { total: 0, details: [] } });
    const [expanded, setExpanded] = useState<'supply' | 'waste' | 'sale' | null>(null);

    useEffect(() => {
        api.getStockMovements(item.id).then(setData).finally(() => setLoading(false));
    }, [item.id]);

    return (
        <Modal isOpen={true} onClose={onClose} title={`Historiku: ${item.name}`}>
            {loading ? (
                <div className="text-center py-8 text-text-secondary">Duke ngarkuar...</div>
            ) : (
                <div className="space-y-2">
                    {[
                        { type: 'supply', label: 'Furnizim', data: data.supply, color: 'text-green-400' },
                        { type: 'waste', label: 'Humbje', data: data.waste, color: 'text-yellow-400' },
                        { type: 'sale', label: 'Shitje', data: data.sale, color: 'text-blue-400' }
                    ].map(cat => (
                        <div key={cat.type} className="rounded-md overflow-hidden">
                            <div 
                                onClick={() => setExpanded(prev => prev === cat.type ? null : cat.type as any)}
                                className={`flex justify-between items-center p-4 cursor-pointer transition-colors ${expanded === cat.type ? 'bg-accent' : 'bg-primary hover:bg-accent/50'}`}
                            >
                                <span className={`font-bold ${cat.color}`}>{cat.label}</span>
                                <span className={`font-mono text-lg font-bold ${cat.type === 'supply' ? 'text-green-400' : 'text-red-400'}`}>
                                    {cat.type === 'supply' ? '+' : '-'}{Math.abs(cat.data.total)}
                                </span>
                            </div>
                            {expanded === cat.type && cat.data.details.length > 0 && (
                                <div className="bg-primary border-t border-accent p-2">
                                    <table className="w-full text-left text-sm">
                                        <thead className="text-text-secondary">
                                            <tr>
                                                <th className="p-2">Data</th>
                                                <th className="p-2">Detaje</th>
                                                <th className="p-2 text-right">Sasia</th>
                                                <th className="p-2">User</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-accent/30">
                                            {cat.data.details.map((m: any) => (
                                                <tr key={m.id}>
                                                    <td className="p-2 whitespace-nowrap text-text-secondary">
                                                        {new Date(m.createdAt).toLocaleString('sq-AL', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                                                    </td>
                                                    <td className="p-2 text-text-secondary truncate max-w-[150px]">{m.reason}</td>
                                                    <td className={`p-2 text-right font-mono font-bold ${m.quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                                                    </td>
                                                    <td className="p-2 text-xs text-text-secondary">{m.user || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                    {data.supply.total === 0 && data.waste.total === 0 && data.sale.total === 0 && (
                        <p className="text-center text-text-secondary py-4">S'ka të dhëna.</p>
                    )}
                </div>
            )}
        </Modal>
    );
};

// --- VIEW 1: PASQYRA (OVERVIEW) ---
const StockOverview: React.FC<{ items: MenuItem[] }> = ({ items }) => {
    const [historyItem, setHistoryItem] = useState<MenuItem | null>(null);

    // Filter only tracked items for cleaner view
    const trackedItems = items.filter(i => i.trackStock);

    return (
        <div className="h-full overflow-hidden flex flex-col">
            <div className="flex-grow overflow-y-auto rounded-lg border border-accent">
                <table className="w-full text-left">
                    <thead className="bg-accent sticky top-0 z-10 text-text-secondary font-semibold">
                        <tr>
                            <th className="p-3">Artikulli</th>
                            <th className="p-3 text-center">Historiku</th>
                            <th className="p-3 text-right">Stoku Aktual</th>
                            <th className="p-3 text-right">Pragu</th>
                            <th className="p-3 text-center">Statusi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-accent bg-secondary">
                        {trackedItems.map(item => {
                            const isLow = isFinite(item.stock) && item.stock <= item.stockThreshold;
                            return (
                                <tr key={item.id} className={`hover:bg-primary/50 transition-colors ${isLow ? 'bg-red-900/10' : ''}`}>
                                    <td className="p-3">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-text-main">{item.name}</span>
                                            {item.stockGroupId && <span className="text-xs text-blue-400 font-mono">🔗 {item.stockGroupId}</span>}
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button onClick={() => setHistoryItem(item)} className="p-2 rounded-full text-blue-400 hover:bg-blue-900/20 transition-colors">
                                            <ClockIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                    <td className={`p-3 text-right font-mono font-bold text-lg ${isLow ? 'text-red-500' : 'text-green-500'}`}>
                                        {item.stock}
                                    </td>
                                    <td className="p-3 text-right text-text-secondary font-mono">
                                        {item.stockThreshold}
                                    </td>
                                    <td className="p-3 text-center">
                                        {isLow ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-red-900/50 text-red-400 border border-red-800">
                                                <ExclamationIcon className="w-3 h-3 mr-1" /> ULET
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-green-900/30 text-green-400 border border-green-800">
                                                OK
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {trackedItems.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-text-secondary">Asnjë artikull nuk ndjek stokun.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {historyItem && <HistoryView item={historyItem} onClose={() => setHistoryItem(null)} />}
        </div>
    );
};

// --- VIEW 2: FURNIZIMI (SUPPLY) ---
const StockSupply: React.FC = () => {
    const { menuItems, addBulkStock } = usePos();
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<StockUpdateItem[]>([]);
    const [supplier, setSupplier] = useState('');
    const [invoiceRef, setInvoiceRef] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const qtyRefs = useRef<{[key: number]: HTMLInputElement | null}>({});

    const filtered = menuItems.filter(i => i.trackStock && i.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const addToCart = (item: MenuItem) => {
        if (!cart.find(c => c.itemId === item.id)) {
            setCart(prev => [{ itemId: item.id, quantity: 1 }, ...prev]);
        }
        setSearchTerm('');
        setTimeout(() => qtyRefs.current[item.id]?.select(), 50);
    };

    const updateQty = (id: number, val: number) => {
        setCart(prev => prev.map(c => c.itemId === id ? { ...c, quantity: val } : c));
    };

    const handleSave = async () => {
        if (cart.length === 0) return;
        setIsSaving(true);
        try {
            const reason = `Furnizim: ${supplier} ${invoiceRef ? `(#${invoiceRef})` : ''}`.trim();
            await addBulkStock(cart, reason);
            alert("Stoku u përditësua me sukses!");
            setCart([]); setSupplier(''); setInvoiceRef('');
        } catch (e) { alert("Gabim gjatë ruajtjes."); }
        setIsSaving(false);
    };

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Furnitori" value={supplier} onChange={e => setSupplier(e.target.value)} className="bg-primary border-accent rounded p-2 text-text-main" />
                <input type="text" placeholder="Nr. Faturës" value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} className="bg-primary border-accent rounded p-2 text-text-main" />
            </div>
            <div className="relative">
                <input ref={searchInputRef} type="text" placeholder="Kërko artikull..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-primary border-accent rounded p-3 pl-10 text-text-main focus:ring-highlight" />
                {searchTerm && (
                    <div className="absolute top-full w-full bg-secondary border border-accent shadow-xl max-h-60 overflow-y-auto z-50">
                        {filtered.map(item => (
                            <button key={item.id} onClick={() => addToCart(item)} className="w-full text-left p-3 hover:bg-highlight hover:text-white border-b border-accent flex justify-between">
                                <span>{item.name}</span><span className="opacity-70">{item.stock}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="flex-grow overflow-y-auto bg-primary border border-accent rounded-lg">
                <table className="w-full text-left">
                    <thead className="bg-accent text-text-secondary sticky top-0"><tr><th className="p-3">Artikulli</th><th className="p-3">Shto Sasi</th><th className="p-3"></th></tr></thead>
                    <tbody className="divide-y divide-accent">
                        {cart.map(c => {
                            const item = menuItems.find(i => i.id === c.itemId);
                            return item ? (
                                <tr key={c.itemId}>
                                    <td className="p-3">{item.name}</td>
                                    <td className="p-3"><input ref={el => { qtyRefs.current[c.itemId] = el }} type="number" value={c.quantity} onChange={e => updateQty(c.itemId, parseInt(e.target.value)||0)} className="w-24 bg-secondary border-accent rounded p-1 text-center font-bold text-text-main" /></td>
                                    <td className="p-3 text-right"><button onClick={() => setCart(prev => prev.filter(x => x.itemId !== c.itemId))} className="text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button></td>
                                </tr>
                            ) : null;
                        })}
                        {cart.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-text-secondary">Bosh</td></tr>}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-end pt-2">
                <button onClick={handleSave} disabled={cart.length === 0 || isSaving} className="px-6 py-3 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50">
                    {isSaving ? 'Duke ruajtur...' : 'Ruaj Furnizimin'}
                </button>
            </div>
        </div>
    );
};

// --- VIEW 3 & 4: HUMBJE (WASTE) & KORRIGJIM (CORRECTION) ---
interface SingleActionViewProps {
    mode: 'waste' | 'correction';
}

const SingleActionView: React.FC<SingleActionViewProps> = ({ mode }) => {
    const { menuItems, addWaste, addBulkStock } = usePos();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [correctionType, setCorrectionType] = useState<'add' | 'remove'>('remove'); // For correction only
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filtered = menuItems.filter(i => i.trackStock && i.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem || !quantity) return;
        const qty = parseInt(quantity);
        if (qty <= 0) return alert("Sasia duhet të jetë më e madhe se 0.");

        setIsSubmitting(true);
        try {
            if (mode === 'waste') {
                await addWaste(selectedItem.id, qty, reason || 'Humbje (Waste)');
            } else {
                // Correction Mode
                const finalReason = `[KORRIGJIM] ${reason}`.trim();
                if (correctionType === 'add') {
                    await addBulkStock([{ itemId: selectedItem.id, quantity: qty }], finalReason);
                } else {
                    await addWaste(selectedItem.id, qty, finalReason);
                }
            }
            alert("U regjistrua me sukses!");
            setSelectedItem(null); setQuantity(''); setReason(''); setSearchTerm('');
        } catch (err) { alert("Dështoi."); }
        setIsSubmitting(false);
    };

    return (
        <div className="max-w-xl mx-auto mt-8 p-6 bg-primary rounded-lg border border-accent shadow-lg">
            <h3 className="text-xl font-bold text-text-main mb-6 flex items-center gap-2">
                {mode === 'waste' ? <MinusCircleIcon className="w-6 h-6 text-red-500"/> : <CheckIcon className="w-6 h-6 text-blue-500"/>}
                {mode === 'waste' ? 'Regjistro Humbje' : 'Korrigjo Stokun'}
            </h3>
            
            <div className="space-y-4">
                {/* 1. Item Selection */}
                {!selectedItem ? (
                    <div className="relative">
                        <label className="block text-sm text-text-secondary mb-1">Kërko Artikull</label>
                        <input type="text" autoFocus value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-secondary border-accent rounded p-3 text-text-main focus:ring-highlight" placeholder="Shkruaj emrin..." />
                        {searchTerm && (
                            <div className="absolute top-full w-full bg-secondary border border-accent shadow-xl max-h-48 overflow-y-auto z-10 mt-1 rounded">
                                {filtered.map(item => (
                                    <button key={item.id} onClick={() => { setSelectedItem(item); setSearchTerm(''); }} className="w-full text-left p-3 hover:bg-highlight hover:text-white border-b border-accent">
                                        {item.name} <span className="opacity-60 text-sm">({item.stock})</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-between bg-secondary p-3 rounded border border-accent">
                        <div>
                            <span className="font-bold text-lg text-text-main">{selectedItem.name}</span>
                            <div className="text-sm text-text-secondary">Stoku Aktual: {selectedItem.stock}</div>
                        </div>
                        <button onClick={() => setSelectedItem(null)} className="text-sm text-highlight hover:underline">Ndrysho</button>
                    </div>
                )}

                {/* 2. Correction Type (Only for Correction Mode) */}
                {mode === 'correction' && selectedItem && (
                    <div className="flex gap-4">
                        <label className={`flex-1 p-3 rounded border cursor-pointer text-center font-bold transition-colors ${correctionType === 'add' ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-secondary border-accent text-text-secondary'}`}>
                            <input type="radio" name="ctype" className="hidden" checked={correctionType === 'add'} onChange={() => setCorrectionType('add')} />
                            + Shto (Gjetur)
                        </label>
                        <label className={`flex-1 p-3 rounded border cursor-pointer text-center font-bold transition-colors ${correctionType === 'remove' ? 'bg-red-900/30 border-red-500 text-red-400' : 'bg-secondary border-accent text-text-secondary'}`}>
                            <input type="radio" name="ctype" className="hidden" checked={correctionType === 'remove'} onChange={() => setCorrectionType('remove')} />
                            - Zbrit (Humbur)
                        </label>
                    </div>
                )}

                {/* 3. Quantity & Reason */}
                {selectedItem && (
                    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <div>
                            <label className="block text-sm text-text-secondary mb-1">Sasia {mode === 'correction' ? '(Për t\'u korrigjuar)' : '(E Humbur)'}</label>
                            <input type="number" min="1" required autoFocus value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full bg-secondary border-accent rounded p-3 text-2xl font-bold text-center text-text-main focus:ring-highlight" placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-sm text-text-secondary mb-1">Arsyeja / Shënim</label>
                            <input type="text" value={reason} onChange={e => setReason(e.target.value)} className="w-full bg-secondary border-accent rounded p-3 text-text-main focus:ring-highlight" placeholder={mode === 'waste' ? "psh. U thye" : "psh. Numërim fizik"} />
                        </div>
                        <button disabled={isSubmitting} className={`w-full py-4 rounded-lg font-bold text-white shadow-lg transition-transform active:scale-95 ${mode === 'waste' || (mode === 'correction' && correctionType === 'remove') ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                            {isSubmitting ? '...' : 'Konfirmo'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

// --- MAIN STOCK TAB COMPONENT ---
const StockTab: React.FC = () => {
    const { menuItems } = usePos();
    const [activeTab, setActiveTab] = useState<'pasqyra' | 'furnizimi' | 'humbje' | 'korrigjimi'>('pasqyra');

    return (
        <div className="bg-secondary rounded-lg shadow-sm h-full flex flex-col overflow-hidden">
            {/* Navigation Header */}
            <div className="flex border-b border-accent bg-secondary flex-shrink-0 overflow-x-auto">
                <TabButton active={activeTab === 'pasqyra'} onClick={() => setActiveTab('pasqyra')} label="Pasqyra" icon={<BoxIcon className="w-5 h-5"/>} />
                <TabButton active={activeTab === 'furnizimi'} onClick={() => setActiveTab('furnizimi')} label="Furnizimi" icon={<PlusIcon className="w-5 h-5"/>} />
                <TabButton active={activeTab === 'humbje'} onClick={() => setActiveTab('humbje')} label="Humbje" icon={<MinusCircleIcon className="w-5 h-5"/>} />
                <TabButton active={activeTab === 'korrigjimi'} onClick={() => setActiveTab('korrigjimi')} label="Korrigjimi" icon={<CheckIcon className="w-5 h-5"/>} />
            </div>

            {/* Content Area */}
            <div className="flex-grow p-4 overflow-hidden bg-primary/30">
                {activeTab === 'pasqyra' && <StockOverview items={menuItems} />}
                {activeTab === 'furnizimi' && <StockSupply />}
                {activeTab === 'humbje' && <SingleActionView mode="waste" />}
                {activeTab === 'korrigjimi' && <SingleActionView mode="correction" />}
            </div>
        </div>
    );
};

export default StockTab;