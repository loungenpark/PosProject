// src/components/admin/StockTab.tsx

import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import * as api from '../../utils/api';
import { MenuItem, StockMovement } from '../../types';
import { MinusCircleIcon, CloseIcon } from '../common/Icons';

// --- Helper Components ---

const ClockIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex justify-center items-center">
            <div className="bg-secondary rounded-lg shadow-xl w-full max-w-lg m-4">
                <div className="flex justify-between items-center p-4 border-b border-accent">
                    <h3 className="text-xl font-semibold text-text-main">{title}</h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-main"><CloseIcon className="w-6 h-6" /></button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};

// --- Main Component ---

const StockTab: React.FC = () => {
    const { menuItems, updateMenuItem, addWaste } = usePos();
    const [localItems, setLocalItems] = useState<MenuItem[]>([]);
    const [isSaving, setIsSaving] = useState<{[key: number]: boolean}>({});

    // Waste Modal State
    const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
    const [wasteItem, setWasteItem] = useState<MenuItem | null>(null);
    const [wasteQuantity, setWasteQuantity] = useState<string>('');
    const [wasteReason, setWasteReason] = useState('');
    const [isSubmittingWaste, setIsSubmittingWaste] = useState(false);

    const handleOpenWasteModal = (item: MenuItem) => {
        setWasteItem(item);
        setWasteQuantity('');
        setWasteReason('');
        setIsWasteModalOpen(true);
    };

    const handleSubmitWaste = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!wasteItem || !wasteQuantity) return;
        
        const qty = parseInt(wasteQuantity, 10);
        if (isNaN(qty) || qty <= 0) {
            alert("Ju lutemi shkruani një sasi të vlefshme.");
            return;
        }

        setIsSubmittingWaste(true);
        try {
            await addWaste(wasteItem.id, qty, wasteReason || 'Humbje (Waste)');
            setIsWasteModalOpen(false);
            setWasteItem(null);
        } catch (error) {
            alert("Regjistrimi i humbjes dështoi.");
        } finally {
            setIsSubmittingWaste(false);
        }
    };

    // History Modal State
    interface AggregatedStockHistory {
        supply: { total: number; details: StockMovement[] };
        waste: { total: number; details: StockMovement[] };
        sale: { total: number; details: StockMovement[] };
    }
    const initialHistoryState: AggregatedStockHistory = {
        supply: { total: 0, details: [] },
        waste: { total: 0, details: [] },
        sale: { total: 0, details: [] },
    };
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyData, setHistoryData] = useState<AggregatedStockHistory>(initialHistoryState);
    const [selectedItemName, setSelectedItemName] = useState('');
    const [expandedCategory, setExpandedCategory] = useState<'supply' | 'waste' | 'sale' | null>(null);

    useEffect(() => {
        setLocalItems([...menuItems].sort((a, b) => a.name.localeCompare(b.name)));
    }, [menuItems]);

    const handleInputChange = (itemId: number, field: 'stock' | 'stockThreshold' | 'trackStock', value: string | boolean) => {
        const changingItem = localItems.find(i => i.id === itemId);
        const targetGroupId = changingItem?.stockGroupId;

        setLocalItems(prev => prev.map(item => {
            const shouldUpdate = item.id === itemId || (targetGroupId && item.stockGroupId === targetGroupId && field === 'stock');
            
            if (shouldUpdate) {
                // LOGIC: If checking the box "Track Stock", automatically set Stock to 0 if it's currently Infinity/Null
                if (field === 'trackStock') {
                    const isEnabled = !!value;
                    if (item.id === itemId) {
                         return { 
                            ...item, 
                            trackStock: isEnabled,
                            // If enabling, force stock to 0. If disabling, leave it (handleSave cleans it up)
                            stock: (isEnabled && (!isFinite(item.stock) || item.stock === null)) ? 0 : item.stock
                         };
                    }
                    return item;
                }

                let finalValue: number;
                if (field === 'stock') {
                    // If user deletes the number, treat as 0 temporarily, unless they type valid number
                    finalValue = value === '' ? 0 : parseInt(value as string, 10);
                } else {
                    finalValue = parseInt(value as string, 10) || 0;
                }
                
                return { ...item, [field]: isNaN(finalValue) ? item[field] : finalValue };
            }
            return item;
        }));
    };

    const handleSave = async (itemId: number) => {
        const itemToSave = localItems.find(item => item.id === itemId);
        if (itemToSave) {
            setIsSaving(prev => ({ ...prev, [itemId]: true }));
            const dataToSave = { ...itemToSave };
            if (!dataToSave.trackStock) {
                dataToSave.stock = Infinity;
                dataToSave.stockThreshold = 0;
            }
            await updateMenuItem(dataToSave);
            setIsSaving(prev => ({ ...prev, [itemId]: false }));
        }
    };

    const handleViewHistory = async (item: MenuItem) => {
        if (!item.trackStock) return;
        setSelectedItemName(item.name);
        setExpandedCategory(null); // Reset expansion on new view
        setIsHistoryOpen(true);
        setHistoryLoading(true);
        try {
            const data = await api.getStockMovements(item.id);
            setHistoryData(data);
        } catch (e) {
            console.error("Failed to fetch history", e);
            setHistoryData(initialHistoryState);
        } finally {
            setHistoryLoading(false);
        }
    };

    return (
        <div className="bg-secondary p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-text-main">Menaxhimi i Stokut</h3>
            <div className="max-h-[75vh] overflow-y-auto">
                <table className="w-full text-left">
                    <thead className="bg-accent sticky top-0 z-10">
                        <tr>
                            <th className="p-3">Artikulli</th>
                            <th className="p-3 w-32">Ndjek Stokun</th>
                            <th className="p-3 w-16 text-center">Hist.</th>
                            <th className="p-3 w-40">Stoku Aktual</th>
                            <th className="p-3 w-40">Pragu i Stokut</th>
                            <th className="p-3 w-32">Veprimet</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-accent">
                        {localItems.map(item => {
                            const isLowStock = item.trackStock && isFinite(item.stock) && item.stockThreshold > 0 && item.stock <= item.stockThreshold;
                            return (
                                <tr key={item.id} className={isLowStock ? 'bg-red-900/40' : ''}>
                                    <td className="p-3">
                                        <div className="flex flex-col">
                                            <span>{item.name}</span>
                                            {item.stockGroupId && (
                                                <span className="text-xs text-blue-400 font-mono mt-0.5">
                                                    🔗 {item.stockGroupId}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <label htmlFor={`track-${item.id}`} className="flex items-center cursor-pointer">
                                            <div className="relative">
                                                <input type="checkbox" id={`track-${item.id}`} className="sr-only" checked={item.trackStock} onChange={(e) => handleInputChange(item.id, 'trackStock', e.target.checked)} />
                                                <div className={`block w-10 h-6 rounded-full ${item.trackStock ? 'bg-highlight' : 'bg-accent'}`}></div>
                                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${item.trackStock ? 'transform translate-x-4' : ''}`}></div>
                                            </div>
                                        </label>
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center space-x-2">
                                            <button 
                                                onClick={() => handleViewHistory(item)}
                                                disabled={!item.trackStock}
                                                className={`p-2 rounded-full transition-colors ${item.trackStock ? 'text-blue-400 hover:bg-blue-900/30' : 'text-gray-600 cursor-not-allowed'}`}
                                                title="Shiko Historikun"
                                            >
                                                <ClockIcon className="w-5 h-5" />
                                            </button>
                                            <button 
                                                onClick={() => handleOpenWasteModal(item)}
                                                disabled={!item.trackStock}
                                                className={`p-2 rounded-full transition-colors ${item.trackStock ? 'text-red-500 hover:bg-red-900/20' : 'text-gray-600 cursor-not-allowed opacity-50'}`}
                                                title="Regjistro Humbje (Waste)"
                                            >
                                                <MinusCircleIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>

                                    <td className="p-3">
                                        <input 
                                            type="number"
                                            value={(item.trackStock && item.stock !== null && isFinite(item.stock)) ? item.stock : ''}
                                            onChange={(e) => handleInputChange(item.id, 'stock', e.target.value)}
                                            placeholder="Pa limit"
                                            min="0"
                                            disabled={!item.trackStock}
                                            className="w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input 
                                            type="number"
                                            value={item.stockThreshold ?? ''}
                                            onChange={(e) => handleInputChange(item.id, 'stockThreshold', e.target.value)}
                                            min="0"
                                            disabled={!item.trackStock}
                                            className="w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <button 
                                            onClick={() => handleSave(item.id)}
                                            disabled={isSaving[item.id]}
                                            className="px-4 py-2 rounded-md bg-highlight text-white text-sm hover:bg-blue-600 disabled:bg-gray-500"
                                        >
                                            {isSaving[item.id] ? '...' : 'Ruaj'}
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* HISTORY MODAL */}
            <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title={`Historiku i Stokut: ${selectedItemName}`}>
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                    {historyLoading ? (
                        <div className="text-center py-8 text-text-secondary">Duke ngarkuar...</div>
                    ) : !historyLoading && historyData.supply.total === 0 && historyData.waste.total === 0 && historyData.sale.total === 0 ? (
                        <div className="text-center py-8 text-text-secondary">Asnjë lëvizje stoku e regjistruar.</div>
                    ) : (
                        <div className="space-y-1">
                            {[
                                { type: 'supply', label: 'Furnizim', data: historyData.supply },
                                { type: 'waste', label: 'Humbje', data: historyData.waste },
                                { type: 'sale', label: 'Shitje', data: historyData.sale }
                            ].map(cat => (
                                <div key={cat.type}>
                                    <div 
                                        onClick={() => setExpandedCategory(prev => prev === cat.type ? null : cat.type as 'supply' | 'waste' | 'sale')}
                                        className={`flex justify-between items-center p-3 rounded-md cursor-pointer transition-all ${
                                            expandedCategory === cat.type ? 'bg-accent rounded-b-none' : 'bg-primary hover:bg-accent/50'
                                        }`}
                                    >
                                        <span className={`font-semibold ${
                                            cat.type === 'supply' ? 'text-green-400' : 
                                            cat.type === 'waste' ? 'text-yellow-400' : 'text-blue-400'
                                        }`}>
                                            {cat.label}
                                        </span>
                                        <span className={`font-mono font-bold text-lg ${
                                            cat.type === 'supply' ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                            {cat.type === 'supply' ? cat.data.total : Math.abs(cat.data.total)}
                                        </span>
                                    </div>
                                    {expandedCategory === cat.type && cat.data.details.length > 0 && (
                                        <div className="bg-primary p-2 rounded-b-md">
                                            <table className="w-full text-left text-sm">
                                                <thead className="text-text-secondary">
                                                    <tr>
                                                        <th className="p-2 font-normal">Data</th>
                                                        {!!localItems.find(i => i.name === selectedItemName)?.stockGroupId && <th className="p-2 font-normal">Artikulli</th>}
                                                        <th className="p-2 font-normal">Detaje</th>
                                                        <th className="p-2 font-normal text-right">Sasia</th>
                                                        <th className="p-2 font-normal">Përdoruesi</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-accent/50">
                                                    {cat.data.details.map((move: any) => (
                                                        <tr key={move.id}>
                                                            <td className="p-2 text-text-secondary whitespace-nowrap">
                                                                {new Date(move.createdAt).toLocaleString('sq-AL', { 
                                                                    month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' 
                                                                })}
                                                            </td>
                                                            {!!localItems.find(i => i.name === selectedItemName)?.stockGroupId && 
                                                                <td className="p-2 text-xs text-text-secondary">
                                                                    {move.itemName !== selectedItemName ? `(${move.itemName})` : ''}
                                                                </td>
                                                            }
                                                            <td className="p-2 max-w-[150px] truncate" title={move.reason}>{move.reason}</td>
                                                            <td className={`p-2 text-right font-mono font-bold ${move.quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {move.quantity > 0 ? '+' : ''}{move.quantity}
                                                            </td>
                                                            <td className="p-2 text-text-secondary text-xs">{move.user || 'System'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            {/* WASTE MODAL */}
            <Modal isOpen={isWasteModalOpen} onClose={() => setIsWasteModalOpen(false)} title={`Regjistro Humbje: ${wasteItem?.name}`}>
                <form onSubmit={handleSubmitWaste} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary">Sasia e Humbur</label>
                        <input 
                            type="number" 
                            min="1"
                            required
                            value={wasteQuantity} 
                            onChange={(e) => setWasteQuantity(e.target.value)} 
                            className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight"
                            placeholder="psh. 2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary">Arsyeja (Opsionale)</label>
                        <input 
                            type="text" 
                            value={wasteReason} 
                            onChange={(e) => setWasteReason(e.target.value)} 
                            className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight"
                            placeholder="psh. U thye, Skadoi..."
                        />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={() => setIsWasteModalOpen(false)} className="px-4 py-2 rounded-md bg-accent text-text-main hover:bg-gray-600">Anulo</button>
                        <button type="submit" disabled={isSubmittingWaste} className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-500">
                            {isSubmittingWaste ? 'Duke regjistruar...' : 'Konfirmo Humbjen'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default StockTab;