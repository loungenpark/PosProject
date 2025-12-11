import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import * as api from '../../utils/api';
import { MenuItem, StockMovement } from '../../types';
import {
    ClockIcon,
    BoxIcon,
    PlusIcon,
    TrashIcon,
    MinusCircleIcon,
    CheckIcon,
    ExclamationIcon
} from '../common/Icons';

// --- Types Helper ---
// Since types.ts might not be updated yet, we extend MenuItem locally
type ExtendedMenuItem = MenuItem & { cost_price?: number };

interface ExtendedStockUpdateItem {
    itemId: number;
    quantity: number;
    totalCost?: number; // Total Euro amount for this batch
}

// --- Sub-Components for Tab Navigation ---
const TabButton = ({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) => (
    <button
        onClick={onClick}
        className={`flex items-center space-x-2 px-6 py-3 font-semibold transition-all border-b-2 ${active
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

// --- History Modal Content ---
interface HistoryViewProps {
    item: ExtendedMenuItem;
    onClose: () => void;
}
const HistoryView: React.FC<HistoryViewProps> = ({ item, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        supply: { total: number; details: StockMovement[] };
        waste: { total: number; details: StockMovement[] };
        sale: { total: number; details: StockMovement[] };
        correction: { total: number; details: StockMovement[] };
    }>({
        supply: { total: 0, details: [] },
        waste: { total: 0, details: [] },
        sale: { total: 0, details: [] },
        correction: { total: 0, details: [] } // This was the missing part
    });
    const [expanded, setExpanded] = useState<'supply' | 'waste' | 'sale' | 'correction' | null>(null);

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
                        { type: 'waste', label: 'Humbje', data: data.waste, color: 'text-red-400' },
                        { type: 'correction', label: 'Korrigjim', data: data.correction, color: 'text-purple-400' },
                        { type: 'sale', label: 'Shitje', data: data.sale, color: 'text-blue-400' }
                    ].map(cat => (
                        <div key={cat.type} className="rounded-md overflow-hidden">
                            <div
                                onClick={() => setExpanded(prev => prev === cat.type ? null : cat.type as any)}
                                className={`flex justify-between items-center p-4 cursor-pointer transition-colors ${expanded === cat.type ? 'bg-accent' : 'bg-primary hover:bg-accent/50'}`}
                            >
                                <span className={`font-bold ${cat.color}`}>{cat.label}</span>
                                <span className={`font-mono text-lg font-bold ${cat.data.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {cat.data.total > 0 ? '+' : ''}{cat.data.total}
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
                                                        {new Date(m.createdAt).toLocaleString('sq-AL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                    {data.supply.total === 0 && data.waste.total === 0 && data.sale.total === 0 && data.correction.total === 0 && (
                        <p className="text-center text-text-secondary py-4">S'ka të dhëna.</p>
                    )}
                </div>
            )}
        </Modal>
    );
};

