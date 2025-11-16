// C:\Users\loung\PosProject\components\PosScreen.tsx
// --- FINAL FIX: useCallback added ---

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { usePos } from '../context/PosContext';
import { MenuItem, OrderItem, Order, UserRole } from '../types';
import { LogoutIcon, PlusIcon, MinusIcon, TrashIcon, CloseIcon, TableIcon, ChevronLeftIcon } from './common/Icons';
import AdminScreen from './AdminScreen';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
};

// --- Payment Modal Component ---
const PaymentModal: React.FC<{
    isOpen: boolean; onClose: () => void; onFinalize: (amountPaid: number) => void; total: number;
}> = ({ isOpen, onClose, onFinalize, total }) => {
    const [amount, setAmount] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setAmount('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFinalizeClick = () => {
        const finalAmount = amount.trim() === '' ? total : parseFloat(amount);
        if (isNaN(finalAmount) || finalAmount < total) { alert("Shuma e paguar është e pamjaftueshme."); return; }
        onFinalize(finalAmount);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); handleFinalizeClick(); }
    };
    
    const finalAmount = amount.trim() === '' ? 0 : parseFloat(amount);
    const change = (finalAmount >= total) ? finalAmount - total : 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex justify-center items-center">
            <div className="bg-secondary rounded-lg shadow-xl w-full max-w-sm m-4 p-6 space-y-4">
                <h3 className="text-xl font-semibold text-text-main">Finalizo Faturën</h3>
                <div className="text-center">
                    <p className="text-text-secondary">Totali</p>
                    <p className="text-4xl font-bold text-highlight">{formatCurrency(total)}</p>
                </div>
                <div>
                    <label htmlFor="amountPaid" className="block text-sm font-medium text-text-secondary">Shuma e Paguar (€)</label>
                    <input ref={inputRef} type="number" id="amountPaid" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={handleKeyDown} className="mt-1 block w-full bg-primary border border-accent rounded-md shadow-sm py-3 px-4 text-text-main text-2xl text-center focus:outline-none focus:ring-highlight focus:border-highlight" placeholder={total.toFixed(2)} />
                </div>
                <div className="text-center p-3 bg-accent rounded-lg">
                    <p className="text-text-secondary">Kusuri</p>
                    <p className="text-2xl font-bold text-text-main">{formatCurrency(change)}</p>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-accent text-text-main hover:bg-gray-600">Anulo</button>
                    <button onClick={handleFinalizeClick} className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700">Finalizo</button>
                </div>
            </div>
        </div>
    );
};

