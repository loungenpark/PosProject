// src/components/admin/MenuTab.tsx

import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { MenuItem, MenuCategory, Printer } from '../../types';
import { EditIcon, TrashIcon, PlusIcon, UploadIcon, DragHandleIcon, SortIcon, CloseIcon } from '../common/Icons';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

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

const DataManagement: React.FC = () => {
    const { importMenuItemsFromCSV, reorderMenuItemsFromCSV } = usePos();
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

// --- Main Tab Component ---
const MenuTab: React.FC = () => {
    const { 
        menuItems, addMenuItem, updateMenuItem, deleteMenuItem, reorderMenuItems,
        menuCategories, addMenuCategory, updateMenuCategory, deleteMenuCategory, reorderMenuCategories
    } = usePos();
    
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
                        <DataManagement />
                    </div>
                )}
            </div>
        </DragDropContext>
    );
};

export default MenuTab;