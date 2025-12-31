// src/components/admin/MenuTab.tsx

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next'; // LEFT: Import translation hook
import { usePos } from '../../context/PosContext';
import { MenuItem, MenuCategory, Printer } from '../../types';
import { EditIcon, TrashIcon, PlusIcon, UploadIcon, DragHandleIcon, SortIcon, CloseIcon } from '../common/Icons';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProps } from 'react-beautiful-dnd';

// --- StrictModeDroppable Fix for React 18 ---
export const StrictModeDroppable = ({ children, ...props }: DroppableProps) => {
    const [enabled, setEnabled] = useState(false);
    React.useEffect(() => {
        const animation = requestAnimationFrame(() => setEnabled(true));
        return () => {
            cancelAnimationFrame(animation);
            setEnabled(false);
        };
    }, []);
    if (!enabled) {
        return null;
    }
    return <Droppable {...props}>{children}</Droppable>;
};

// --- Utility Functions & Components specific to this tab ---

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

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title: string;
}
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-primary/75 z-[60] flex justify-center items-center">
            <div className="bg-secondary rounded-lg shadow-xl w-full max-w-lg m-4">
                <div className="flex justify-between items-center p-4 border-b border-border">
                    <h3 className="text-xl font-semibold text-tmain">{title}</h3>
                    <button onClick={onClose} className="text-tsecondary hover:text-tmain"><CloseIcon className="w-6 h-6" /></button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};