// --- Main POS Screen Component ---
const PosScreen: React.FC = () => {
  const { loggedInUser, logout, menuItems, menuCategories, addSale, tables, saveOrderForTable, tablesPerRow, tableSizePercent, tableButtonSizePercent, taxRate } = usePos();
  const [activeTableId, setActiveTableId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isAdminScreenOpen, setAdminScreenOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([]);
  const activeTable = useMemo(() => tables.find(t => t.id === activeTableId), [tables, activeTableId]);

  useEffect(() => {
    if (activeTable && activeTable.order) {
        const itemsWithStatus = activeTable.order.items.map(item => ({ ...item, status: 'ordered' }));
        setCurrentOrderItems(itemsWithStatus);
    } else { setCurrentOrderItems([]); }
  }, [activeTable]);

  const handleSelectTable = (tableId: number) => {
    setActiveTableId(tableId);
    if(menuCategories.length > 0) { setSelectedCategory(menuCategories[0].name); }
  };

  useEffect(() => {
    if (activeTableId !== null && menuCategories.length > 0 && !selectedCategory) {
        setSelectedCategory(menuCategories[0].name);
    }
  }, [activeTableId, menuCategories, selectedCategory]);
  
  const filteredMenuItems = useMemo(() => {
    return selectedCategory ? menuItems.filter(item => item.category === selectedCategory) : menuItems;
  }, [menuItems, selectedCategory]);

  const orderTotals = useMemo(() => {
    const subtotal = currentOrderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [currentOrderItems, taxRate]);
  
  const calculateNewOrderState = useCallback((items: OrderItem[]): Order | null => {
      if (items.length === 0) return null;
      const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
      const tax = subtotal * taxRate;
      const total = subtotal + tax;
      return { items, subtotal, tax, total };
  }, [taxRate]);

  const addToOrder = (item: MenuItem) => {
    if (!loggedInUser) return;
    const totalCurrentQuantity = currentOrderItems.find(i => i.id === item.id)?.quantity || 0;
    if (item.trackStock && isFinite(item.stock) && totalCurrentQuantity >= item.stock) {
        alert(`Stoku i pamjaftueshëm për ${item.name}. Në stok: ${item.stock}`); return;
    }
    setCurrentOrderItems(prevItems => {
        const existingItem = prevItems.find(orderItem => orderItem.id === item.id && orderItem.addedBy === loggedInUser.username);
        if (existingItem) {
            return prevItems.map(orderItem => orderItem.id === item.id && orderItem.addedBy === loggedInUser.username ? { ...orderItem, quantity: orderItem.quantity + 1 } : orderItem);
        } else { return [...prevItems, { ...item, quantity: 1, addedBy: loggedInUser.username, status: 'new' }]; }
    });
  };

  const updateQuantity = (itemId: number, addedByUser: string, change: number) => {
    if (change > 0) {
        const itemInfo = menuItems.find(i => i.id === itemId);
        const orderItem = currentOrderItems.find(i => i.id === itemId && i.addedBy === addedByUser);
        if (itemInfo && orderItem && itemInfo.trackStock && isFinite(itemInfo.stock) && orderItem.quantity >= itemInfo.stock) {
             alert(`Stoku i pamjaftueshëm për ${itemInfo.name}. Në stok: ${itemInfo.stock}`); return;
        }
    }
    setCurrentOrderItems(prevItems => prevItems.map(item => (item.id === itemId && item.addedBy === addedByUser) ? { ...item, quantity: Math.max(0, item.quantity + change) } : item).filter(item => item.quantity > 0));
  };
  
  const removeFromOrder = (itemId: number, addedByUser: string) => {
    setCurrentOrderItems(prevItems => prevItems.filter(item => !(item.id === itemId && item.addedBy === addedByUser)));
  };

  const handleCancelOrder = useCallback(() => {
    setActiveTableId(null);
  }, []);

  const handleSaveOrder = useCallback(async () => {
    if (activeTableId === null) return;
    const savedItems = new Set(activeTable?.order?.items.map(i => `${i.id}-${i.addedBy}-${i.quantity}`) || []);
    const newItemsForTicket = currentOrderItems.filter(currentItem => !savedItems.has(`${currentItem.id}-${currentItem.addedBy}-${currentItem.quantity}`));
    const newOrderState = calculateNewOrderState(currentOrderItems);
    await saveOrderForTable(activeTableId, newOrderState, newItemsForTicket);
    setActiveTableId(null);
  }, [activeTableId, currentOrderItems, activeTable, saveOrderForTable, calculateNewOrderState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (activeTableId !== null && !isPaymentModalOpen) {
        if (event.key === 'Enter') { event.preventDefault(); handleSaveOrder(); } 
        else if (event.key === 'Escape') { event.preventDefault(); handleCancelOrder(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTableId, isPaymentModalOpen, handleSaveOrder, handleCancelOrder]);

  // ========================================================================
  // ✅ THE FINAL FIX: handleFinalizeSale is wrapped in useCallback.
  // This stabilizes the function and prevents the feedback loop.
  // ========================================================================
  const handleFinalizeSale = useCallback(async (amountPaid: number) => {
    if (activeTableId === null || currentOrderItems.length === 0) return;
    const finalOrder = calculateNewOrderState(currentOrderItems);
    if (!finalOrder) return;
    
    if (isNaN(amountPaid) || amountPaid < finalOrder.total) {
        alert("Shuma e paguar është e pamjaftueshme.");
        return;
    }

    await addSale(finalOrder, activeTableId);
    
    setPaymentModalOpen(false);
    setActiveTableId(null);
    logout();
  }, [activeTableId, currentOrderItems, calculateNewOrderState, addSale, setPaymentModalOpen, setActiveTableId, logout]);
  
  const groupedItems = useMemo(() => {
    const groups = new Map<string, OrderItem[]>();
    currentOrderItems.forEach(item => {
        const group = groups.get(item.addedBy) || [];
        group.push(item);
        groups.set(item.addedBy, group);
    });
    return Array.from(groups.entries()).map(([user, items]) => ({ user, items }));
  }, [currentOrderItems]);

  const Header = () => (
    <div className="flex items-center space-x-4">
        {loggedInUser?.role === UserRole.ADMIN && (
            <button onClick={() => setAdminScreenOpen(true)} className="px-4 py-2 bg-accent text-text-main font-semibold rounded-lg hover:bg-highlight transition-colors">Admin</button>
        )}
        <span className="text-text-secondary">Përdoruesi: {loggedInUser?.username}</span>
        <button onClick={logout} className="p-2 rounded-full text-text-secondary hover:bg-accent hover:text-white transition-colors"><LogoutIcon className="w-6 h-6" /></button>
    </div>
  );
  
  if (activeTableId === null) {
    return (
        <div className="h-screen w-screen flex flex-col bg-primary">
            <header className="flex-shrink-0 bg-secondary flex items-center justify-between p-4 shadow-md">
                <div className="flex items-center space-x-2"><TableIcon className="w-6 h-6 text-highlight"/><h1 className="text-xl font-bold text-text-main">Zgjidhni një Tavolinë</h1></div>
                <Header />
            </header>
            <main className="flex-grow p-4 overflow-y-auto">
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${tablesPerRow}, minmax(0, 1fr))` }}>
                    {tables.map(table => (
                        <div key={table.id} className="aspect-square flex justify-center items-center">
                            <button onClick={() => handleSelectTable(table.id)} className={`flex flex-col justify-center items-center rounded-lg shadow-lg transition-all transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-highlight ${table.order ? 'bg-highlight text-white' : 'bg-secondary text-text-main'}`} style={{ width: `${tableButtonSizePercent}%`, height: `${tableButtonSizePercent}%` }}>
                                <span className="font-bold" style={{ fontSize: `calc(1.5rem * ${tableSizePercent / 100})` }}>{table.id}</span>
                                {table.order && <span className="font-semibold" style={{ fontSize: `calc(0.75rem * ${tableSizePercent / 100})` }}>{formatCurrency(table.order.total)}</span>}
                            </button>
                        </div>
                    ))}
                </div>
            </main>
            {isAdminScreenOpen && <AdminScreen onClose={() => setAdminScreenOpen(false)} />}
        </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-primary">
      <header className="flex-shrink-0 bg-secondary flex items-center justify-between p-4 shadow-md">
        <div className="flex items-center space-x-3">
            <button onClick={handleCancelOrder} className="p-2 rounded-full text-text-secondary hover:bg-accent hover:text-white transition-colors"><ChevronLeftIcon className="w-6 h-6"/></button>
            <h1 className="text-xl font-bold text-text-main">Porosi për {activeTable?.name}</h1>
        </div>
        <Header />
      </header>
      <div className="flex flex-grow overflow-hidden">
        <main className="flex-grow flex flex-col p-4 overflow-y-auto">
             <div className="flex space-x-2 overflow-x-auto pb-2 mb-4 flex-shrink-0">
                {menuCategories.map(category => (
                    <button key={category.id} onClick={() => setSelectedCategory(category.name)} className={`px-4 py-2 rounded-md text-base font-bold whitespace-nowrap transition-colors ${selectedCategory === category.name ? 'bg-highlight text-white' : 'bg-accent text-text-secondary hover:bg-highlight hover:text-white'}`}>{category.name}</button>
                ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredMenuItems.map(item => {
                    const isOutOfStock = item.trackStock && isFinite(item.stock) && item.stock <= 0;
                    return (
                        <button key={item.id} onClick={() => addToOrder(item)} disabled={isOutOfStock} className={`relative bg-secondary rounded-lg p-2 text-center shadow-lg transition-all transform focus:outline-none flex flex-col justify-center items-center h-20 ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:ring-2 hover:ring-highlight hover:-translate-y-1'}`}>
                            <p className="text-sm font-semibold text-text-main">{item.name}</p>
                            <p className="text-xs text-highlight mt-1">{formatCurrency(item.price)}</p>
                            {isOutOfStock && <div className="absolute inset-0 bg-black bg-opacity-60 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-sm">STOKU 0</span></div>}
                        </button>
                    )
                })}
            </div>
        </main>
        <aside className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 bg-secondary flex flex-col p-4 shadow-inner">
             <div className="flex justify-between items-center mb-4 border-b border-accent pb-2">
                <h2 className="text-lg font-bold text-text-main">Porosia Aktuale</h2>
                <button onClick={handleCancelOrder} className="p-1 text-text-secondary hover:text-text-main"><CloseIcon className="w-5 h-5" /></button>
            </div>
            <div className="flex-grow overflow-y-auto">
                {currentOrderItems.length === 0 ? <p className="text-text-secondary text-center mt-8">Zgjidhni artikujt për të filluar porosinë.</p> : (
                    <ul className="space-y-4">
                        {groupedItems.map(group => (
                            <li key={group.user}>
                                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Shtuar nga: {group.user}</h3>
                                <ul className="space-y-3">
                                    {group.items.map(item => (
                                        <li key={`${item.id}-${group.user}`} className={`flex items-center p-2 rounded-md ${item.status === 'ordered' ? 'bg-accent' : 'bg-primary'}`}>
                                            <div className="flex-grow">
                                                <p className="text-sm font-semibold text-text-main">{item.name}</p>
                                                <p className="text-xs text-text-secondary">{formatCurrency(item.price)}</p>
                                            </div>
                                            {item.status === 'new' ? (
                                                <div className="flex items-center space-x-2">
                                                    <button onClick={() => updateQuantity(item.id, item.addedBy, -1)} className="p-1 rounded-full bg-secondary hover:bg-highlight transition-colors"><MinusIcon className="w-4 h-4 text-text-main"/></button>
                                                    <span className="w-6 text-center text-sm font-bold text-text-main">{item.quantity}</span>
                                                    <button onClick={() => updateQuantity(item.id, item.addedBy, 1)} className="p-1 rounded-full bg-secondary hover:bg-highlight transition-colors"><PlusIcon className="w-4 h-4 text-text-main"/></button>
                                                    <button onClick={() => removeFromOrder(item.id, item.addedBy)} className="p-1 text-red-400 hover:text-red-300 transition-colors"><TrashIcon className="w-4 h-4"/></button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center"><span className="text-sm text-text-secondary mr-1">Qty:</span><span className="text-base font-bold text-text-main">{item.quantity}</span></div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="flex-shrink-0 pt-4 border-t border-accent mt-4">
                <div className="space-y-1 text-sm">
                    {taxRate > 0 && <>
                        <div className="flex justify-between text-text-secondary"><span>Nëntotali:</span><span>{formatCurrency(orderTotals.subtotal)}</span></div>
                        <div className="flex justify-between text-text-secondary"><span>Tatimi ({Math.round(taxRate * 100)}%):</span><span>{formatCurrency(orderTotals.tax)}</span></div>
                    </>}
                    <div className="flex justify-between text-lg font-bold text-text-main"><span>Totali:</span><span>{formatCurrency(orderTotals.total)}</span></div>
                </div>
                <div className="w-full mt-4 flex space-x-2">
                    <button onClick={() => setPaymentModalOpen(true)} disabled={currentOrderItems.length === 0} className="w-1/2 py-3 bg-accent text-text-main font-bold rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">Fatura</button>
                    <button onClick={handleSaveOrder} className="w-1/2 py-3 bg-highlight text-white font-bold rounded-lg hover:bg-blue-600 transition-colors">Porosit</button>
                </div>
            </div>
        </aside>
      </div>
      {isAdminScreenOpen && <AdminScreen onClose={() => setAdminScreenOpen(false)} />}
      <PaymentModal isOpen={isPaymentModalOpen} onClose={() => setPaymentModalOpen(false)} onFinalize={handleFinalizeSale} total={orderTotals.total} />
    </div>
  );
};

export default PosScreen;