// --- VIEW 1: PASQYRA (OVERVIEW WITH VALUATION) ---
const StockOverview: React.FC<{ items: ExtendedMenuItem[] }> = ({ items }) => {
    const [historyItem, setHistoryItem] = useState<ExtendedMenuItem | null>(null);

    // Filter only tracked items
    const trackedItems = items.filter(i => i.trackStock);

    // --- SMART CALCULATION LOGIC ---
    // We must handle "Shared Stock" groups carefully to avoid double-counting in Totals.
    const { uniqueData, totals } = useMemo(() => {
        const groupMap = new Map<string, { stock: number, cost: number, prices: number[], items: ExtendedMenuItem[] }>();
        const processedItems: Array<ExtendedMenuItem & { calculatedAvgPrice: number }> = [];

        // 1. Group items by StockID or ID
        trackedItems.forEach(item => {
            const key = item.stockGroupId ? `group-${item.stockGroupId}` : `item-${item.id}`;

            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    stock: item.stock || 0,
                    cost: Number(item.cost_price) || 0,
                    prices: [],
                    items: []
                });
            }
            const entry = groupMap.get(key)!;
            entry.prices.push(Number(item.price) || 0);
            entry.items.push(item);
        });

        // 2. Calculate Totals based on UNIQUE groups (Deduplication)
        let totalStock = 0;
        let totalCostValue = 0;
        let totalSalesValue = 0;

        groupMap.forEach((entry) => {
            totalStock += entry.stock;
            totalCostValue += (entry.stock * entry.cost);

            // Average Selling Price for this Group
            const avgPrice = entry.prices.reduce((a, b) => a + b, 0) / entry.prices.length;
            totalSalesValue += (entry.stock * avgPrice);

            // Assign this Average Price to all items in this group for display purposes
            entry.items.forEach(item => {
                processedItems.push({
                    ...item,
                    calculatedAvgPrice: avgPrice
                });
            });
        });

        return {
            uniqueData: processedItems, // Flattened list but with pre-calculated Avg Price
            totals: {
                stock: totalStock,
                costVal: totalCostValue,
                salesVal: totalSalesValue,
                profit: totalSalesValue - totalCostValue
            }
        };
    }, [trackedItems]);

    // Sort by name
    const sortedItems = [...uniqueData].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="h-full overflow-hidden flex flex-col">
            <div className="flex-grow overflow-y-auto rounded-lg border border-accent">
                <table className="w-full text-left text-sm">
                    <thead className="bg-accent sticky top-0 z-10 text-text-secondary font-semibold">
                        <tr>
                            <th className="p-3">Artikulli</th>
                            <th className="p-3 text-center">Historiku</th>
                            <th className="p-3 text-right">Pragu</th>
                            <th className="p-3 text-right">Stoku Aktual</th>
                            <th className="p-3 text-right">Cmimi Blerës</th>
                            <th className="p-3 text-right">Vlera Blerëse</th>
                            <th className="p-3 text-right">Vlera e Shitjes</th>
                            <th className="p-3 text-right">Profit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-accent bg-secondary">
                        {sortedItems.map(item => {
                            const isLow = isFinite(item.stock) && item.stock <= item.stockThreshold;
                            const costPrice = Number(item.cost_price) || 0;
                            const stockVal = item.stock * costPrice;

                            // For sales value, if it's a group, we use the specific item price OR average?
                            // User asked for "Average for shared items". We calculated `calculatedAvgPrice`.
                            const salesVal = item.stock * item.calculatedAvgPrice;
                            const profit = salesVal - stockVal;

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
                                    <td className="p-3 text-right text-text-secondary font-mono">
                                        {item.stockThreshold}
                                    </td>
                                    <td className={`p-3 text-right font-mono font-bold text-lg ${isLow ? 'text-red-500' : 'text-green-500'}`}>
                                        {item.stock}
                                    </td>
                                    <td className="p-3 text-right font-mono text-text-secondary">
                                        {costPrice.toFixed(2)}€
                                    </td>
                                    <td className="p-3 text-right font-mono text-text-main">
                                        {stockVal.toFixed(2)}€
                                    </td>
                                    <td className="p-3 text-right font-mono text-text-main">
                                        {salesVal.toFixed(2)}€
                                    </td>
                                    <td className={`p-3 text-right font-mono font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {profit.toFixed(2)}€
                                    </td>
                                </tr>
                            );
                        })}
                        {trackedItems.length === 0 && (
                            <tr><td colSpan={8} className="p-8 text-center text-text-secondary">Asnjë artikull nuk ndjek stokun.</td></tr>
                        )}
                    </tbody>

                    {/* STICKY FOOTER WITH TOTALS */}
                    <tfoot className="sticky bottom-0 bg-secondary border-t-2 border-accent shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
                        <tr className="font-bold text-text-main">
                            <td className="p-3" colSpan={3}>TOTALET (Artikuj Unik)</td>
                            <td className="p-3 text-right font-mono text-lg text-blue-400">{totals.stock}</td>
                            <td className="p-3"></td>
                            <td className="p-3 text-right font-mono text-lg">{totals.costVal.toFixed(2)}€</td>
                            <td className="p-3 text-right font-mono text-lg">{totals.salesVal.toFixed(2)}€</td>
                            <td className={`p-3 text-right font-mono text-lg ${totals.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {totals.profit.toFixed(2)}€
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            {historyItem && <HistoryView item={historyItem} onClose={() => setHistoryItem(null)} />}
        </div>
    );
};

// --- VIEW 2: FURNIZIMI (SUPPLY WITH COST) ---
interface StockSupplyProps {
    onAlert: (message: string, isError?: boolean) => void;
}

const StockSupply: React.FC<StockSupplyProps> = ({ onAlert }) => {
    const { menuItems, addBulkStock } = usePos();
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<ExtendedStockUpdateItem[]>([]);
    const [supplier, setSupplier] = useState('');
    const [invoiceRef, setInvoiceRef] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Refs for focus management
    const searchInputRef = useRef<HTMLInputElement>(null);
    const qtyRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
    const costRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

    const filtered = menuItems.filter(i => i.trackStock && i.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const addToCart = (item: MenuItem) => {
        if (!cart.find(c => c.itemId === item.id)) {
            setCart(prev => [{ itemId: item.id, quantity: 1, totalCost: 0 }, ...prev]);
        }
        setSearchTerm('');
        // Focus quantity input automatically
        setTimeout(() => qtyRefs.current[item.id]?.select(), 50);
    };

    const updateQty = (id: number, val: number) => {
        setCart(prev => prev.map(c => c.itemId === id ? { ...c, quantity: val } : c));
    };

    const updateTotalCost = (id: number, val: number) => {
        setCart(prev => prev.map(c => c.itemId === id ? { ...c, totalCost: val } : c));
    };

    const handleSave = async () => {
        if (cart.length === 0) return;
        setIsSaving(true);
        try {
            const reason = `Furnizim: ${supplier} ${invoiceRef ? `(#${invoiceRef})` : ''}`.trim();
            // The API now accepts totalCost in the payload
            await addBulkStock(cart as any, reason);
            onAlert("Stoku u përditësua me sukses!", false);
            setCart([]); setSupplier(''); setInvoiceRef('');
        } catch (e) { onAlert("Gabim gjatë ruajtjes.", true); }
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
                    <thead className="bg-accent text-text-secondary sticky top-0">
                        <tr>
                            <th className="p-3">Artikulli</th>
                            <th className="p-3 text-center">Shto Sasi</th>
                            <th className="p-3 text-center">Vlera Totale (€)</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-accent">
                        {cart.map(c => {
                            const item = menuItems.find(i => i.id === c.itemId);
                            return item ? (
                                <tr key={c.itemId}>
                                    <td className="p-3 font-medium">{item.name}</td>

                                    <td className="p-3 text-center">
                                        <input
                                            ref={el => { qtyRefs.current[c.itemId] = el }}
                                            type="number"
                                            value={c.quantity}
                                            onChange={e => updateQty(c.itemId, parseFloat(e.target.value) || 0)}
                                            className="w-24 bg-secondary border-accent rounded p-2 text-center font-bold text-text-main"
                                            placeholder="Sasia"
                                        />
                                    </td>

                                    <td className="p-3 text-center">
                                        <div className="relative inline-block">
                                            <input
                                                ref={el => { costRefs.current[c.itemId] = el }}
                                                type="number"
                                                value={c.totalCost === 0 ? '' : c.totalCost}
                                                onChange={e => updateTotalCost(c.itemId, parseFloat(e.target.value) || 0)}
                                                className="w-28 bg-secondary border-accent rounded p-2 text-center font-bold text-text-main pl-6"
                                                placeholder="0.00"
                                            />
                                            <span className="absolute left-2 top-2 text-text-secondary">€</span>
                                        </div>
                                    </td>

                                    <td className="p-3 text-right">
                                        <button onClick={() => setCart(prev => prev.filter(x => x.itemId !== c.itemId))} className="text-red-400 hover:text-red-300">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ) : null;
                        })}
                        {cart.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-text-secondary">Bosh</td></tr>}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end pt-2 items-center space-x-4">
                <div className="text-text-secondary text-sm">
                    {cart.length} artikuj | Totali: <span className="text-text-main font-bold">
                        {cart.reduce((sum, item) => sum + (item.totalCost || 0), 0).toFixed(2)}€
                    </span>
                </div>
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
    onAlert: (message: string, isError?: boolean) => void;
}

const SingleActionView: React.FC<SingleActionViewProps> = ({ mode, onAlert }) => {
    const { menuItems, addWaste, addBulkStock } = usePos();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [correctionType, setCorrectionType] = useState<'add' | 'remove'>('remove');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filtered = menuItems.filter(i => i.trackStock && i.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem || !quantity) return;
        const qty = parseInt(quantity);
        if (qty <= 0) {
            onAlert("Sasia duhet të jetë më e madhe se 0.", true);
            return;
        }

        setIsSubmitting(true);
        try {
            if (mode === 'waste') {
                // Pass 'waste' type explicitly
                await addWaste(selectedItem.id, qty, reason || 'Humbje (Waste)', 'waste');
            } else {
                const finalReason = `[KORRIGJIM] ${reason}`.trim();
                if (correctionType === 'add') {
                    // Pass 'correction' type for addition
                    await addBulkStock([{ itemId: selectedItem.id, quantity: qty, totalCost: 0 }], finalReason, 'correction');
                } else {
                    // Pass 'correction' type for removal
                    await addWaste(selectedItem.id, qty, finalReason, 'correction');
                }
            }
            onAlert("U regjistrua me sukses!", false);
            setSelectedItem(null); setQuantity(''); setReason(''); setSearchTerm('');
        } catch (err) { onAlert("Veprimi dështoi.", true); }
        setIsSubmitting(false);
    };

    return (
        <div className="max-w-xl mx-auto mt-8 p-6 bg-primary rounded-lg border border-accent shadow-lg">
            <h3 className="text-xl font-bold text-text-main mb-6 flex items-center gap-2">
                {mode === 'waste' ? <MinusCircleIcon className="w-6 h-6 text-red-500" /> : <CheckIcon className="w-6 h-6 text-blue-500" />}
                {mode === 'waste' ? 'Regjistro Humbje' : 'Korrigjo Stokun'}
            </h3>

            <div className="space-y-4">
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
    const [alertConfig, setAlertConfig] = useState<{ show: boolean; message: string; isError: boolean }>({
        show: false, message: '', isError: false
    });

    const triggerAlert = (message: string, isError: boolean = false) => {
        setAlertConfig({ show: true, message, isError });
    };

    return (
        <div className="bg-secondary rounded-lg shadow-sm h-full flex flex-col overflow-hidden relative">
            {/* Navigation Header (Sticky) */}
            <div className="flex border-b border-accent bg-secondary flex-shrink-0 overflow-x-auto sticky top-0 z-20">
                <TabButton active={activeTab === 'pasqyra'} onClick={() => setActiveTab('pasqyra')} label="Pasqyra" icon={<BoxIcon className="w-5 h-5" />} />
                <TabButton active={activeTab === 'furnizimi'} onClick={() => setActiveTab('furnizimi')} label="Furnizimi" icon={<PlusIcon className="w-5 h-5" />} />
                <TabButton active={activeTab === 'humbje'} onClick={() => setActiveTab('humbje')} label="Humbje" icon={<MinusCircleIcon className="w-5 h-5" />} />
                <TabButton active={activeTab === 'korrigjimi'} onClick={() => setActiveTab('korrigjimi')} label="Korrigjimi" icon={<CheckIcon className="w-5 h-5" />} />
            </div>

            {/* Content Area */}
            <div className="flex-grow p-4 overflow-hidden bg-primary/30">
                {activeTab === 'pasqyra' && <StockOverview items={menuItems as ExtendedMenuItem[]} />}
                {activeTab === 'furnizimi' && <StockSupply onAlert={triggerAlert} />}

                {/* Scrollable Wrapper for Forms */}
                {activeTab === 'humbje' && (
                    <div className="h-full overflow-y-auto">
                        <SingleActionView mode="waste" onAlert={triggerAlert} />
                    </div>
                )}
                {activeTab === 'korrigjimi' && (
                    <div className="h-full overflow-y-auto">
                        <SingleActionView mode="correction" onAlert={triggerAlert} />
                    </div>
                )}
            </div>

            {/* Custom Alert Modal */}
            <Modal
                isOpen={alertConfig.show}
                onClose={() => setAlertConfig(prev => ({ ...prev, show: false }))}
                title={alertConfig.isError ? "Gabim" : "Sukses"}
            >
                <div className="flex flex-col items-center space-y-4 p-4">
                    <div className={`p-4 rounded-full ${alertConfig.isError ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-500'}`}>
                        {alertConfig.isError ? <ExclamationIcon className="w-10 h-10" /> : <CheckIcon className="w-10 h-10" />}
                    </div>
                    <p className="text-lg text-center font-medium text-text-main">{alertConfig.message}</p>
                    <button
                        onClick={() => setAlertConfig(prev => ({ ...prev, show: false }))}
                        className={`px-8 py-3 rounded-lg font-bold text-white shadow-md transition-transform active:scale-95 ${alertConfig.isError ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                            }`}
                    >
                        Në Rregull
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default StockTab;