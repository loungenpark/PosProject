// C:\Users\loung\PosProject\components\PosScreen.tsx
// --- FINAL FIX: useCallback added ---

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { usePos } from '../context/PosContext';
import { MenuItem, OrderItem, Order, UserRole } from '../types';
import { LogoutIcon, TrashIcon, CloseIcon, ChevronLeftIcon, MenuIcon } from '../components/common/Icons';
import TransferModal from '../components/modals/TransferModal';

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
        <div className="fixed inset-0 bg-primary/70 z-[60] flex justify-center items-start pt-2 md:items-center md:pt-0 overflow-y-auto">
            <div className="bg-secondary rounded-lg shadow-xl w-full max-w-sm m-4 p-6 space-y-4 relative">
                <h3 className="text-xl font-semibold text-text-main">Finalizo Faturën</h3>
                <div className="text-center">
                    <p className="text-text-secondary">Totali</p>
                    <p className="text-4xl font-bold text-highlight">{formatCurrency(total)}</p>
                </div>
                <div>
                    <label htmlFor="amountPaid" className="block text-sm font-medium text-text-secondary">Shuma e Paguar (€)</label>
                    <input
                        ref={inputRef}
                        type="number"
                        inputMode="decimal"
                        id="amountPaid"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="mt-1 block w-full bg-primary border border-border rounded-md shadow-sm py-3 px-4 text-text-main text-2xl text-center focus:outline-none focus:ring-highlight focus:border-highlight placeholder-text-subtle"
                        placeholder={total.toFixed(2)}
                    />
                </div>
                <div className="text-center p-3 bg-border rounded-lg">
                    <p className="text-text-secondary">Kusuri</p>
                    <p className="text-2xl font-bold text-text-main">{formatCurrency(change)}</p>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-border text-text-main hover:bg-muted">Anulo</button>
                    <button onClick={handleFinalizeClick} className="px-4 py-2 rounded-md bg-success text-white hover:bg-success-hover">Finalizo</button>
                </div>
                {/* Spacer to allow scrolling past keyboard on very small screens */}
                <div className="h-4 sm:h-0"></div>
            </div>
        </div>
    );
};

