import React, { useState, useMemo, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { MenuItem, MenuCategory, Printer, User, Sale } from '../types';
import { EditIcon, TrashIcon, PlusIcon, CloseIcon, ChartBarIcon, MenuIcon, TableIcon, PercentIcon, UserGroupIcon, BoxIcon, PrinterIcon, UploadIcon, DragHandleIcon, SortIcon } from './common/Icons';
import UserManagement from './UserManagement';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';


const formatCurrency = (amount: number | string) => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericAmount)) return '...';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(numericAmount);
};

// --- Modal Component ---
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

// --- MenuItem Form ---
interface MenuItemFormProps {
    item: Omit<MenuItem, 'id'> | MenuItem | null;
    onSave: (item: Omit<MenuItem, 'id'> | MenuItem) => Promise<void>;
    onCancel: () => void;
}
const MenuItemForm: React.FC<MenuItemFormProps> = ({ item, onSave, onCancel }) => {
    const { menuCategories } = usePos();
    const [formData, setFormData] = useState({
        name: item?.name || '',
        price: item?.price || 0,
        category: item?.category || (menuCategories.length > 0 ? menuCategories[0].name : ''),
        printer: item?.printer || Printer.KITCHEN,
        stock: item?.stock ?? Infinity,
        stockThreshold: item?.stockThreshold ?? 0,
        trackStock: item?.trackStock ?? true,
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            let finalValue: string | number = value;

            if (['price', 'stock', 'stockThreshold'].includes(name)) {
                 if (name === 'stock' && value === '') {
                    finalValue = Infinity;
                } else {
                    finalValue = parseFloat(value) || 0;
                }
            }
           
            setFormData(prev => ({ ...prev, [name]: finalValue }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const dataToSave = { ...formData };
            if (!dataToSave.trackStock) {
                dataToSave.stock = Infinity;
                dataToSave.stockThreshold = 0;
            }
            await onSave({ ...item, ...dataToSave });
        } catch (error) {
            console.error("Failed to save menu item:", error);
            alert("Ruajtja e artikullit dështoi.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-text-secondary">Emri</label>
                <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight"/>
            </div>
            <div>
                <label htmlFor="price" className="block text-sm font-medium text-text-secondary">Çmimi (€)</label>
                <input type="number" name="price" id="price" value={formData.price} onChange={handleChange} required step="0.01" min="0" className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight"/>
            </div>
             <div>
                <label htmlFor="category" className="block text-sm font-medium text-text-secondary">Menu (Kategoria)</label>
                <select name="category" id="category" value={formData.category} onChange={handleChange} required className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight">
                    <option value="" disabled>Zgjidhni një menu</option>
                    {menuCategories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="printer" className="block text-sm font-medium text-text-secondary">Printeri</label>
                <select name="printer" id="printer" value={formData.printer} onChange={handleChange} required className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight">
                    <option value={Printer.KITCHEN}>Kuzhina</option>
                    <option value={Printer.BAR}>Shank</option>
                </select>
            </div>
            <div className="flex items-center space-x-2 pt-2">
                <input type="checkbox" name="trackStock" id="trackStock" checked={formData.trackStock} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-highlight focus:ring-highlight" />
                <label htmlFor="trackStock" className="text-sm font-medium text-text-secondary">Ndjek Stokun</label>
            </div>
             <div className={`transition-opacity duration-300 ${formData.trackStock ? 'opacity-100' : 'opacity-50'}`}>
                <label htmlFor="stock" className="block text-sm font-medium text-text-secondary">Stoku Fillestar</label>
                <input type="number" name="stock" id="stock" value={isFinite(formData.stock) ? formData.stock : ''} onChange={handleChange} placeholder="Bosh për stok pa limit" min="0" className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight" disabled={!formData.trackStock} />
            </div>
             <div className={`transition-opacity duration-300 ${formData.trackStock ? 'opacity-100' : 'opacity-50'}`}>
                <label htmlFor="stockThreshold" className="block text-sm font-medium text-text-secondary">Pragu i Stokut të Ulët</label>
                <input type="number" name="stockThreshold" id="stockThreshold" value={formData.stockThreshold} onChange={handleChange} min="0" className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight" disabled={!formData.trackStock}/>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-accent text-text-main hover:bg-gray-600">Anulo</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-md bg-highlight text-white hover:bg-blue-600 disabled:bg-gray-500">{isSaving ? 'Duke ruajtur...' : 'Ruaj Artikullin'}</button>
            </div>
        </form>
    )
}

// --- Menu Form ---
interface MenuFormProps {
    menu: MenuCategory | null;
    onSave: (menu: MenuCategory) => Promise<void>;
    onCancel: () => void;
}
const MenuForm: React.FC<MenuFormProps> = ({ menu, onSave, onCancel }) => {
    const [name, setName] = useState(menu?.name || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave({ id: menu?.id || 0, name, display_order: menu?.display_order || 0 });
        } catch (error) {
            console.error("Failed to save menu:", error);
            alert("Ruajtja e menusë dështoi.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="menu-name" className="block text-sm font-medium text-text-secondary">Emri i Menusë</label>
                <input type="text" id="menu-name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight"/>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-accent text-text-main hover:bg-gray-600">Anulo</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-md bg-highlight text-white hover:bg-blue-600 disabled:bg-gray-500">{isSaving ? 'Duke ruajtur...' : 'Ruaj Menunë'}</button>
            </div>
        </form>
    );
};


// --- Sales Dashboard ---
const SalesDashboard: React.FC = ({}) => {
    const { sales, users, refreshSalesFromServer } = usePos();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [summaryStartDate, setSummaryStartDate] = useState('');
    const [summaryEndDate, setSummaryEndDate] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');

    useEffect(() => {
        refreshSalesFromServer();
    }, [refreshSalesFromServer]);

// THIS IS THE NEW, CORRECTED CODE BLOCK (REPLACEMENT FOR LINE 240)
    const filteredSales = useMemo(() => {
	let startFilter: Date | null = startDate ? new Date(`${startDate}T00:00:00`) : null;
	let endFilter: Date | null = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

	// If no date range is selected by the user, default the filter to today.
	if (!startDate && !endDate) {
            startFilter = new Date();
            startFilter.setHours(0, 0, 0, 0);
	    endFilter = new Date();
	    endFilter.setHours(23, 59, 59, 999);
	}

	return sales.filter(sale => {
	    const saleDate = new Date(sale.date);
	    // This handles all cases: a full range, only a start date, only an end date, or the default 'today' range.
	    if (startFilter && saleDate < startFilter) return false;
	    if (endFilter && saleDate > endFilter) return false;
	    return true;
	});
    }, [sales, startDate, endDate]);

    const summaryFilteredSales = useMemo(() => {
        let start: Date | null = summaryStartDate ? new Date(summaryStartDate) : null;
        let end: Date | null = summaryEndDate ? new Date(summaryEndDate) : null;

        if (!summaryStartDate && !summaryEndDate) {
            start = new Date();
            start.setHours(0, 0, 0, 0);
            end = new Date();
            end.setHours(23, 59, 59, 999);
        }

        return sales.filter(sale => {
            const saleDate = new Date(sale.date);
            if (start && saleDate < start) return false;
            if (end && saleDate > end) return false;
            if (selectedUserId && sale.user.id !== parseInt(selectedUserId, 10)) return false;
            return true;
        });
    }, [sales, summaryStartDate, summaryEndDate, selectedUserId]);

    const salesSummary = useMemo(() => {
        let totalShankRevenue = 0;
        let totalKuzhinaRevenue = 0;
        summaryFilteredSales.forEach(sale => {
            let subtotalShank = 0;
            let subtotalKuzhina = 0;
            sale.order.items.forEach(item => {
                const itemPrice = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
                if (item.printer === Printer.BAR) {
                    subtotalShank += itemPrice * item.quantity;
                } else if (item.printer === Printer.KITCHEN) {
                    subtotalKuzhina += itemPrice * item.quantity;
                }
            });
            if (sale.order.subtotal > 0) {
                const shankRatio = isFinite(sale.order.subtotal) && sale.order.subtotal !== 0 ? subtotalShank / sale.order.subtotal : 0;
                const kuzhinaRatio = isFinite(sale.order.subtotal) && sale.order.subtotal !== 0 ? subtotalKuzhina / sale.order.subtotal : 0;
                totalShankRevenue += sale.order.total * shankRatio;
                totalKuzhinaRevenue += sale.order.total * kuzhinaRatio;
            }
        });
        const totalRevenue = totalShankRevenue + totalKuzhinaRevenue;
        return { totalShankRevenue, totalKuzhinaRevenue, totalRevenue };
    }, [summaryFilteredSales]);

    return (
        <div className="space-y-6">
            <div className="bg-secondary p-4 rounded-lg">
                <div className="flex flex-wrap items-center gap-4">
                    <h3 className="text-lg font-semibold text-text-main">Filtro</h3>
                    <div className="flex items-center gap-2 flex-grow">
                        <input 
                            type="datetime-local" 
                            value={summaryStartDate}
                            onChange={e => setSummaryStartDate(e.target.value)}
                            className="bg-primary border border-accent rounded-md p-2 text-sm text-text-main focus:ring-highlight focus:border-highlight"
                            aria-label="Data dhe Ora e Fillimit"
                        />
                        <span className="text-text-secondary">deri</span>
                        <input 
                            type="datetime-local" 
                            value={summaryEndDate}
                            onChange={e => setSummaryEndDate(e.target.value)}
                            className="bg-primary border border-accent rounded-md p-2 text-sm text-text-main focus:ring-highlight focus:border-highlight"
                            aria-label="Data dhe Ora e Mbarimit"
                        />
                        <select 
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="bg-primary border border-accent rounded-md p-2 text-sm text-text-main focus:ring-highlight focus:border-highlight"
                            aria-label="Filtro sipas përdoruesit"
                        >
                            <option value="">Të gjithë Përdoruesit</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id.toString()}>{user.username}</option>
                            ))}
                        </select>
                        <button 
                            onClick={() => { setSummaryStartDate(''); setSummaryEndDate(''); setSelectedUserId(''); }}
                            className="px-3 py-2 rounded-md bg-accent text-text-main hover:bg-gray-600 text-sm"
                        >
                            Pastro
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-secondary p-6 rounded-lg">
                    <h3 className="text-text-secondary">Shank</h3>
                    <p className="text-3xl font-bold text-highlight">{formatCurrency(salesSummary.totalShankRevenue)}</p>
                </div>
                <div className="bg-secondary p-6 rounded-lg">
                    <h3 className="text-text-secondary">Kuzhina</h3>
                    <p className="text-3xl font-bold text-highlight">{formatCurrency(salesSummary.totalKuzhinaRevenue)}</p>
                </div>
                <div className="bg-secondary p-6 rounded-lg">
                    <h3 className="text-text-secondary">Të Ardhurat Totale</h3>
                    <p className="text-3xl font-bold text-highlight">{formatCurrency(salesSummary.totalRevenue)}</p>
                </div>
            </div>

            <div className="bg-secondary p-6 rounded-lg">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                    <h3 className="text-lg font-semibold">Transaksionet</h3>
                    <div className="flex items-center gap-2">
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="bg-primary border border-accent rounded-md p-2 text-sm text-text-main focus:ring-highlight focus:border-highlight"
                            aria-label="Data e Fillimit"
                        />
                        <span className="text-text-secondary">deri</span>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="bg-primary border border-accent rounded-md p-2 text-sm text-text-main focus:ring-highlight focus:border-highlight"
                            aria-label="Data e Mbarimit"
                        />
                        <button 
                            onClick={() => { setStartDate(''); setEndDate(''); }}
                            className="px-3 py-2 rounded-md bg-accent text-text-main hover:bg-gray-600 text-sm"
                        >
                            Pastro
                        </button>
                    </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                    {filteredSales.length > 0 ? (
                        <ul className="space-y-4">
                            {filteredSales.map(sale => (
                                <li key={sale.id}>
                                    <div className="bg-primary p-4 rounded-lg shadow-inner">
                                        <div className="flex justify-between text-sm font-semibold text-text-secondary mb-3">
                                            <span>Tavolina: {sale.tableName} | Shfrytëzuesi: {sale.user.username}</span>
                                            <span>{new Date(sale.date).toLocaleString('de-DE')}</span>
                                        </div>
                                        
                                        <table className="w-full text-sm mb-4">
                                            <thead>
                                                <tr className="border-b border-accent">
                                                    <th className="text-left font-semibold text-text-main py-2">Artikulli</th>
                                                    <th className="text-center font-semibold text-text-main py-2">Sasia</th>
                                                    <th className="text-right font-semibold text-text-main py-2">Çmimi</th>
                                                    <th className="text-right font-semibold text-text-main py-2">Totali</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-accent/50">
                                                {sale.order.items.map((item, index) => (
                                                    <tr key={`${sale.id}-${item.id}-${index}`} className="text-text-secondary">
                                                        <td className="py-2">{item.name}</td>
                                                        <td className="text-center py-2">{item.quantity}</td>
                                                        <td className="text-right py-2">{formatCurrency(item.price)}</td>
                                                        <td className="text-right py-2">{formatCurrency((typeof item.price === 'string' ? parseFloat(item.price) : item.price) * item.quantity)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                
                                        <div className="flex justify-between font-bold text-base text-text-main mt-2 pt-2 border-t border-accent">
                                            <span>Shuma Totale:</span>
                                            <span>{formatCurrency(sale.order.total)}</span>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                         <p className="text-text-secondary text-center py-4">Nuk u gjetën transaksione për periudhën e zgjedhur.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Menu Management ---
const MenuManagement: React.FC = () => {
    const { 
        menuItems, addMenuItem, updateMenuItem, deleteMenuItem, reorderMenuItems,
        menuCategories, addMenuCategory, updateMenuCategory, deleteMenuCategory, reorderMenuCategories,
        importMenuItemsFromCSV, reorderMenuItemsFromCSV
    } = usePos();

    // --- NEW: A unified component for all CSV operations ---
    const DataManagement: React.FC = () => {
        const [isImporting, setIsImporting] = useState(false);
        const [isReordering, setIsReordering] = useState(false);
        const importRef = React.useRef<HTMLInputElement>(null);
        const reorderRef = React.useRef<HTMLInputElement>(null);

        const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            setIsImporting(true);
            try {
                const result = await importMenuItemsFromCSV(file);
                alert(`Importi përfundoi!\n- ${result.itemsAdded} artikuj u shtuan.\n- ${result.categoriesAdded} kategori të reja u krijuan.\n- ${result.itemsSkipped} artikuj u anashkaluan (emra dublikatë ose të pavlefshëm).`);
            } catch (error) {
                alert(`Gabim gjatë importit: ${error instanceof Error ? error.message : 'Gabim i panjohur'}`);
            } finally {
                setIsImporting(false);
                if(importRef.current) importRef.current.value = "";
            }
        };
        
        const handleReorderFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            setIsReordering(true);
            try {
                const result = await reorderMenuItemsFromCSV(file);
                alert(`Renditja përfundoi!\n- ${result.reorderedCount} artikuj u renditën.\n- ${result.notFoundCount} artikuj nga skedari nuk u gjetën në sistem.`);
            } catch (error) {
                alert(`Gabim gjatë renditjes: ${error instanceof Error ? error.message : 'Gabim i panjohur'}`);
            } finally {
                setIsReordering(false);
                if(reorderRef.current) reorderRef.current.value = "";
            }
        };

        return (
            <div className="bg-primary p-4 rounded-lg border border-dashed border-accent mt-6 space-y-4">
                {/* Import Section */}
                <div>
                    <h4 className="text-md font-semibold mb-2">Importo Artikuj të Rinj</h4>
                    <p className="text-sm text-text-secondary mb-3">
                        Për të **shtuar** artikuj të rinj. Kërkon kolonat: <strong>Name, Price, Category, Printer</strong>.
                    </p>
                    <input type="file" accept=".csv" onChange={handleImportFile} ref={importRef} className="hidden" id="csv-importer" />
                    <label htmlFor="csv-importer" className={`inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md cursor-pointer hover:bg-green-700 ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <UploadIcon className="w-5 h-5" />
                        <span>{isImporting ? 'Duke importuar...' : 'Zgjidh Skedarin e Importit'}</span>
                    </label>
                </div>
                {/* Reorder Section */}
                <div className="pt-4 border-t border-accent">
                     <h4 className="text-md font-semibold mb-2">Rendit Artikujt Ekzistues</h4>
                    <p className="text-sm text-text-secondary mb-3">
                       Për të **ndryshuar rendin** e artikujve ekzistues. Kërkon vetëm kolonën: <strong>Name</strong>.
                    </p>
                    <input type="file" accept=".csv" onChange={handleReorderFile} ref={reorderRef} className="hidden" id="csv-reorder" />
                    <label htmlFor="csv-reorder" className={`inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md cursor-pointer hover:bg-indigo-700 ${isReordering ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <SortIcon className="w-5 h-5" />
                        <span>{isReordering ? 'Duke renditur...' : 'Zgjidh Skedarin e Renditjes'}</span>
                    </label>
                </div>
            </div>
        );
    };
    
    const [activeSubTab, setActiveSubTab] = useState<'menus' | 'items'>('menus');
    const [isItemModalOpen, setItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [isMenuModalOpen, setMenuModalOpen] = useState(false);
    const [editingMenu, setEditingMenu] = useState<MenuCategory | null>(null);

    const handleAddItem = () => {
        if (menuCategories.length === 0) {
            alert("Ju lutemi shtoni një menu (kategori) fillimisht para se të shtoni një artikull.");
            setActiveSubTab('menus');
            return;
        }
        setEditingItem(null);
        setItemModalOpen(true);
    };

    const handleEditItem = (item: MenuItem) => {
        setEditingItem(item);
        setItemModalOpen(true);
    };
    const handleSaveItem = async (itemData: Omit<MenuItem, 'id'> | MenuItem) => {
        if('id' in itemData && itemData.id > 0) {
            await updateMenuItem(itemData as MenuItem);
        } else {
            await addMenuItem(itemData as Omit<MenuItem, 'id'>);
        }
        setItemModalOpen(false);
        setEditingItem(null);
    };
    
    const handleAddMenu = () => {
        setEditingMenu(null);
        setMenuModalOpen(true);
    };
    const handleEditMenu = (menu: MenuCategory) => {
        setEditingMenu(menu);
        setMenuModalOpen(true);
    };
    const handleSaveMenu = async (menuData: MenuCategory) => {
        if (editingMenu) {
            await updateMenuCategory(menuData);
        } else {
            await addMenuCategory(menuData.name);
        }
        setMenuModalOpen(false);
        setEditingMenu(null);
    };
    
    const handleDragEnd = (result: DropResult) => {
        const { destination, source, type } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;
        
        if (type === 'CATEGORIES') {
            const reordered = Array.from(menuCategories);
            const [removed] = reordered.splice(source.index, 1);
            reordered.splice(destination.index, 0, removed);
            reorderMenuCategories(reordered);
        }
        
        if (type === 'ITEMS') {
            const reordered = Array.from(menuItems);
            const [removed] = reordered.splice(source.index, 1);
            reordered.splice(destination.index, 0, removed);
            reorderMenuItems(reordered);
        }
    };

    const tabButtonBaseClasses = "px-4 py-2 text-sm font-medium transition-colors";
    const activeTabClasses = "border-b-2 border-highlight text-highlight";
    const inactiveTabClasses = "text-text-secondary hover:text-text-main border-b-2 border-transparent";

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="bg-secondary p-6 rounded-lg">
                <div className="flex border-b border-accent mb-4">
                    <button onClick={() => setActiveSubTab('menus')} className={`${tabButtonBaseClasses} ${activeSubTab === 'menus' ? activeTabClasses : inactiveTabClasses}`}>Menutë</button>
                    <button onClick={() => setActiveSubTab('items')} className={`${tabButtonBaseClasses} ${activeSubTab === 'items' ? activeTabClasses : inactiveTabClasses}`}>Artikujt</button>
                </div>

                {activeSubTab === 'menus' && (
                     <div key="menus-tab">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Rendit Menutë (Kategoritë)</h3>
                            <button onClick={handleAddMenu} className="flex items-center space-x-2 px-4 py-2 bg-highlight text-white rounded-md hover:bg-blue-600"><PlusIcon className="w-5 h-5" /><span>Shto Menu</span></button>
                        </div>
                        <div> 
                            <table className="w-full text-left">
                                <thead className="bg-accent">
                                    <tr>
                                        <th className="p-3 w-12">Rendit</th>
                                        <th className="p-3">Emri i Menusë</th>
                                        <th className="p-3">Veprimet</th>
                                    </tr>
                                </thead>
                                <Droppable droppableId="categories-droppable" type="CATEGORIES">
                                    {(provided) => (
                                        <tbody ref={provided.innerRef} {...provided.droppableProps} className="divide-y divide-accent">
                                            {menuCategories.map((menu, index) => (
                                                <Draggable key={menu.id} draggableId={menu.id.toString()} index={index}>
                                                    {(provided, snapshot) => (
                                                        <tr ref={provided.innerRef} {...provided.draggableProps} className={snapshot.isDragging ? 'bg-highlight/20' : ''}>
                                                            <td className="p-3 text-text-secondary" {...provided.dragHandleProps}>
                                                                <DragHandleIcon className="w-6 h-6" />
                                                            </td>
                                                            <td className="p-3">{menu.name}</td>
                                                            <td className="p-3">
                                                                <div className="flex space-x-2">
                                                                    <button onClick={() => handleEditMenu(menu)} className="p-2 text-blue-400 hover:text-blue-300"><EditIcon className="w-5 h-5"/></button>
                                                                    <button onClick={() => deleteMenuCategory(menu.id)} className="p-2 text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </tbody>
                                    )}
                                </Droppable>
                            </table>
                        </div>
                        <Modal isOpen={isMenuModalOpen} onClose={() => setMenuModalOpen(false)} title={editingMenu ? "Ndrysho Menunë" : "Shto Menu të Re"}>
                            <MenuForm menu={editingMenu} onSave={handleSaveMenu} onCancel={() => setMenuModalOpen(false)} />
                        </Modal>
                    </div>
                )}

                {activeSubTab === 'items' && (
                    <div key="items-tab">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Rendit Artikujt e Menusë</h3>
                             <button onClick={handleAddItem} className="flex items-center space-x-2 px-4 py-2 bg-highlight text-white rounded-md hover:bg-blue-600"><PlusIcon className="w-5 h-5" /><span>Shto Artikull</span></button>
                        </div>
                        <div>
                             <table className="w-full text-left">
                                <thead className="bg-accent">
                                    <tr>
                                        <th className="p-3 w-12">Rendit</th>
                                        <th className="p-3">Emri</th>
                                        <th className="p-3">Menu</th>
                                        <th className="p-3">Printeri</th>
                                        <th className="p-3">Çmimi</th>
                                        <th className="p-3">Veprimet</th>
                                    </tr>
                                </thead>
                                <Droppable droppableId="items-droppable" type="ITEMS">
                                    {(provided) => (
                                        <tbody ref={provided.innerRef} {...provided.droppableProps} className="divide-y divide-accent">
                                            {menuItems.map((item, index) => (
                                                <Draggable key={item.id} draggableId={item.id.toString()} index={index}>
                                                    {(provided, snapshot) => (
                                                        <tr ref={provided.innerRef} {...provided.draggableProps} className={snapshot.isDragging ? 'bg-highlight/20' : ''}>
                                                            <td className="p-3 text-text-secondary" {...provided.dragHandleProps}>
                                                                <DragHandleIcon className="w-6 h-6" />
                                                            </td>
                                                            <td className="p-3">{item.name}</td>
                                                            <td className="p-3">{item.category}</td>
                                                            <td className="p-3">{item.printer}</td>
                                                            <td className="p-3">{formatCurrency(item.price)}</td>
                                                            <td className="p-3">
                                                                <div className="flex space-x-2">
                                                                    <button onClick={() => handleEditItem(item)} className="p-2 text-blue-400 hover:text-blue-300"><EditIcon className="w-5 h-5"/></button>
                                                                    <button onClick={() => deleteMenuItem(item.id)} className="p-2 text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </tbody>
                                    )}
                                </Droppable>
                            </table>
                        </div>
                        <Modal isOpen={isItemModalOpen} onClose={() => setItemModalOpen(false)} title={editingItem ? "Ndrysho Artikullin e Menusë" : "Shto Artikull të Ri në Menu"}>
                            <MenuItemForm item={editingItem} onSave={handleSaveItem} onCancel={() => setItemModalOpen(false)} />
                        </Modal>
                        {/* --- NEW: Replaced the individual components with the unified one --- */}
                        <DataManagement />
                    </div>
                )}
            </div>
        </DragDropContext>
    );
};


// --- Stock Management ---
const StockManagement: React.FC = ({}) => {
    // ... (This component is unchanged)
    const { menuItems, updateMenuItem } = usePos();
    const [localItems, setLocalItems] = useState<MenuItem[]>([]);
    const [isSaving, setIsSaving] = useState<{[key: number]: boolean}>({});

    useEffect(() => {
        setLocalItems([...menuItems].sort((a, b) => a.name.localeCompare(b.name)));
    }, [menuItems]);

    const handleInputChange = (itemId: number, field: 'stock' | 'stockThreshold' | 'trackStock', value: string | boolean) => {
        setLocalItems(prev => prev.map(item => {
            if (item.id === itemId) {
                if (field === 'trackStock') {
                    return { ...item, trackStock: !!value };
                }
                let finalValue: number;
                if (field === 'stock') {
                    finalValue = value === '' ? Infinity : parseInt(value as string, 10);
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

    return (
        <div className="bg-secondary p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-text-main">Menaxhimi i Stokut</h3>
            <div className="max-h-[75vh] overflow-y-auto">
                <table className="w-full text-left">
                    <thead className="bg-accent sticky top-0 z-10">
                        <tr>
                            <th className="p-3">Artikulli</th>
                            <th className="p-3 w-32">Ndjek Stokun</th>
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
                                    <td className="p-3">{item.name}</td>
                                    <td className="p-3">
                                        <label htmlFor={`track-${item.id}`} className="flex items-center cursor-pointer">
                                            <div className="relative">
                                                <input type="checkbox" id={`track-${item.id}`} className="sr-only" checked={item.trackStock} onChange={(e) => handleInputChange(item.id, 'trackStock', e.target.checked)} />
                                                <div className={`block w-10 h-6 rounded-full ${item.trackStock ? 'bg-highlight' : 'bg-accent'}`}></div>
                                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${item.trackStock ? 'transform translate-x-4' : ''}`}></div>
                                            </div>
                                        </label>
                                    </td>
                                    <td className="p-3">
                                        <input 
                                            type="number"
                                            value={item.trackStock && isFinite(item.stock) ? item.stock : ''}
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
                                            value={item.stockThreshold}
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
        </div>
    );
};

// --- Tax Settings ---
const TaxSettings: React.FC = ({}) => {
    // ... (This component is unchanged)
    const { taxRate, setTaxRate } = usePos();
    const [tax, setTax] = useState(taxRate * 100);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const newTax = Math.max(0, tax);
            await setTaxRate(newTax);
            alert(`Norma e tatimit u ruajt: ${newTax}%.`);
        } catch (error) {
            alert("Ruajtja e normës së tatimit dështoi.");
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="bg-secondary p-6 rounded-lg max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold mb-4 text-text-main">Tatimi</h3>
            <div className="space-y-6 bg-primary p-6 rounded-lg">
                <div>
                    <label htmlFor="taxRate" className="block text-sm font-medium text-text-secondary">Norma e Tatimit (%)</label>
                    <input 
                        type="number" 
                        id="taxRate"
                        value={tax}
                        onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.1"
                        className="mt-1 block w-full bg-secondary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight"
                    />
                    <p className="text-xs text-text-secondary mt-1">Vendosni 0 për të çaktivizuar tatimin dhe fshehur rreshtat e nëntotalit/tatimit. Mos e përfshini simbolin %.</p>
                </div>
                 <div className="flex justify-end pt-2">
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 rounded-lg bg-highlight text-white font-bold hover:bg-blue-600 transition-colors disabled:bg-gray-500">
                        {isSaving ? 'Duke ruajtur...' : 'Ruaj Ndryshimet'}
                    </button>
                 </div>
            </div>
        </div>
    );
};

// --- Table Settings ---
const TableSettings: React.FC = ({}) => {
    // ... (This component is unchanged)
    const { tables, setTableCount, tablesPerRow, setTablesPerRow, tableSizePercent, setTableSizePercent, tableButtonSizePercent, setTableButtonSizePercent } = usePos();
    const [count, setCount] = useState(tables.length);
    const [perRow, setPerRow] = useState(tablesPerRow);
    const [size, setSize] = useState(tableSizePercent);
    const [buttonSize, setButtonSize] = useState(tableButtonSizePercent);

    const handleSave = () => {
        const newCount = Math.max(1, count);
        const newPerRow = Math.max(1, perRow);
        const newSize = Math.max(50, Math.min(200, size));
        const newButtonSize = Math.max(50, Math.min(200, buttonSize));
        
        setTableCount(newCount);
        setTablesPerRow(newPerRow);
        setTableSizePercent(newSize);
        setTableButtonSizePercent(newButtonSize);
        alert(`Ndryshimet e tavolinave u ruajtën: ${newCount} tavolina, ${newPerRow} për rresht, madhësia e tekstit ${newSize}%, madhësia e butonit ${newButtonSize}%.`);
    };
    
    return (
        <div className="bg-secondary p-6 rounded-lg max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold mb-4 text-text-main">Tavolinat</h3>
            <div className="space-y-6 bg-primary p-6 rounded-lg">
                <div>
                    <label htmlFor="tableCount" className="block text-sm font-medium text-text-secondary">Numri i Tavolinave</label>
                    <input 
                        type="number" 
                        id="tableCount"
                        value={count}
                        onChange={(e) => setCount(parseInt(e.target.value, 10))}
                        min="1"
                        className="mt-1 block w-full bg-secondary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight"
                    />
                    <p className="text-xs text-text-secondary mt-1">Cakto numrin total të tavolinave të disponueshme në POS.</p>
                </div>
                <div>
                    <label htmlFor="tablesPerRow" className="block text-sm font-medium text-text-secondary">Tavolina për Rresht</label>
                    <input 
                        type="number" 
                        id="tablesPerRow"
                        value={perRow}
                        onChange={(e) => setPerRow(parseInt(e.target.value, 10) || 1)}
                        min="1"
                        className="mt-1 block w-full bg-secondary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight"
                    />
                    <p className="text-xs text-text-secondary mt-1">Sa tavolina të shfaqen në një rresht.</p>
                </div>
                <div>
                    <label htmlFor="tableSizePercent" className="block text-sm font-medium text-text-secondary">Madhësia e Tekstit (%)</label>
                    <input 
                        type="number" 
                        id="tableSizePercent"
                        value={size}
                        onChange={(e) => setSize(parseInt(e.target.value, 10) || 100)}
                        min="50"
                        max="200"
                        step="10"
                        className="mt-1 block w-full bg-secondary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight"
                    />
                    <p className="text-xs text-text-secondary mt-1">Rregullo madhësinë e tekstit brenda butonave të tavolinës (50-200%).</p>
                </div>
                <div>
                    <label htmlFor="tableButtonSizePercent" className="block text-sm font-medium text-text-secondary">Madhësia e Butonit (%)</label>
                    <input 
                        type="number" 
                        id="tableButtonSizePercent"
                        value={buttonSize}
                        onChange={(e) => setButtonSize(parseInt(e.target.value, 10) || 100)}
                        min="50"
                        max="200"
                        step="10"
                        className="mt-1 block w-full bg-secondary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight"
                    />
                    <p className="text-xs text-text-secondary mt-1">Rregullo madhësinë e butonit të tavolinës (50-200%).</p>
                </div>
                 <div className="flex justify-end pt-2">
                    <button onClick={handleSave} className="px-6 py-3 rounded-lg bg-highlight text-white font-bold hover:bg-blue-600 transition-colors">
                        Ruaj Ndryshimet
                    </button>
                 </div>
            </div>
        </div>
    );
};

// --- DeviceSettings Component ---
const DeviceSettings: React.FC = ({}) => {
    // ... (This component is unchanged)
    const [isPrintStation, setIsPrintStation] = useState(localStorage.getItem('isPrintStation') === 'true');

    const handleSetPrintStation = () => {
        localStorage.setItem('isPrintStation', 'true');
        setIsPrintStation(true);
        alert('Kjo pajisje është caktuar si stacioni i printimit.');
    };

    const handleUnsetPrintStation = () => {
        localStorage.removeItem('isPrintStation');
        setIsPrintStation(false);
        alert('Kjo pajisje nuk është më stacioni i printimit.');
    };
    
    return (
        <div className="bg-secondary p-6 rounded-lg max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold mb-4 text-text-main">Cilësimet e Pajisjes</h3>
            <div className="space-y-6 bg-primary p-6 rounded-lg">
                <div>
                    <p className="text-text-secondary mb-4">
                        Caktoni këtë pajisje (kompjuterin tuaj) si stacionin kryesor për printimin e faturave. 
                        Vetëm stacioni i printimit do të hapë dialogun e printimit kur një faturë finalizohet, 
                        pavarësisht se nga cila pajisje është bërë shitja.
                    </p>
                </div>
                 <div className="flex justify-center pt-2">
                    {isPrintStation ? (
                        <div className="text-center">
                            <p className="text-green-400 font-bold mb-4">✅ Kjo pajisje është stacioni i printimit.</p>
                            <button 
                                onClick={handleUnsetPrintStation} 
                                className="px-6 py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors"
                            >
                                Hiq si Stacion Printimi
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={handleSetPrintStation} 
                            className="px-6 py-3 rounded-lg bg-highlight text-white font-bold hover:bg-blue-600 transition-colors"
                        >
                            Cakto si Stacion Printimi
                        </button>
                    )}
                 </div>
            </div>
        </div>
    );
};


// --- Main Admin Screen Component ---
type AdminTab = 'sales' | 'menu' | 'stock' | 'users' | 'tax' | 'tables' | 'device';

interface AdminScreenProps {
    onClose: () => void;
}

const AdminScreen: React.FC<AdminScreenProps> = ({ onClose }) => {
  const { loggedInUser } = usePos();
  const [activeTab, setActiveTab] = useState<AdminTab>('sales');

  return (
    <div className="fixed inset-0 bg-primary z-50 flex flex-col">
      <header className="flex-shrink-0 bg-secondary flex items-center justify-between p-4 shadow-md z-10">
        <h1 className="text-xl font-bold text-text-main">Paneli i Administratorit</h1>
        <div className="flex items-center space-x-4">
          <span className="text-text-secondary">Mirë se vini, {loggedInUser?.username}</span>
          <button onClick={onClose} className="p-2 rounded-full text-text-secondary hover:bg-accent hover:text-white transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
      </header>
      
      <div className="flex flex-grow overflow-hidden">
        <nav className="w-64 bg-secondary p-4 space-y-2">
            <button onClick={() => setActiveTab('sales')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition-colors ${activeTab === 'sales' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <ChartBarIcon className="w-6 h-6"/>
                <span>Raporti i Shitjeve</span>
            </button>
            <button onClick={() => setActiveTab('menu')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition-colors ${activeTab === 'menu' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <MenuIcon className="w-6 h-6"/>
                <span>Menaxhimi i Menusë</span>
            </button>
             <button onClick={() => setActiveTab('stock')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition-colors ${activeTab === 'stock' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <BoxIcon className="w-6 h-6"/>
                <span>Stoku</span>
            </button>
            <button onClick={() => setActiveTab('users')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition-colors ${activeTab === 'users' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <UserGroupIcon className="w-6 h-6"/>
                <span>Menaxhimi i Përdoruesve</span>
            </button>
            <button onClick={() => setActiveTab('tables')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition-colors ${activeTab === 'tables' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <TableIcon className="w-6 h-6"/>
                <span>Tavolinat</span>
            </button>
            <button onClick={() => setActiveTab('tax')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition-colors ${activeTab === 'tax' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <PercentIcon className="w-6 h-6"/>
                <span>Tatimi</span>
            </button>
            <button onClick={() => setActiveTab('device')} className={`w-full flex items-center space-x-3 p-3 rounded-md text-left transition-colors ${activeTab === 'device' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <PrinterIcon className="w-6 h-6"/>
                <span>Pajisja</span>
            </button>
        </nav>

        <main className="flex-grow p-6 overflow-y-auto">
            {activeTab === 'sales' && <SalesDashboard />}
            {activeTab === 'menu' && <MenuManagement />}
            {activeTab === 'stock' && <StockManagement />}
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'tax' && <TaxSettings />}
            {activeTab === 'tables' && <TableSettings />}
            {activeTab === 'device' && <DeviceSettings />}
        </main>
      </div>
    </div>
  );
};

export default AdminScreen;