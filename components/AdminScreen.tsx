import React, { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import * as api from '../utils/api'; // <--- Added API import
import ToggleSwitch from './common/ToggleSwitch';
import { MenuItem, MenuCategory, Printer, User, StockMovement } from '../types'; // <--- Added StockMovement
import { EditIcon, TrashIcon, PlusIcon, CloseIcon, MenuIcon, TableIcon, PercentIcon, UserGroupIcon, BoxIcon, PrinterIcon, UploadIcon, DragHandleIcon, SortIcon, RestaurantIcon, MinusCircleIcon } from './common/Icons';
import UserManagement from './UserManagement';
import StockSupply from './StockSupply';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

const formatCurrency = (amount: number | string) => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericAmount)) return '...';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(numericAmount);
};

const ClockIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

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
        stockGroupId: item?.stockGroupId || '', // <--- NEW FIELD
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
                dataToSave.stockGroupId = ''; 
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
            
            {/* --- NEW SECTION FOR STOCK GROUP --- */}
            <div className={`transition-opacity duration-300 ${formData.trackStock ? 'opacity-100' : 'opacity-50'}`}>
                <label htmlFor="stockGroupId" className="block text-sm font-medium text-text-secondary">Grupi i Stokut (ID e Përbashkët)</label>
                <input type="text" name="stockGroupId" id="stockGroupId" value={formData.stockGroupId} onChange={handleChange} placeholder="psh. CAFFE (për të ndarë stokun)" className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight" disabled={!formData.trackStock} />
                <p className="text-xs text-text-secondary mt-1">Artikujt me të njëjtin ID grupi (psh. "CAFFE") do të kenë stok të përbashkët.</p>
            </div>

            <div className={`transition-opacity duration-300 ${formData.trackStock ? 'opacity-100' : 'opacity-50'}`}>
                <label htmlFor="stock" className="block text-sm font-medium text-text-secondary">Stoku Fillestar</label>
                <input type="number" name="stock" id="stock" value={(formData.stock !== null && isFinite(formData.stock)) ? formData.stock : ''} onChange={handleChange} placeholder="Bosh për stok pa limit" min="0" className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight" disabled={!formData.trackStock} />
            </div>
            <div className={`transition-opacity duration-300 ${formData.trackStock ? 'opacity-100' : 'opacity-50'}`}>
                <label htmlFor="stockThreshold" className="block text-sm font-medium text-text-secondary">Pragu i Stokut të Ulët</label>
                <input type="number" name="stockThreshold" id="stockThreshold" value={formData.stockThreshold ?? ''} onChange={handleChange} min="0" className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight" disabled={!formData.trackStock}/>
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
                                            // FIX: Check for null explicitly to avoid React warning
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
                                            // FIX: Check for null explicitly to avoid React warning
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




// --- Printing Settings Component ---
const PrintingSettings: React.FC = () => {
    const [isPrintStation, setIsPrintStation] = useState(false);
    const [printOrdersEnabled, setPrintOrdersEnabled] = useState(false);
    const [printReceiptsEnabled, setPrintReceiptsEnabled] = useState(false);
    
    useEffect(() => {
        // Load initial state from localStorage, respecting defaults
        setIsPrintStation(localStorage.getItem('isPrintStation') === 'true');
        setPrintOrdersEnabled(localStorage.getItem('isOrderTicketPrintingEnabled') !== 'false');
        setPrintReceiptsEnabled(localStorage.getItem('isReceiptPrintingEnabled') !== 'false');
    }, []);

    const handlePrintStationChange = (enabled: boolean) => {
        setIsPrintStation(enabled);
        localStorage.setItem('isPrintStation', String(enabled));
    };
    
    const handleOrderPrintingChange = (enabled: boolean) => {
        setPrintOrdersEnabled(enabled);
        localStorage.setItem('isOrderTicketPrintingEnabled', String(enabled));
    };

    const handleReceiptPrintingChange = (enabled: boolean) => {
        setPrintReceiptsEnabled(enabled);
        localStorage.setItem('isReceiptPrintingEnabled', String(enabled));
    };

    return (
        <div className="bg-secondary p-6 rounded-lg max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold mb-2 text-text-main">Konfigurimi i Printimit</h3>
            <p className="text-gray-400 mb-6">Menaxho se si dhe ku printohen porositë dhe faturat për këtë pajisje.</p>
            <div className="bg-primary rounded-lg p-6">
                <ToggleSwitch
                    label="Stacion Printimi"
                    description="Aktivizo këtë nëse ky kompjuter është i lidhur direkt me printerët."
                    enabled={isPrintStation}
                    onChange={handlePrintStationChange}
                />
                <ToggleSwitch
                    label="Printimi i Porosisë (Kuzhinë/Shank)"
                    description="Printo automatikisht një fletë-porosi kur dërgohen artikuj të rinj."
                    enabled={printOrdersEnabled}
                    onChange={handleOrderPrintingChange}
                />
                <ToggleSwitch
                    label="Printimi i Faturës"
                    description="Printo automatikisht faturën për klientin pasi të finalizohet shitja."
                    enabled={printReceiptsEnabled}
                    onChange={handleReceiptPrintingChange}
                />
            </div>
        </div>
    );
};