interface MenuItemFormProps {
    item: Omit<MenuItem, 'id'> | MenuItem | null;
    onSave: (item: Omit<MenuItem, 'id'> | MenuItem) => Promise<void>;
    onCancel: () => void;
}
const MenuItemForm: React.FC<MenuItemFormProps> = ({ item, onSave, onCancel }) => {
    const { t } = useTranslation(); // LEFT: Init translation
    const { menuCategories } = usePos();
    const [formData, setFormData] = useState({
        name: item?.name || '',
        price: item?.price || 0,
        category: item?.category || (menuCategories.length > 0 ? menuCategories[0].name : ''),
        printer: item?.printer || Printer.KITCHEN,
        // Start at 0 for new items if not provided, preserve existing stock on edit
        stock: item?.stock ?? 0,
        stockThreshold: item?.stockThreshold ?? 0,
        trackStock: item?.trackStock ?? true,
        stockGroupId: item?.stockGroupId || '',
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
                finalValue = parseFloat(value) || 0;
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
            // Note: 'stock' is sent but user cannot edit it here anymore.
            // It preserves the value from initialization (existing stock) or 0 (new).
            await onSave({ ...item, ...dataToSave });
        } catch (error) {
            console.error("Failed to save menu item:", error);
            alert(t('admin.menu.alerts.save_fail'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-tsecondary">{t('common.name')}</label>
                <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full bg-primary border-border rounded-md p-2 text-tmain focus:ring-highlight focus:border-highlight" />
            </div>
            <div>
                <label htmlFor="price" className="block text-sm font-medium text-tsecondary">{t('admin.menu.form_price')}</label>
                <input type="number" name="price" id="price" value={formData.price} onChange={handleChange} required step="0.01" min="0" className="mt-1 block w-full bg-primary border-border rounded-md p-2 text-tmain focus:ring-highlight focus:border-highlight" />
            </div>
            <div>
                <label htmlFor="category" className="block text-sm font-medium text-tsecondary">{t('admin.menu.form_category')}</label>
                <select name="category" id="category" value={formData.category} onChange={handleChange} required className="mt-1 block w-full bg-primary border-border rounded-md p-2 text-tmain focus:ring-highlight focus:border-highlight">
                    <option value="" disabled>{t('admin.menu.select_category')}</option>
                    {menuCategories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="printer" className="block text-sm font-medium text-tsecondary">{t('admin.menu.form_printer')}</label>
                <select name="printer" id="printer" value={formData.printer} onChange={handleChange} required className="mt-1 block w-full bg-primary border-border rounded-md p-2 text-tmain focus:ring-highlight focus:border-highlight">
                    <option value={Printer.KITCHEN}>{t('admin.menu.kitchen')}</option>
                    <option value={Printer.BAR}>{t('admin.menu.bar')}</option>
                </select>
            </div>
            <div className="flex items-center space-x-2 pt-2">
                <input type="checkbox" name="trackStock" id="trackStock" checked={formData.trackStock} onChange={handleChange} className="h-4 w-4 rounded border-border text-highlight focus:ring-highlight" />
                <label htmlFor="trackStock" className="text-sm font-medium text-tsecondary">{t('admin.menu.track_stock')}</label>
            </div>

            <div className={`transition-opacity duration-300 ${formData.trackStock ? 'opacity-100' : 'opacity-50'}`}>
                <label htmlFor="stockGroupId" className="block text-sm font-medium text-tsecondary">{t('admin.menu.stock_group')}</label>
                <input type="text" name="stockGroupId" id="stockGroupId" value={formData.stockGroupId} onChange={handleChange} placeholder="psh. CAFFE (për të ndarë stokun)" className="mt-1 block w-full bg-primary border-border rounded-md p-2 text-tmain focus:ring-highlight focus:border-highlight" disabled={!formData.trackStock} />
                <p className="text-xs text-tsecondary mt-1">{t('admin.menu.stock_group_hint')}</p>
            </div>

            <div className={`transition-opacity duration-300 ${formData.trackStock ? 'opacity-100' : 'opacity-50'}`}>
                <label htmlFor="stockThreshold" className="block text-sm font-medium text-tsecondary">{t('admin.menu.stock_threshold')}</label>
                <input type="number" name="stockThreshold" id="stockThreshold" value={formData.stockThreshold ?? ''} onChange={handleChange} min="0" className="mt-1 block w-full bg-primary border-border rounded-md p-2 text-tmain focus:ring-highlight focus:border-highlight" disabled={!formData.trackStock} />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-border text-tmain hover:bg-muted">{t('common.cancel')}</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-md bg-highlight text-white hover:bg-highlight-hover disabled:bg-muted">{isSaving ? t('common.saving') : t('admin.menu.save_item')}</button>
            </div>
        </form>
    )
}

interface MenuFormProps {
    menu: MenuCategory | null;
    onSave: (menu: MenuCategory) => Promise<void>;
    onCancel: () => void;
}
const MenuForm: React.FC<MenuFormProps> = ({ menu, onSave, onCancel }) => {
    const { t } = useTranslation(); // LEFT: Init translation
    const [name, setName] = useState(menu?.name || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave({ id: menu?.id || 0, name, display_order: menu?.display_order || 0 });
        } catch (error) {
            console.error("Failed to save menu:", error);
            alert(t('admin.menu.alerts.save_fail'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="menu-name" className="block text-sm font-medium text-tsecondary">{t('common.name')}</label>
                <input type="text" id="menu-name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block w-full bg-primary border-border rounded-md p-2 text-tmain focus:ring-highlight focus:border-highlight" />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-border text-tmain hover:bg-muted">{t('common.cancel')}</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-md bg-highlight text-white hover:bg-highlight-hover disabled:bg-muted">{isSaving ? t('common.saving') : t('admin.menu.save_menu')}</button>
            </div>
        </form>
    );
};

// --- Main Tab Component ---
const MenuTab: React.FC = () => {
    const { t } = useTranslation(); // LEFT: Init translation
    const {
        menuItems, addMenuItem, updateMenuItem, deleteMenuItem, reorderMenuItems,
        menuCategories, addMenuCategory, updateMenuCategory, deleteMenuCategory, reorderMenuCategories,
        importMenuItemsFromCSV, reorderMenuItemsFromCSV
    } = usePos();

    const [activeSubTab, setActiveSubTab] = useState<'items' | 'categories'>('items');
    const [searchQuery, setSearchQuery] = useState('');
    const [isItemModalOpen, setItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [isMenuModalOpen, setMenuModalOpen] = useState(false);
    const [editingMenu, setEditingMenu] = useState<MenuCategory | null>(null);

    // --- Import & Reorder Logic (Moved from DataManagement) ---
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
            alert(t('admin.menu.alerts.import_success', { added: result.itemsAdded, cats: result.categoriesAdded, skipped: result.itemsSkipped }));
        } catch (error) {
            alert(`Gabim: ${error instanceof Error ? error.message : 'Gabim i panjohur'}`);
        } finally {
            setIsImporting(false);
            if (importRef.current) importRef.current.value = "";
        }
    };

    const handleReorderFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsReordering(true);
        try {
            const result = await reorderMenuItemsFromCSV(file);
            alert(t('admin.menu.alerts.reorder_success', { count: result.reorderedCount }));
        } catch (error) {
            alert(`Gabim: ${error instanceof Error ? error.message : 'Gabim i panjohur'}`);
        } finally {
            setIsReordering(false);
            if (reorderRef.current) reorderRef.current.value = "";
        }
    };

    const filteredItems = menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddItem = () => {
        if (menuCategories.length === 0) {
            alert(t('admin.menu.alerts.no_category'));
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
        if ('id' in itemData && itemData.id > 0) {
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
        if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return;

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

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            {/* Sub-Tabs Navigation */}
            <div className="flex items-center gap-2 mb-4 border-b border-border flex-shrink-0 p-1">
                <button
                    onClick={() => setActiveSubTab('items')}
                    className={`px-5 h-11 flex items-center rounded-lg font-semibold whitespace-nowrap transition-all border ${activeSubTab === 'items'
                        ? 'border-highlight text-highlight shadow-md bg-primary'
                        : 'border-transparent text-tsecondary bg-transparent hover:border-highlight hover:text-highlight hover:bg-primary'
                        }`}
                >
                    {t('admin.menu.items_tab')}
                </button>
                <button
                    onClick={() => setActiveSubTab('categories')}
                    className={`px-5 h-11 flex items-center rounded-lg font-semibold whitespace-nowrap transition-all border ${activeSubTab === 'categories'
                        ? 'border-highlight text-highlight shadow-md bg-primary'
                        : 'border-transparent text-tsecondary bg-transparent hover:border-highlight hover:text-highlight hover:bg-primary'
                        }`}
                >
                    {t('admin.menu.categories_tab')}
                </button>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>

                {/* ITEMS TAB */}
                {activeSubTab === 'items' && (
                    <div className="flex flex-col flex-grow overflow-hidden bg-secondary p-4 md:p-6 rounded-lg shadow-sm animate-fade-in">
                        <div className="flex justify-between items-center mb-4 gap-2 flex-shrink-0">

                            {/* 1. Search Input (Sized Down) */}
                            <div className="relative w-64 md:w-80">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-tsecondary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder={t('admin.menu.search_placeholder')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-border rounded-md leading-5 bg-primary text-tmain placeholder-tsecondary focus:outline-none focus:ring-1 focus:ring-highlight focus:border-highlight sm:text-sm"
                                />
                            </div>

                            {/* 2. Action Buttons (Import/Reorder/Add) */}
                            <div className="flex items-center space-x-2">
                                {/* Import Button */}
                                <input type="file" accept=".csv" onChange={handleImportFile} ref={importRef} className="hidden" id="csv-importer-header" />
                                <label
                                    htmlFor="csv-importer-header"
                                    className={`flex items-center space-x-1 px-3 py-2 bg-success text-white text-sm rounded-md cursor-pointer hover:bg-success-hover transition-colors ${isImporting ? 'opacity-50' : ''}`}
                                    title="Kolonat: Name, Price, Category, Printer"
                                >
                                    <UploadIcon className="w-4 h-4" />
                                    <span className="hidden md:inline">{isImporting ? '...' : t('admin.menu.import')}</span>
                                </label>

                                {/* Reorder Button */}
                                <input type="file" accept=".csv" onChange={handleReorderFile} ref={reorderRef} className="hidden" id="csv-reorder-header" />
                                <label
                                    htmlFor="csv-reorder-header"
                                    className={`flex items-center space-x-1 px-3 py-2 bg-accent text-white text-sm rounded-md cursor-pointer hover:bg-accent-hover transition-colors ${isReordering ? 'opacity-50' : ''}`}
                                    title="Kolonat: Name"
                                >
                                    <SortIcon className="w-4 h-4" />
                                    <span className="hidden md:inline">{isReordering ? '...' : t('admin.menu.reorder')}</span>
                                </label>

                                {/* Add Button */}
                                <button onClick={handleAddItem} className="flex items-center space-x-1 px-3 py-2 bg-highlight text-white text-sm rounded-md hover:bg-highlight-hover transition-colors">
                                    <PlusIcon className="w-4 h-4" />
                                    <span className="hidden md:inline">{t('common.add')}</span>
                                </button>
                            </div>
                        </div>

                        {/* Table Container */}
                        <div className="flex-grow bg-primary rounded-md border border-border overflow-y-auto overflow-x-auto min-h-0">
                            <table className="w-full text-left min-w-[700px] relative">
                                <thead className="bg-border sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-3 w-12 text-tsecondary">#</th>
                                        <th className="p-3 text-tsecondary font-medium">{t('common.name')}</th>
                                        <th className="p-3 text-tsecondary font-medium">{t('admin.menu.table_category')}</th>
                                        <th className="p-3 text-tsecondary font-medium">{t('admin.menu.table_printer')}</th>
                                        <th className="p-3 text-tsecondary font-medium">{t('common.price')}</th>
                                        <th className="p-3 text-tsecondary font-medium">{t('common.actions')}</th>
                                    </tr>
                                </thead>

                                {searchQuery.trim() === '' ? (
                                    <StrictModeDroppable droppableId="items-droppable" type="ITEMS">
                                        {(provided) => (
                                            <tbody ref={provided.innerRef} {...provided.droppableProps} className="divide-y divide-border">
                                                {menuItems.map((item, index) => (
                                                    <Draggable key={item.id} draggableId={item.id.toString()} index={index}>
                                                        {(provided, snapshot) => (
                                                            <tr ref={provided.innerRef} {...provided.draggableProps} className={`hover:bg-border/30 transition-colors ${snapshot.isDragging ? 'bg-highlight/20 shadow-lg' : ''}`}>
                                                                <td className="p-3 text-tsecondary cursor-move" {...provided.dragHandleProps}>
                                                                    <DragHandleIcon className="w-5 h-5" />
                                                                </td>
                                                                <td className="p-3 text-tmain font-medium">{item.name}</td>
                                                                <td className="p-3 text-tsecondary text-sm">{item.category}</td>
                                                                <td className="p-3 text-tsecondary text-sm">{item.printer}</td>
                                                                <td className="p-3 text-highlight font-semibold">{formatCurrency(item.price)}</td>
                                                                <td className="p-3">
                                                                    <div className="flex space-x-2">
                                                                        <button onClick={() => handleEditItem(item)} className="p-1.5 rounded text-highlight hover:bg-highlight/20 transition-colors"><EditIcon className="w-4 h-4" /></button>
                                                                        <button onClick={() => deleteMenuItem(item.id)} className="p-1.5 rounded text-danger hover:bg-danger/20 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </tbody>
                                        )}
                                    </StrictModeDroppable>
                                ) : (
                                    <tbody className="divide-y divide-border">
                                        {filteredItems.length > 0 ? filteredItems.map((item) => (
                                            <tr key={item.id} className="hover:bg-border/30 transition-colors">
                                                <td className="p-3 text-tsecondary opacity-30">
                                                    <div className="w-5 h-5 flex items-center justify-center font-mono text-xs">•</div>
                                                </td>
                                                <td className="p-3 text-tmain font-medium">{item.name}</td>
                                                <td className="p-3 text-tsecondary text-sm">{item.category}</td>
                                                <td className="p-3 text-tsecondary text-sm">{item.printer}</td>
                                                <td className="p-3 text-highlight font-semibold">{formatCurrency(item.price)}</td>
                                                <td className="p-3">
                                                    <div className="flex space-x-2">
                                                        <button onClick={() => handleEditItem(item)} className="p-1.5 rounded hover:bg-highlight-hover text-highlight hover:text-highlight-hover transition-colors"><EditIcon className="w-4 h-4" /></button>
                                                        <button onClick={() => deleteMenuItem(item.id)} className="p-1.5 rounded hover:bg-danger-hover text-danger hover:text-danger-hover transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-tsecondary">
                                                    Nuk u gjet asnjë artikull me emrin "{searchQuery}"
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                )}
                            </table>
                        </div>
                    </div>
                )}

                {/* CATEGORIES TAB */}
                {activeSubTab === 'categories' && (
                    <div className="flex flex-col flex-grow overflow-hidden bg-secondary p-4 md:p-6 rounded-lg shadow-sm animate-fade-in">
                        <div className="flex justify-between items-center mb-4 flex-shrink-0">
                            <h3 className="text-lg font-semibold text-tsecondary">{t('admin.menu.categories_tab')}</h3>
                            <button onClick={handleAddMenu} className="flex items-center space-x-2 px-4 py-2 bg-highlight text-white rounded-md hover:bg-highlight-hover transition-colors">
                                <PlusIcon className="w-5 h-5" /><span>{t('admin.menu.add_category')}</span>
                            </button>
                        </div>

                        <div className="flex-grow bg-primary rounded-md border border-border overflow-y-auto min-h-0">
                            <table className="w-full text-left min-w-[300px] relative">
                                <thead className="bg-border sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-3 w-12 text-tsecondary">#</th>
                                        <th className="p-3 text-tsecondary font-medium">{t('common.name')}</th>
                                        <th className="p-3 text-right text-tsecondary font-medium">{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <StrictModeDroppable droppableId="categories-droppable" type="CATEGORIES">
                                    {(provided) => (
                                        <tbody ref={provided.innerRef} {...provided.droppableProps} className="divide-y divide-border">
                                            {menuCategories.map((menu, index) => (
                                                <Draggable key={menu.id} draggableId={menu.id.toString()} index={index}>
                                                    {(provided, snapshot) => (
                                                        <tr ref={provided.innerRef} {...provided.draggableProps} className={`hover:bg-border/30 transition-colors ${snapshot.isDragging ? 'bg-highlight/20 shadow-lg' : ''}`}>
                                                            <td className="p-3 text-tsecondary cursor-move w-10" {...provided.dragHandleProps}>
                                                                <DragHandleIcon className="w-5 h-5" />
                                                            </td>
                                                            <td className="p-3 text-tmain font-medium">{menu.name}</td>
                                                            <td className="p-3 text-right">
                                                                <div className="flex justify-end space-x-1">
                                                                    <button onClick={() => handleEditMenu(menu)} className="p-1.5 rounded text-highlight hover:bg-highlight/20 transition-colors"><EditIcon className="w-4 h-4" /></button>
                                                                    <button onClick={() => deleteMenuCategory(menu.id)} className="p-1.5 rounded text-danger hover:bg-danger/20 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </tbody>
                                    )}
                                </StrictModeDroppable>
                            </table>
                        </div>
                    </div>
                )}

                {/* MODALS */}
                <Modal isOpen={isItemModalOpen} onClose={() => setItemModalOpen(false)} title={editingItem ? t('admin.menu.titles.edit_item') : t('admin.menu.titles.add_item')}>
                    <MenuItemForm item={editingItem} onSave={handleSaveItem} onCancel={() => setItemModalOpen(false)} />
                </Modal>

                <Modal isOpen={isMenuModalOpen} onClose={() => setMenuModalOpen(false)} title={editingMenu ? t('admin.menu.titles.edit_menu') : t('admin.menu.titles.add_menu')}>
                    <MenuForm menu={editingMenu} onSave={handleSaveMenu} onCancel={() => setMenuModalOpen(false)} />
                </Modal>
            </DragDropContext>
        </div>
    );
};

export default MenuTab;