// --- Main POS Screen Component ---
const PosScreen: React.FC = () => {
    // --- ADDED: sections from context ---
    const { loggedInUser, logout, setActiveScreen, menuItems, menuCategories, addSale, tables, sections, allSectionConfig, saveOrderForTable, tablesPerRow, tableSizePercent, tableButtonSizePercent, taxRate } = usePos();
    const [activeTableId, setActiveTableId] = useState<number | null>(null);
    const [activeSectionId, setActiveSectionId] = useState<number | 'all'>('all'); // --- ADDED: Section State
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
    const [isTransferModalOpen, setTransferModalOpen] = useState(false);
    const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false); // --- ADDED: Options Menu State
    const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([]);
    const activeTable = useMemo(() => tables.find(t => t.id === activeTableId), [tables, activeTableId]);

    // --- ADDED: Filter Tables based on selected Section ---
    const [isSectionDropdownOpen, setIsSectionDropdownOpen] = useState(false);

    // 1. FILTER VISIBLE SECTIONS
    const visibleSections = useMemo(() => sections.filter(s => !s.isHidden), [sections]);
    const hasSetDefaultRef = useRef(false);

    // 2. APPLY DEFAULT OR FIRST VISIBLE SECTION
    useEffect(() => {
        // STARTUP LOGIC: If we haven't selected a default yet, FORCE selection based on config,
        // ignoring the initial state of 'all' if it's not the configured default.
        if (!hasSetDefaultRef.current) {
            if (allSectionConfig.isDefault && !allSectionConfig.isHidden) {
                setActiveSectionId('all');
            } else {
                const defaultSection = visibleSections.find(s => s.isDefault);
                if (defaultSection) {
                    setActiveSectionId(defaultSection.id);
                } else if (!allSectionConfig.isHidden) {
                    // Fallback to All if available
                    setActiveSectionId('all');
                } else if (visibleSections.length > 0) {
                    // Fallback to first visible
                    setActiveSectionId(visibleSections[0].id);
                }
            }
            hasSetDefaultRef.current = true;
            return;
        }

        // RUNTIME LOGIC: Ensure current selection remains valid (e.g., if a section is hidden dynamically)
        let isCurrentValid = false;

        if (activeSectionId === 'all') {
            isCurrentValid = !allSectionConfig.isHidden;
        } else if (activeSectionId === -1) {
            isCurrentValid = true;
        } else {
            isCurrentValid = visibleSections.some(s => s.id === activeSectionId);
        }

        if (!isCurrentValid) {
            // If current became invalid, fallback logic
            const defaultSection = visibleSections.find(s => s.isDefault);
            if (defaultSection) setActiveSectionId(defaultSection.id);
            else if (!allSectionConfig.isHidden) setActiveSectionId('all');
            else if (visibleSections.length > 0) setActiveSectionId(visibleSections[0].id);
        }
    }, [visibleSections, activeSectionId, allSectionConfig]);

    // Helper to get current section name for the header title
    const activeSectionName = useMemo(() => {
        if (activeSectionId === 'all') return allSectionConfig.customName || 'Të gjitha';
        if (activeSectionId === -1) return 'Të Tjera';
        return sections.find(s => s.id === activeSectionId)?.name || 'Zona';
    }, [activeSectionId, sections, allSectionConfig]);

    const filteredTables = useMemo(() => {
        if (sections.length === 0) return tables;

        if (activeSectionId === 'all') {
            // When 'all', we want tables from visible sections. 
            // We do NOT want unassigned tables here if we are doing grouped rendering, 
            // but for the sake of the 'filteredTables' variable generally, let's keep it broad.
            // The render logic will handle the grouping.
            const visibleSectionIds = visibleSections.map(s => s.id);
            return tables.filter(t => t.sectionId && visibleSectionIds.includes(t.sectionId));
        }

        return tables.filter(t => {
            if (activeSectionId === -1) return !t.sectionId;
            return t.sectionId === activeSectionId;
        });
    }, [tables, sections, activeSectionId, visibleSections]);

    useEffect(() => {
        if (activeTable && activeTable.order) {
            // Ensure every item has a uniqueId for React keys and deletion logic
            const itemsWithStatus = activeTable.order.items.map((item, idx) => ({
                ...item,
                status: 'ordered' as const,
                uniqueId: item.uniqueId || `ordered-${item.id}-${idx}-${Date.now()}`
            }));
            setCurrentOrderItems(itemsWithStatus);
        } else { setCurrentOrderItems([]); }
    }, [activeTable]);

    // Track screen size for responsive logic
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleSelectTable = (tableId: number) => {
        setActiveTableId(tableId);
        // Only auto-select first category on Desktop. On Mobile, show the list first.
        if (!isMobile && menuCategories.length > 0) {
            setSelectedCategory(menuCategories[0].name);
        } else {
            setSelectedCategory(null);
        }
    };

    useEffect(() => {
        // Auto-select first category only if Desktop and nothing is selected
        if (!isMobile && activeTableId !== null && menuCategories.length > 0 && !selectedCategory) {
            setSelectedCategory(menuCategories[0].name);
        }
    }, [activeTableId, menuCategories, selectedCategory, isMobile]);

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
        // Calculate total currently in cart to prevent over-stock ordering
        const totalCurrentQuantity = currentOrderItems.filter(i => i.id === item.id).reduce((sum, i) => sum + i.quantity, 0);

        if (item.trackStock && isFinite(item.stock) && totalCurrentQuantity >= item.stock) {
            alert(`Stoku i pamjaftueshëm për ${item.name}. Në stok: ${item.stock}`);
            return;
        }

        // Always add as a new line item (quantity 1) with a unique ID
        setCurrentOrderItems(prevItems => [
            ...prevItems,
            {
                ...item,
                quantity: 1,
                addedBy: loggedInUser.username,
                status: 'new' as const,
                uniqueId: `${item.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
            }
        ]);
    };

    // Remove specific line item by uniqueId
    const removeFromOrder = (uniqueId: string) => {
        setCurrentOrderItems(prevItems => prevItems.filter(item => item.uniqueId !== uniqueId));
    };

    const handleCancelOrder = useCallback(() => {
        setActiveTableId(null);
    }, []);

    const handleSaveOrder = useCallback(async () => {
        if (activeTableId === null) return;

        // 1. Identify items to print (Look for status: 'new')
        const newItemsForTicket = currentOrderItems.filter(item => item.status === 'new');

        // 2. Calculate the total order value (THIS WAS MISSING)
        const newOrderState = calculateNewOrderState(currentOrderItems);

        // Debug Log
        console.log(`🛒 Saving Order. Found ${newItemsForTicket.length} new items to print.`);

        // 3. Save to database and trigger print 
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
    }, [activeTableId, currentOrderItems, calculateNewOrderState, addSale, setPaymentModalOpen, setActiveTableId, logout]);

    // Removed orderedItems useMemo - using currentOrderItems directly

    const Header = () => (
        <div className="flex items-center gap-2 md:gap-4">
            {loggedInUser?.role === UserRole.ADMIN && (
                <>
                    <button onClick={() => setActiveScreen('sales')} className="px-4 py-2 bg-border text-text-main font-semibold rounded-lg hover:bg-highlight transition-colors whitespace-nowrap">Raporte</button>
                    <button onClick={() => setActiveScreen('admin')} className="px-4 py-2 bg-border text-text-main font-semibold rounded-lg hover:bg-highlight transition-colors whitespace-nowrap">Menaxhimi</button>
                </>
            )}
            <div className="flex items-center text-sm md:text-base">
                <span className="hidden md:inline text-text-secondary mr-1">Përdoruesi:</span>
                <span className="text-text-main font-bold">{loggedInUser?.username}</span>
            </div>
            <button onClick={logout} className="p-2 rounded-full text-text-secondary hover:bg-border hover:text-text-main transition-colors">
                <LogoutIcon className="w-6 h-6" />
            </button>
        </div>
    );

    if (activeTableId === null) {
        const unassignedTables = tables.filter(t => !t.sectionId);

        // Helper: Render Grid to avoid duplication
        const renderTableGrid = (tableList: typeof tables) => (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${tablesPerRow}, minmax(0, 1fr))` }}>
                {tableList.map(table => (
                    <div key={table.id} className="aspect-square flex justify-center items-center">
                        <button onClick={() => handleSelectTable(table.id)} className={`flex flex-col justify-center items-center rounded-lg shadow-lg transition-all transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-highlight ${table.order ? 'bg-highlight text-white' : 'bg-secondary text-text-main'}`} style={{ width: `${tableButtonSizePercent}%`, height: `${tableButtonSizePercent}%` }}>
                            <span className="font-bold" style={{ fontSize: `calc(1.5rem * ${tableSizePercent / 100})` }}>{table.name}</span>
                            {table.order && <span className="font-semibold" style={{ fontSize: `calc(0.75rem * ${tableSizePercent / 100})` }}>{formatCurrency(table.order.total)}</span>}
                        </button>
                    </div>
                ))}
            </div>
        );

        // Helper: Render "All" View (Grouped by Section) - NO "Të Tjera"
        const renderAllSections = () => {
            return (
                <div className="space-y-8">
                    {visibleSections.map(section => {
                        const sectionTables = tables.filter(t => t.sectionId === section.id);
                        if (sectionTables.length === 0) return null;
                        return (
                            <div key={section.id}>
                                <h3 className="text-lg font-bold text-text-secondary mb-3 border-b border-border pb-1">{section.name}</h3>
                                {renderTableGrid(sectionTables)}
                            </div>
                        );
                    })}
                </div>
            );
        };

        // Helper: Mobile Dropdown Item
        const SectionOption = ({ id, name }: { id: number | 'all' | -1, name: string }) => (
            <button
                onClick={() => {
                    setActiveSectionId(id);
                    setIsSectionDropdownOpen(false);
                }}
                className={`w-full text-left px-6 py-4 border-b border-border last:border-0 font-bold text-lg transition-colors ${activeSectionId === id ? 'bg-highlight text-white' : 'bg-secondary text-text-main hover:bg-primary'}`}
            >
                {name}
            </button>
        );

        return (
            <div className="h-screen w-screen flex flex-col bg-primary relative">

                {/* --- HEADER --- */}
                <header className="flex-shrink-0 bg-secondary flex items-center justify-between p-2 shadow-md z-20 relative h-[60px] md:h-[72px]">

                    {/* LEFT: Zone Selector (Replaces "Hello") */}
                    <div className="flex-grow flex items-center mr-4 overflow-hidden h-full">
                        {sections.length > 0 ? (
                            isMobile ? (
                                // MOBILE: Dropdown Trigger (Clean - No Icon)
                                <button
                                    onClick={() => setIsSectionDropdownOpen(!isSectionDropdownOpen)}
                                    className="bg-primary px-6 py-2 rounded-full border border-border active:bg-border transition-colors max-w-[200px] shadow-sm"
                                >
                                    <span className="font-bold text-text-main truncate text-lg">{activeSectionName}</span>
                                </button>
                            ) : (
                                // DESKTOP: Horizontal Tabs
                                <div className="flex space-x-2 overflow-x-auto scrollbar-hide items-center h-full px-2">
                                    {!allSectionConfig.isHidden && (
                                        <button
                                            onClick={() => setActiveSectionId('all')}
                                            // The hover state for inactive buttons now matches the active state's appearance for better feedback.
                                            className={`px-5 py-2 rounded-full font-bold whitespace-nowrap transition-all border bg-primary ${activeSectionId === 'all' ? 'border-highlight text-highlight shadow-md' : 'text-text-secondary border-transparent hover:border-highlight hover:text-highlight'}`}
                                        >
                                            {allSectionConfig.customName || 'Të gjitha'}
                                        </button>
                                    )}
                                    {visibleSections.map(section => (
                                        <button
                                            key={section.id}
                                            onClick={() => setActiveSectionId(section.id)}
                                            // Apply the same improved hover state styling here.
                                            className={`px-5 py-2 rounded-full font-bold whitespace-nowrap transition-all border bg-primary ${activeSectionId === section.id ? 'border-highlight text-highlight shadow-md' : 'text-text-secondary border-transparent hover:border-highlight hover:text-highlight'}`}
                                        >
                                            {section.name}
                                        </button>
                                    ))}
                                    {unassignedTables.length > 0 && (
                                        <button
                                            onClick={() => setActiveSectionId(-1)}
                                            // Apply the same improved hover state styling here as well.
                                            className={`px-5 py-2 rounded-full font-bold whitespace-nowrap transition-all border bg-primary ${activeSectionId === -1 ? 'border-highlight text-highlight shadow-md' : 'text-text-secondary border-transparent hover:border-highlight hover:text-highlight'}`}
                                        >
                                            Të Tjera
                                        </button>
                                    )}
                                </div>
                            )
                        ) : (
                            <h1 className="text-xl font-bold text-text-main px-2">Tavolinat</h1>
                        )}
                    </div>

                    {/* RIGHT: User Actions */}
                    <div className="flex-shrink-0">
                        <Header />
                    </div>
                </header>

                {/* --- MOBILE DROPDOWN OVERLAY --- */}
                {isMobile && isSectionDropdownOpen && (
                    <>
                        {/* Backdrop */}
                        <div className="fixed inset-0 bg-primary/50 z-30" onClick={() => setIsSectionDropdownOpen(false)} />

                        {/* Menu */}
                        <div className="absolute top-[60px] left-2 w-64 bg-secondary rounded-lg shadow-2xl border border-border z-40 flex flex-col max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                            {!allSectionConfig.isHidden && <SectionOption id="all" name={allSectionConfig.customName || 'Të gjitha'} />}
                            {visibleSections.map(s => <SectionOption key={s.id} id={s.id} name={s.name} />)}
                            {unassignedTables.length > 0 && <SectionOption id={-1} name="Të Tjera" />}
                        </div>
                    </>
                )}

                {/* --- MAIN GRID --- */}
                <main className="flex-grow p-4 overflow-y-auto z-10">
                    <div className="pb-10">
                        {activeSectionId === 'all' ? (
                            renderAllSections()
                        ) : (
                            filteredTables.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-text-secondary opacity-50 py-20">
                                    <p className="text-lg">Asnjë tavolinë në këtë zonë.</p>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="text-lg font-bold text-text-secondary mb-3 border-b border-border pb-1">{activeSectionName}</h3>
                                    {renderTableGrid(filteredTables)}
                                </div>
                            )
                        )}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-primary">
            <header className="flex-shrink-0 bg-secondary flex items-center justify-between p-2 md:p-4 shadow-md">
                <div className="flex items-center space-x-1 md:space-x-3">
                    <button onClick={handleCancelOrder} className="p-1 md:p-2 rounded-full text-text-secondary hover:bg-border hover:text-text-main transition-colors"><ChevronLeftIcon className="w-6 h-6" /></button>
                    <h1 className="text-lg md:text-xl font-bold text-text-main whitespace-nowrap">{activeTable?.name}</h1>
                </div>
                <Header />
            </header>

            <div className="flex flex-grow overflow-hidden">
                <main className="w-1/2 md:flex-grow flex flex-col p-4 overflow-hidden">
                    {/* MOBILE VIEW LOGIC */}
                    {isMobile ? (
                        !selectedCategory ? (
                            // VIEW 1: Vertical List of Categories
                            <div className="flex-grow overflow-y-auto space-y-3">
                                {menuCategories.map(category => (
                                    <button
                                        key={category.id}
                                        onClick={() => setSelectedCategory(category.name)}
                                        className="w-full py-4 px-6 bg-secondary rounded-lg shadow-md text-left flex justify-between items-center active:scale-95 transition-transform"
                                    >
                                        <span className="text-lg font-bold text-text-main">{category.name}</span>
                                        {/* Small chevron hint */}
                                        <span className="text-text-secondary">›</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            // VIEW 2: Sticky Header + Items
                            <>
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className="flex-shrink-0 w-full py-3 px-4 mb-3 bg-highlight text-white rounded-lg shadow-md flex items-center font-bold text-lg active:opacity-90 transition-opacity"
                                >
                                    <ChevronLeftIcon className="w-6 h-6 mr-2" />
                                    {selectedCategory}
                                </button>
                                <div className="flex-grow overflow-y-auto">
                                    <div className="grid grid-cols-2 gap-3">
                                        {filteredMenuItems.map(item => {
                                            const isOutOfStock = item.trackStock && isFinite(item.stock) && item.stock <= 0;
                                            return (
                                                <button key={item.id} onClick={() => addToOrder(item)} disabled={isOutOfStock} className={`relative bg-secondary rounded-lg p-2 text-center shadow-lg transition-all transform focus:outline-none flex flex-col justify-center items-center h-24 ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
                                                    <p className="text-sm font-semibold text-text-main leading-tight">{item.name}</p>
                                                    <p className="text-xs text-highlight mt-1 font-bold">{formatCurrency(item.price)}</p>
                                                    {isOutOfStock && <div className="absolute inset-0 bg-primary/60 rounded-lg flex items-center justify-center"><span className="text-text-main font-bold text-sm">STOKU 0</span></div>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </>
                        )
                    ) : (
                        // DESKTOP VIEW LOGIC (Original)
                        <>
                            <div className="flex space-x-2 overflow-x-auto pb-2 mb-4 flex-shrink-0">
                                {menuCategories.map(category => (
                                    <button key={category.id} onClick={() => setSelectedCategory(category.name)} className={`px-4 py-2 rounded-md text-base font-bold whitespace-nowrap transition-colors ${selectedCategory === category.name ? 'bg-highlight text-white' : 'bg-border text-text-secondary hover:bg-highlight hover:text-white'}`}>{category.name}</button>
                                ))}
                            </div>
                            <div className="flex-grow overflow-y-auto">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {filteredMenuItems.map(item => {
                                        const isOutOfStock = item.trackStock && isFinite(item.stock) && item.stock <= 0;
                                        return (
                                            <button key={item.id} onClick={() => addToOrder(item)} disabled={isOutOfStock} className={`relative bg-secondary rounded-lg p-2 text-center shadow-lg transition-all transform focus:outline-none flex flex-col justify-center items-center h-20 ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:ring-2 hover:ring-highlight hover:-translate-y-1'}`}>
                                                <p className="text-sm font-semibold text-text-main">{item.name}</p>
                                                <p className="text-xs text-highlight mt-1">{formatCurrency(item.price)}</p>
                                                {isOutOfStock && <div className="absolute inset-0 bg-primary/60 rounded-lg flex items-center justify-center"><span className="text-text-main font-bold text-sm">STOKU 0</span></div>}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </main>


                <aside className="w-1/2 md:w-1/3 lg:w-1/4 flex-shrink-0 bg-secondary flex flex-col p-4 shadow-inner">
                    <div className="flex justify-between items-center mb-4 border-b border-border pb-2 relative">
                        <h2 className="text-lg font-bold text-text-main">Porosia Aktuale</h2>
                        <div className="flex items-center space-x-2">
                            {/* More Options Menu */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
                                    className="p-1 text-text-secondary hover:text-text-main rounded-full hover:bg-primary transition-colors"
                                >
                                    <MenuIcon className="w-6 h-6" />
                                </button>

                                {isOptionsMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsOptionsMenuOpen(false)} />
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-secondary border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                                            <button
                                                onClick={() => {
                                                    setTransferModalOpen(true);
                                                    setIsOptionsMenuOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-primary text-text-main font-semibold flex items-center transition-colors"
                                            >
                                                <span className="mr-2">↔️</span> Transfero Tavolinën
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <button onClick={handleCancelOrder} className="p-1 text-text-secondary hover:text-text-main"><CloseIcon className="w-5 h-5" /></button>
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto">
                        {currentOrderItems.length === 0 ? <p className="text-text-secondary text-center mt-8">Zgjidhni artikujt për të filluar porosinë.</p> : (
                            <ul className="space-y-2">
                                {currentOrderItems.map((item) => (
                                    <li key={item.uniqueId} className={`flex items-center p-2 rounded-md ${item.status === 'ordered' ? 'bg-border' : 'bg-primary'}`}>
                                        <div className="flex-grow">
                                            <p className="text-sm font-semibold text-text-main">{item.name}</p>
                                            <p className="text-xs text-text-secondary">{formatCurrency(item.price)}</p>
                                            <p className="text-xs text-text-secondary">Shtuar nga: {item.addedBy}</p>
                                        </div>
                                        {item.status === 'new' ? (
                                            <div className="flex items-center justify-end">
                                                <button
                                                    onClick={() => item.uniqueId && removeFromOrder(item.uniqueId)}
                                                    className="p-2 text-danger hover:text-danger-hover hover:bg-secondary rounded transition-colors"
                                                    title="Fshij"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center">
                                                {/* Ordered items are read-only here */}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="flex-shrink-0 pt-4 border-t border-border mt-4">
                        <div className="space-y-1 text-sm">
                            {taxRate > 0 && <>
                                <div className="flex justify-between text-text-secondary"><span>Nëntotali:</span><span>{formatCurrency(orderTotals.subtotal)}</span></div>
                                <div className="flex justify-between text-text-secondary"><span>Tatimi ({Math.round(taxRate * 100)}%):</span><span>{formatCurrency(orderTotals.tax)}</span></div>
                            </>}
                            <div className="flex justify-between text-lg font-bold text-text-main"><span>Totali:</span><span>{formatCurrency(orderTotals.total)}</span></div>
                        </div>
                        <div className="w-full mt-4 flex space-x-2">
                            <button onClick={() => setPaymentModalOpen(true)} disabled={currentOrderItems.length === 0} className="w-1/2 py-3 bg-border text-text-main font-bold rounded-lg hover:bg-muted transition-colors disabled:bg-muted disabled:cursor-not-allowed">Fatura</button>
                            <button onClick={handleSaveOrder} className="w-1/2 py-3 bg-highlight text-white font-bold rounded-lg hover:bg-highlight-hover transition-colors">Porosit</button>
                        </div>
                    </div>
                </aside>
            </div>
            <PaymentModal isOpen={isPaymentModalOpen} onClose={() => setPaymentModalOpen(false)} onFinalize={handleFinalizeSale} total={orderTotals.total} />

            {/* Transfer Modal */}
            {activeTableId && activeTable && (
                <TransferModal
                    isOpen={isTransferModalOpen}
                    onClose={() => setTransferModalOpen(false)}
                    sourceTableId={activeTableId}
                    sourceTableName={activeTable.name}
                />
            )}
        </div>
    );
};

export default PosScreen;