// --- Profile Settings Component ---
const ProfileSettings: React.FC = () => {
    const { companyInfo, updateCompanySettings } = usePos();
    const [formData, setFormData] = useState({ ...companyInfo });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setFormData({ ...companyInfo });
    }, [companyInfo]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateCompanySettings(formData);
            alert('Të dhënat e biznesit u ruajtën me sukses!');
        } catch (error) {
            alert('Ruajtja dështoi.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-secondary p-6 rounded-lg max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold mb-6 text-text-main">Të Dhënat e Biznesit</h3>
            <div className="space-y-4 bg-primary p-6 rounded-lg">
                <div>
                    <label className="block text-sm font-medium text-text-secondary">Emri i Biznesit</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full bg-secondary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight" placeholder="Emri i Restorantit" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary">NUI (Numri Unik Identifikues)</label>
                    <input type="text" name="nui" value={formData.nui} onChange={handleChange} className="mt-1 block w-full bg-secondary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight" placeholder="psh. 812345678" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary">Adresa</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange} className="mt-1 block w-full bg-secondary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight" placeholder="Rruga, Qyteti" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary">Numri i Telefonit</label>
                    <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full bg-secondary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight" placeholder="+383 4X XXX XXX" />
                </div>
                <div className="flex justify-end pt-4">
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 rounded-lg bg-highlight text-white font-bold hover:bg-blue-600 transition-colors disabled:bg-gray-500">
                        {isSaving ? 'Duke ruajtur...' : 'Ruaj Të Dhënat'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main Admin Screen Component ---
type AdminTab = 'menu' | 'stock' | 'supply' | 'users' | 'tax' | 'tables' | 'printimi' | 'profile';

// Note: No props needed as it's a top-level route now
const AdminScreen: React.FC = () => {
  const { loggedInUser, setActiveScreen } = usePos();
  const [activeTab, setActiveTab] = useState<AdminTab>('menu');

  return (
    <div className="fixed inset-0 bg-primary z-50 flex flex-col">
      <header className="flex-shrink-0 bg-secondary flex items-center justify-between p-4 shadow-md z-10">
        <h1 className="text-xl font-bold text-text-main">Menaxhimi</h1>
        <div className="flex items-center space-x-4">
          <button onClick={() => setActiveScreen('pos')} className="px-4 py-2 bg-accent text-text-main font-semibold rounded-lg hover:bg-highlight transition-colors flex items-center space-x-2">
            <RestaurantIcon className="w-5 h-5" />
            <span>POS</span>
          </button>
          <button onClick={() => setActiveScreen('sales')} className="px-4 py-2 bg-accent text-text-main font-semibold rounded-lg hover:bg-highlight transition-colors">
             Raporte
          </button>
          <span className="text-text-secondary ml-4"> {loggedInUser?.username}</span>
          <button onClick={() => setActiveScreen('pos')} className="p-2 rounded-full text-text-secondary hover:bg-accent hover:text-white transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Changed layout from row (sidebar) to col (top tabs) */}
      <div className="flex flex-col flex-grow overflow-hidden">
        {/* Horizontal Scrollable Tabs */}
        <nav className="w-full bg-secondary p-2 flex overflow-x-auto space-x-2 border-b border-accent flex-shrink-0">
            <button onClick={() => setActiveTab('menu')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'menu' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <MenuIcon className="w-5 h-5"/>
                <span>Menutë</span>
            </button>
            <button onClick={() => setActiveTab('stock')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'stock' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <BoxIcon className="w-5 h-5"/>
                <span>Stoku</span>
            </button>
            <button onClick={() => setActiveTab('supply')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'supply' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <UploadIcon className="w-5 h-5"/>
                <span>Furnizim</span>
            </button>
            <button onClick={() => setActiveTab('users')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'users' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <UserGroupIcon className="w-5 h-5"/>
                <span>Përdoruesit</span>
            </button>
            <button onClick={() => setActiveTab('tables')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'tables' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <TableIcon className="w-5 h-5"/>
                <span>Tavolinat</span>
            </button>
            <button onClick={() => setActiveTab('tax')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'tax' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <PercentIcon className="w-5 h-5"/>
                <span>Tatimi</span>
            </button>

            <button onClick={() => setActiveTab('printimi')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'printimi' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <PrinterIcon className="w-5 h-5"/>
                <span>Printimi</span>
            </button>
            <button onClick={() => setActiveTab('profile')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'profile' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <RestaurantIcon className="w-5 h-5"/>
                <span>Profil</span>
            </button>
        </nav>

        {/* Main Content (Scrolls independently) */}
        <main className="flex-grow p-4 md:p-6 overflow-y-auto w-full">
            {activeTab === 'menu' && <MenuManagement />}
            {activeTab === 'stock' && <StockManagement />}
            {activeTab === 'supply' && <StockSupply />}
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'tax' && <TaxSettings />}
            {activeTab === 'tables' && <TableSettings />}
            {activeTab === 'printimi' && <PrintingSettings />}
            {activeTab === 'profile' && <ProfileSettings />}
        </main>
      </div>
    </div>
  );
};

export default AdminScreen;