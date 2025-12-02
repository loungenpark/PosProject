import React, { useState, useEffect, useRef } from 'react';
import { usePos } from '../context/PosContext';
import { MenuItem, StockUpdateItem } from '../types';
import { PlusIcon, TrashIcon, BoxIcon } from './common/Icons';

const StockSupply: React.FC = () => {
    const { menuItems, addBulkStock } = usePos();
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<StockUpdateItem[]>([]);
    const [supplier, setSupplier] = useState('');
    const [invoiceRef, setInvoiceRef] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    // For auto-focus logic
    const searchInputRef = useRef<HTMLInputElement>(null);
    const quantityInputRefs = useRef<{[key: number]: HTMLInputElement | null}>({});

    // Filter items based on search
    const filteredItems = menuItems.filter(item => 
        item.trackStock && 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddItem = (item: MenuItem) => {
        // Check if already in cart
        if (cart.some(c => c.itemId === item.id)) {
            // Focus on that item's quantity input if already exists
            quantityInputRefs.current[item.id]?.focus();
            setSearchTerm('');
            return;
        }

        const newItem: StockUpdateItem = { itemId: item.id, quantity: 1 };
        setCart(prev => [newItem, ...prev]);
        setSearchTerm(''); // Clear search to be ready for next
        
        // Focus on the new item's quantity input after render
        setTimeout(() => {
            quantityInputRefs.current[item.id]?.select();
        }, 50);
    };

    const handleQuantityChange = (itemId: number, val: string) => {
        const qty = parseInt(val) || 0;
        setCart(prev => prev.map(item => item.itemId === itemId ? { ...item, quantity: qty } : item));
    };

    const handleRemoveItem = (itemId: number) => {
        setCart(prev => prev.filter(item => item.itemId !== itemId));
    };

    const handleKeyDown = (e: React.KeyboardEvent, itemId: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchInputRef.current?.focus(); // Jump back to search for speed
        }
    };

    const handleSave = async () => {
        if (cart.length === 0) return alert("Shtoni të paktën një artikull.");
        if (!supplier && !invoiceRef) {
            if (!confirm("A jeni të sigurt pa shënuar Furnitorin ose Faturën?")) return;
        }

        setIsSaving(true);
        try {
            const reason = `Furnizim: ${supplier} ${invoiceRef ? `(#${invoiceRef})` : ''}`.trim();
            await addBulkStock(cart, reason);
            alert("Stoku u përditësua me sukses!");
            setCart([]);
            setSupplier('');
            setInvoiceRef('');
        } catch (error) {
            alert("Gabim gjatë ruajtjes.");
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to get name from ID
    const getName = (id: number) => menuItems.find(i => i.id === id)?.name || 'Unknown';
    const getCurrentStock = (id: number) => menuItems.find(i => i.id === id)?.stock || 0;

    return (
        <div className="bg-secondary p-6 rounded-lg h-full flex flex-col">
            <h3 className="text-xl font-semibold mb-6 text-text-main flex items-center gap-2">
                <BoxIcon className="w-6 h-6"/> Furnizim i Ri (Hyrje Malli)
            </h3>

            {/* 1. Header Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-primary p-4 rounded-lg">
                <div>
                    <label className="block text-sm text-text-secondary mb-1">Furnitori</label>
                    <input 
                        type="text" 
                        placeholder="Emri i Furnitorit (psh. Makro)" 
                        className="w-full bg-secondary border-accent rounded p-2 text-text-main focus:ring-highlight focus:border-highlight"
                        value={supplier}
                        onChange={e => setSupplier(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm text-text-secondary mb-1">Nr. Faturës / Referenca</label>
                    <input 
                        type="text" 
                        placeholder="#12345" 
                        className="w-full bg-secondary border-accent rounded p-2 text-text-main focus:ring-highlight focus:border-highlight"
                        value={invoiceRef}
                        onChange={e => setInvoiceRef(e.target.value)}
                    />
                </div>
            </div>

            {/* 2. Search Bar */}
            <div className="relative mb-6">
                <input 
                    ref={searchInputRef}
                    type="text" 
                    placeholder="Kërko artikull për të shtuar..." 
                    className="w-full bg-primary border-accent rounded-lg p-3 pl-4 text-text-main focus:ring-highlight focus:border-highlight shadow-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    autoFocus
                />
                {searchTerm && (
                    <div className="absolute top-full left-0 right-0 bg-secondary border border-accent shadow-xl max-h-60 overflow-y-auto z-50 rounded-b-lg">
                        {filteredItems.length === 0 ? (
                            <div className="p-3 text-text-secondary">Nuk u gjet asnjë artikull (që ndjek stokun).</div>
                        ) : (
                            filteredItems.map(item => (
                                <button 
                                    key={item.id}
                                    onClick={() => handleAddItem(item)}
                                    className="w-full text-left p-3 hover:bg-highlight hover:text-white border-b border-accent last:border-0 flex justify-between items-center transition-colors"
                                >
                                    <span>{item.name}</span>
                                    <span className="text-sm opacity-70">Stoku aktual: {item.stock}</span>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* 3. The "Cart" List */}
            <div className="flex-grow overflow-y-auto bg-primary rounded-lg border border-accent">
                <table className="w-full text-left">
                    <thead className="bg-accent text-text-secondary sticky top-0">
                        <tr>
                            <th className="p-3">Artikulli</th>
                            <th className="p-3 w-32">Stoku Aktual</th>
                            <th className="p-3 w-40">Shto Sasi</th>
                            <th className="p-3 w-20"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-accent">
                        {cart.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-text-secondary opacity-60">
                                    Lista është bosh. Kërkoni artikuj lart për të filluar.
                                </td>
                            </tr>
                        ) : (
                            cart.map(line => (
                                <tr key={line.itemId} className="hover:bg-secondary/50 transition-colors">
                                    <td className="p-3 font-medium">{getName(line.itemId)}</td>
                                    <td className="p-3 text-text-secondary">{getCurrentStock(line.itemId)}</td>
                                    <td className="p-3">
                                        <div className="flex items-center">
                                            <span className="mr-2 text-green-500 font-bold">+</span>
                                            <input 
                                                ref={el => { quantityInputRefs.current[line.itemId] = el; }}
                                                type="number"
                                                className="w-24 bg-secondary border-accent rounded p-1 text-center font-bold text-text-main focus:ring-highlight focus:border-highlight"
                                                value={line.quantity}
                                                onChange={e => handleQuantityChange(line.itemId, e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, line.itemId)}
                                                onFocus={e => e.target.select()}
                                            />
                                        </div>
                                    </td>
                                    <td className="p-3 text-right">
                                        <button 
                                            onClick={() => handleRemoveItem(line.itemId)}
                                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-full transition-colors"
                                        >
                                            <TrashIcon className="w-5 h-5"/>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 4. Footer Actions */}
            <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-accent">
                <button 
                    onClick={() => setCart([])}
                    className="px-6 py-3 rounded-lg bg-accent text-text-main hover:bg-gray-600 font-semibold"
                    disabled={isSaving}
                >
                    Pastro
                </button>
                <button 
                    onClick={handleSave}
                    disabled={isSaving || cart.length === 0}
                    className="px-8 py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSaving ? 'Duke Ruajtur...' : (
                        <>
                            <PlusIcon className="w-5 h-5" /> Ruaj Furnizimin
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default StockSupply;