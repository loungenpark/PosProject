import React, { useState, useMemo, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { TrashIcon, PlusIcon, TableIcon, BoxIcon, PencilIcon, SaveIcon, CloseIcon } from '../common/Icons';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProps } from 'react-beautiful-dnd';
import * as api from '../../utils/api';

const TableManager: React.FC = () => {
    // I am correcting openTables to activeOrders, which is the correct variable from the context.
    // We only need 'tables' for the check. Removing the incorrect 'activeOrders'.
    const {
        sections, allSectionConfig, addSection, updateSectionName, toggleSectionVisibility, setSectionDefault, deleteSection,
        tables, addTable, updateTable, deleteTable,
        tablesPerRow, setTablesPerRow, tableSizePercent, setTableSizePercent, tableButtonSizePercent, setTableButtonSizePercent
    } = usePos();

    // UI State
    const [activeSectionId, setActiveSectionId] = useState<number | 'all'>('all');
    const [newSectionName, setNewSectionName] = useState('');

    // Reorder State
    const [isReorderMode, setIsReorderMode] = useState(false);
    const [localTables, setLocalTables] = useState<typeof tables>([]);

    // Editing Section State
    const [editingSectionId, setEditingSectionId] = useState<number | 'all' | null>(null);
    const [editingSectionName, setEditingSectionName] = useState('');

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [sectionToDelete, setSectionToDelete] = useState<{ id: number; name: string } | null>(null);
    const [isDeleteAllTablesModalOpen, setIsDeleteAllTablesModalOpen] = useState(false);

    // Generic Info/Error Modal State
    const [infoModal, setInfoModal] = useState({ isOpen: false, message: '' });

    // Batch Creation State
    const [batchPrefix, setBatchPrefix] = useState('T-');
    const [startNum, setStartNum] = useState<string>('');
    const [endNum, setEndNum] = useState<string>('');

    // --- Computed Data ---
    const filteredTables = useMemo(() => {
        // If in Reorder Mode, return the local state (drag-and-drop view)
        if (isReorderMode) {
            return localTables;
        }

        // Otherwise, return tables from Context.
        // We do NOT sort here anymore. We trust the order from PosContext (which comes directly from the DB).
        // This ensures that PosScreen and TableManager always show the same order.
        if (activeSectionId === 'all') {
            return tables;
        }

        return tables.filter(t => t.sectionId === activeSectionId);

    }, [tables, activeSectionId, isReorderMode, localTables]);

    // --- Reorder Logic ---
    const handleToggleReorder = async () => {
        if (!isReorderMode) {
            // Enter Reorder Mode: Initialize local state with current sorted view
            setLocalTables([...filteredTables]);
            setIsReorderMode(true);
        } else {
            // Save Changes
            try {
                // Map current index to display_order
                const updates = localTables.map((t, index) => ({
                    id: t.id,
                    display_order: index
                }));

                await api.reorderTables(updates);
                setIsReorderMode(false);
            } catch (err) {
                console.error("Failed to save order", err);
                alert("Gabim gjatë ruajtjes së renditjes.");
            }
        }
    };

    const handleResetOrder = async () => {
        if (activeSectionId === 'all') return;
        if (!confirm("A jeni i sigurt? Kjo do të kthejë renditjen alfabetike.")) return;

        try {
            await api.resetSectionOrder(activeSectionId);
        } catch (err) {
            alert("Gabim gjatë resetimit.");
        }
    };

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;

        const items = Array.from(localTables);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setLocalTables(items);
    };

    // --- Zone Actions ---

    const handleAddSection = async () => {
        if (!newSectionName.trim()) return;
        await addSection(newSectionName.trim());
        setNewSectionName('');
    };

    const handleStartEditSection = (id: number | 'all', name: string) => {
        setEditingSectionId(id);
        setEditingSectionName(name);
    };

    const handleSaveSection = async () => {
        if (editingSectionId !== null && editingSectionName.trim()) {
            // Now supports saving 'all' locally via context
            await updateSectionName(editingSectionId, editingSectionName.trim());
            setEditingSectionId(null);
        }
    };

    const toggleHide = (e: React.MouseEvent, id: number | 'all') => {
        e.stopPropagation();
        toggleSectionVisibility(id);
    };

    const toggleDefault = (e: React.MouseEvent, id: number | 'all', isCurrentDefault: boolean) => {
        e.stopPropagation();
        if (isCurrentDefault) return;
        setSectionDefault(id);
    };

    const handleDeleteSection = (id: number, name: string) => {
        setSectionToDelete({ id, name });
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!sectionToDelete) return;

        // --- VALIDATION ADDED ---
        // Find all tables within the section being deleted
        const tablesInSection = tables.filter(t => t.sectionId === sectionToDelete.id);
        const activeTables = tablesInSection.filter(t => t.order); // Find tables with active orders

        if (activeTables.length > 0) {
            const tableNames = activeTables.map(t => t.name).join(', ');
            setInfoModal({
                isOpen: true,
                message: `Nuk mund të fshihet zona. Tavolinat e mëposhtme kanë porosi aktive: \n\n${tableNames}`
            });
            // Close the confirmation modal
            setIsDeleteModalOpen(false);
            setSectionToDelete(null);
            return; // Stop the deletion
        }
        // --- END VALIDATION ---

        await deleteSection(sectionToDelete.id);

        if (activeSectionId === sectionToDelete.id) {
            setActiveSectionId('all');
        }

        setIsDeleteModalOpen(false);
        setSectionToDelete(null);
    };

    const handleCancelDelete = () => {
        setIsDeleteModalOpen(false);
        setSectionToDelete(null);
    };

    // --- Table Actions ---

    const handleBatchAdd = async () => {
        const start = parseInt(startNum);
        const end = parseInt(endNum);
        const targetSectionId = typeof activeSectionId === 'number' ? activeSectionId : null;

        if (isNaN(start) || isNaN(end) || start > end) {
            alert("Ju lutemi kontrolloni numrat (Nga -> Deri).");
            return;
        }

        if (activeSectionId === 'all') {
            alert("Ju lutemi zgjidhni një zonë specifike për të shtuar tavolina.");
            return;
        }

        // Loop from Start to End
        for (let i = start; i <= end; i++) {
            // Pad number with zero if less than 10 (e.g., 05)
            const numStr = i < 10 ? `0${i}` : `${i}`;
            const name = `${batchPrefix}${numStr}`;
            await addTable(name, targetSectionId);
        }
    };

    // Open the confirmation modal
    const handleDeleteAllInZone = () => {
        if (activeSectionId === 'all') return;
        if (filteredTables.length === 0) return; // Nothing to delete
        setIsDeleteAllTablesModalOpen(true);
    };

    // Actual execution logic
    const confirmDeleteAllTables = async () => {
        if (activeSectionId === 'all') return;

        // --- VALIDATION ADDED ---
        const activeTables = filteredTables.filter(t => t.order);

        if (activeTables.length > 0) {
            const tableNames = activeTables.map(t => t.name).join(', ');
            setInfoModal({
                isOpen: true,
                message: `Veprimi u ndalua. Tavolinat e mëposhtme kanë porosi aktive: \n\n${tableNames}`
            });
            // Close the confirmation modal
            setIsDeleteAllTablesModalOpen(false);
            return; // Stop the deletion
        }
        // --- END VALIDATION ---

        // Delete one by one (Frontend Loop)
        for (const table of filteredTables) {
            await deleteTable(table.id);
        }
        setIsDeleteAllTablesModalOpen(false);
    };

    const handleRenameTable = async (id: number, currentName: string, newName: string, event: React.FocusEvent<HTMLInputElement>) => {
        const trimmedNewName = newName.trim();
        if (currentName === trimmedNewName || !trimmedNewName) {
            // If name is unchanged or empty, revert to original name
            event.target.value = currentName;
            return;
        }

        const table = tables.find(t => t.id === id);
        if (table) {
            try {
                // The updateTable function is in PosContext and now needs to handle potential errors
                await updateTable(id, trimmedNewName, table.sectionId);
            } catch (error: any) {
                // If the API call fails (e.g., 409 Conflict), show an alert
                alert(error.message || 'Ky emër tavoline është tashmë në përdorim.');
                // Revert the input field back to the original name
                event.target.value = currentName;
            }
        }
    };

    const handleDeleteTable = (tableId: number) => {
        // Find the specific table in the main 'tables' array from the context.
        const tableToCheck = tables.find(table => table.id === tableId);

        // A table is considered active if it exists and its 'order' property is not null.
        if (tableToCheck && tableToCheck.order) {
            // If it's active, show our new custom modal instead of the browser alert.
            setInfoModal({
                isOpen: true,
                message: 'Kjo tavolinë ka një porosi aktive. Ju lutem mbyllni faturën para se ta fshini.'
            });
            return;
        }

        // If the table is not found or has no order, proceed with deletion.
        deleteTable(tableId);
    };

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] gap-4 w-full max-w-7xl mx-auto">

            {/* LEFT COLUMN: ZONES */}
            <div className="w-full md:w-1/4 bg-secondary p-4 rounded-lg flex flex-col shadow-lg border border-border">
                <h3 className="text-lg font-bold text-tmain mb-4 flex items-center gap-2">
                    <BoxIcon className="w-5 h-5 text-highlight" />
                    Zonat
                </h3>

                {/* Add Zone (Top) */}
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        placeholder="Emri i Zonës..."
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        className="flex-grow bg-primary border-border rounded-md p-2 text-tmain text-sm focus:ring-1 focus:ring-highlight"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
                    />
                    <button onClick={handleAddSection} className="p-2 bg-success rounded-md text-white hover:bg-success-hover">
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Zone List */}
                <div className="flex-grow overflow-y-auto space-y-2">
                    {/* "All" Entry with Buttons (No Delete) */}
                    <div className={`group flex items-center gap-2 px-2 py-2 rounded-md transition-colors border ${activeSectionId === 'all' ? 'border-highlight' : 'border-transparent hover:border-highlight'}`}>
                        {editingSectionId === 'all' ? (
                            <div className="flex-grow flex items-center gap-1">
                                <input
                                    autoFocus
                                    type="text"
                                    value={editingSectionName}
                                    onChange={(e) => setEditingSectionName(e.target.value)}
                                    className="w-full bg-primary text-tmain text-sm p-1 rounded border border-highlight"
                                />
                                <button onClick={handleSaveSection} className="text-success hover:text-success-hover"><SaveIcon className="w-5 h-5" /></button>
                                <button onClick={() => setEditingSectionId(null)} className="text-danger hover:text-danger-hover"><CloseIcon className="w-5 h-5" /></button>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => setActiveSectionId('all')}
                                    className={`flex-grow text-left font-bold px-2 py-1 truncate ${activeSectionId === 'all' ? 'text-highlight' : 'text-tmain group-hover:text-highlight'}`}
                                >
                                    {allSectionConfig.customName || 'Të gjitha tavolinat'}
                                </button>

                                {/* Default Button (Working for All) */}
                                <button
                                    onClick={(e) => toggleDefault(e, 'all', allSectionConfig.isDefault)}
                                    className={`p-1 transition-opacity ${allSectionConfig.isDefault ? 'text-warning opacity-100' : 'text-tsecondary opacity-0 group-hover:opacity-100 hover:text-warning'}`}
                                    title={allSectionConfig.isDefault ? "Zona Kryesore" : "Vendos si Kryesore"}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={allSectionConfig.isDefault ? "currentColor" : "none"} stroke="currentColor" className="w-4 h-4" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                    </svg>
                                </button>

                                {/* Hide Button (Working for All) */}
                                <button
                                    onClick={(e) => toggleHide(e, 'all')}
                                    className={`p-1 transition-opacity ${allSectionConfig.isHidden ? 'text-danger opacity-100' : 'text-tsecondary opacity-0 group-hover:opacity-100 hover:text-danger'}`}
                                    title={allSectionConfig.isHidden ? "Shfaq Zonën" : "Fsheh Zonën"}
                                >
                                    {allSectionConfig.isHidden ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    )}
                                </button>

                                {/* Edit Button */}
                                <button onClick={() => handleStartEditSection('all', allSectionConfig.customName || 'Të gjitha tavolinat')} className="p-1 text-tsecondary hover:text-highlight opacity-0 group-hover:opacity-100 transition-opacity">
                                    <PencilIcon className="w-4 h-4" />
                                </button>

                                {/* Invisible Placeholder for alignment */}
                                <span className="p-1 w-6 h-6 flex-shrink-0"></span>
                            </>
                        )}
                    </div>

                    <div className="h-px bg-border my-2"></div>

                    {/* Dynamic Sections */}
                    {sections.map(section => (
                        <div key={section.id} className={`group flex items-center gap-2 px-2 py-2 rounded-md transition-colors border ${activeSectionId === section.id ? 'border-highlight' : 'border-transparent hover:border-highlight'}`}>
                            {editingSectionId === section.id ? (
                                <div className="flex-grow flex items-center gap-1">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={editingSectionName}
                                        onChange={(e) => setEditingSectionName(e.target.value)}
                                        className="w-full bg-primary text-tmain text-sm p-1 rounded border border-highlight"
                                    />
                                    <button onClick={handleSaveSection} className="text-success hover:text-success-hover"><SaveIcon className="w-5 h-5" /></button>
                                    <button onClick={() => setEditingSectionId(null)} className="text-danger hover:text-danger-hover"><CloseIcon className="w-5 h-5" /></button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setActiveSectionId(section.id)}
                                        className={`flex-grow text-left font-medium truncate ${activeSectionId === section.id ? 'text-highlight' : 'text-tmain group-hover:text-highlight'}`}
                                    >
                                        {section.name}
                                    </button>

                                    {/* Default Button (Star) */}
                                    <button
                                        onClick={(e) => toggleDefault(e, section.id, section.isDefault)}
                                        className={`p-1 transition-opacity ${section.isDefault ? 'text-warning opacity-100' : 'text-tsecondary opacity-0 group-hover:opacity-100 hover:text-warning'}`}
                                        title={section.isDefault ? "Zona Kryesore" : "Vendos si Kryesore"}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={section.isDefault ? "currentColor" : "none"} stroke="currentColor" className="w-4 h-4" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                        </svg>
                                    </button>

                                    {/* Hide Button (Eye) */}
                                    <button
                                        onClick={(e) => toggleHide(e, section.id)}
                                        className={`p-1 transition-opacity ${section.isHidden ? 'text-danger opacity-100' : 'text-tsecondary opacity-0 group-hover:opacity-100 hover:text-danger'}`}
                                        title={section.isHidden ? "Shfaq Zonën" : "Fsheh Zonën"}
                                    >
                                        {section.isHidden ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        )}
                                    </button>

                                    {/* Edit Button */}
                                    <button onClick={() => handleStartEditSection(section.id, section.name)} className="p-1 text-tsecondary hover:text-highlight opacity-0 group-hover:opacity-100 transition-opacity">
                                        <PencilIcon className="w-4 h-4" />
                                    </button>

                                    {/* Delete Button */}
                                    <button onClick={() => handleDeleteSection(section.id, section.name)} className="p-1 text-tsecondary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT COLUMN: TABLES GRID */}
            <div className="w-full md:w-3/4 bg-secondary p-4 md:p-6 rounded-lg flex flex-col shadow-lg border border-border flex-1 min-h-0 overflow-hidden">

                {/* --- VISUAL SETTINGS TOOLBAR (NEW) --- */}
                <div className="bg-primary p-2 md:p-3 rounded-lg border border-border mb-6 flex flex-wrap md:flex-row gap-2 md:gap-4 items-center shadow-inner overflow-x-auto flex-shrink-0">
                    <div className="flex items-center gap-1 md:gap-2">
                        <span className="text-xs md:text-sm font-bold text-tsecondary whitespace-nowrap">
                            <span className="hidden md:inline">Tavolina në rresht:</span>
                            <span className="md:hidden">TR:</span>
                        </span>
                        <input
                            type="number"
                            min="2" max="10"
                            value={tablesPerRow}
                            onChange={(e) => setTablesPerRow(Number(e.target.value))}
                            className="w-10 md:w-16 bg-secondary border border-border rounded p-1 text-center font-bold text-tmain focus:ring-1 focus:ring-highlight text-xs md:text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>
                    <div className="h-4 md:h-6 w-px bg-border hidden md:block"></div>
                    <div className="flex items-center gap-1 md:gap-2">
                        <span className="text-xs md:text-sm font-bold text-tsecondary whitespace-nowrap">
                            <span className="hidden md:inline">Madhësia (Buton):</span>
                            <span className="md:hidden">MB:</span>
                        </span>
                        <input
                            type="number"
                            min="50" max="150"
                            value={tableButtonSizePercent}
                            onChange={(e) => setTableButtonSizePercent(Number(e.target.value))}
                            className="w-10 md:w-16 bg-secondary border border-border rounded p-1 text-center font-bold text-tmain focus:ring-1 focus:ring-highlight text-xs md:text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-[10px] md:text-xs text-tsecondary">%</span>
                    </div>
                    <div className="h-4 md:h-6 w-px bg-border hidden md:block"></div>
                    <div className="flex items-center gap-1 md:gap-2">
                        <span className="text-xs md:text-sm font-bold text-tsecondary whitespace-nowrap">
                            <span className="hidden md:inline">Madhësia (Text):</span>
                            <span className="md:hidden">MT:</span>
                        </span>
                        <input
                            type="number"
                            min="50" max="200"
                            value={tableSizePercent}
                            onChange={(e) => setTableSizePercent(Number(e.target.value))}
                            className="w-10 md:w-16 bg-secondary border border-border rounded p-1 text-center font-bold text-tmain focus:ring-1 focus:ring-highlight text-xs md:text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-[10px] md:text-xs text-tsecondary">%</span>
                    </div>

                    <div className="flex-grow"></div>

                    {/* Reset Button */}
                    <button
                        onClick={() => {
                            setTablesPerRow(5);
                            setTableButtonSizePercent(100);
                            setTableSizePercent(100);
                        }}
                        className="flex items-center justify-center gap-1 text-xs font-bold text-tsecondary hover:text-highlight transition-colors bg-secondary px-2 md:px-3 py-1 md:py-1.5 rounded border border-border h-7 md:h-auto w-7 md:w-auto"
                        title="Reseto në vlerat fillestare"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        <span className="hidden md:inline">Reseto</span>
                    </button>
                </div>

                {/* Header / Tools */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 border-b border-border pb-4 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <h3 className="text-xl font-bold text-tmain flex items-center gap-2">
                            <TableIcon className="w-6 h-6 text-highlight" />
                            {activeSectionId === 'all'
                                ? (allSectionConfig.customName || 'Të gjitha tavolinat')
                                : sections.find(s => s.id === activeSectionId)?.name || 'Zona'}
                        </h3>

                        {/* Reorder Controls */}
                        {activeSectionId !== 'all' && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleToggleReorder}
                                    className={`px-3 py-1 rounded text-sm font-bold border transition-colors ${isReorderMode
                                        ? 'bg-success border-success text-white hover:bg-success-hover'
                                        : 'bg-primary border-border text-tsecondary hover:text-tmain'
                                        }`}
                                >
                                    {isReorderMode ? 'Ruaj' : 'Rendit'}
                                </button>

                                {isReorderMode && (
                                    <button
                                        onClick={handleResetOrder}
                                        className="px-3 py-1 rounded text-sm font-bold bg-primary border border-danger/30 text-danger hover:text-danger-hover transition-colors"
                                    >
                                        Reseto
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Batch Creator & Actions */}
                    {activeSectionId !== 'all' && (
                        <div className="flex items-center gap-1 md:gap-2 bg-primary p-1.5 md:p-2 rounded-lg border border-border w-full md:w-auto">
                            <span className="text-sm text-tsecondary font-bold px-2 hidden md:inline">Shto:</span>

                            {/* Prefix */}
                            <input
                                type="text"
                                value={batchPrefix}
                                onChange={(e) => setBatchPrefix(e.target.value)}
                                className="w-10 md:w-16 bg-secondary border-border rounded p-1 md:p-2 text-center text-tmain text-xs md:text-sm font-bold"
                                placeholder="Pre"
                            />

                            {/* From */}
                            <input
                                type="number"
                                value={startNum}
                                onChange={(e) => setStartNum(e.target.value)}
                                className="w-12 md:w-20 bg-secondary border-border rounded p-1 md:p-2 text-center text-tmain text-xs md:text-sm font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="Nga"
                            />
                            <span className="text-tsecondary text-xs md:text-base">-</span>
                            {/* To */}
                            <input
                                type="number"
                                value={endNum}
                                onChange={(e) => setEndNum(e.target.value)}
                                className="w-12 md:w-20 bg-secondary border-border rounded p-1 md:p-2 text-center text-tmain text-xs md:text-sm font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="Deri"
                            />

                            {/* Add Button */}
                            <button
                                onClick={handleBatchAdd}
                                className="bg-success hover:bg-success-hover text-white w-8 h-8 md:w-auto md:h-auto md:px-4 md:py-2 rounded text-sm font-bold transition-colors ml-1 md:ml-2 flex items-center justify-center"
                                title="Shto Tavolina"
                            >
                                <span className="md:hidden text-lg">+</span>
                                <span className="hidden md:inline">+ Shto</span>
                            </button>

                            <div className="w-px h-6 bg-border mx-1 md:mx-2"></div>

                            {/* Delete All Button */}
                            <button
                                onClick={handleDeleteAllInZone}
                                className="bg-danger-bg text-danger hover:bg-danger hover:text-white border border-danger/50 w-8 h-8 md:w-auto md:h-auto md:px-4 md:py-2 rounded text-sm font-bold transition-colors flex items-center justify-center"
                                title="Fshij Të Gjitha"
                            >
                                <span className="hidden md:inline">Fshij Të Gjitha</span>
                                <span className="md:hidden">
                                    <TrashIcon className="w-4 h-4" />
                                </span>
                            </button>
                        </div>
                    )}
                </div>

                {/* THE GRID */}
                <div className="flex-grow overflow-y-auto pr-2">
                    <DragDropContext onDragEnd={onDragEnd}>
                        <StrictModeDroppable droppableId="tables-grid" direction="horizontal">
                            {(provided) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className="grid gap-4"
                                    style={{ gridTemplateColumns: `repeat(${tablesPerRow}, minmax(0, 1fr))` }}
                                >
                                    {filteredTables.map((table, index) => (
                                        <Draggable
                                            key={table.id}
                                            draggableId={String(table.id)}
                                            index={index}
                                            isDragDisabled={!isReorderMode}
                                        >
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className="aspect-square flex justify-center items-center"
                                                    style={{
                                                        ...provided.draggableProps.style, // Required for DND
                                                    }}
                                                >
                                                    <div
                                                        className={`bg-primary rounded-lg shadow-sm flex flex-col relative group border transition-all overflow-hidden
                                                            ${isReorderMode ? 'cursor-grab active:cursor-grabbing border-highlight border-dashed' : 'border-transparent hover:border-highlight'}
                                                            ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-highlight z-50' : ''}
                                                        `}
                                                        style={{ width: `${tableButtonSizePercent}%`, height: `${tableButtonSizePercent}%` }}
                                                    >
                                                        {/* Delete Button (Hidden in Reorder Mode) */}
                                                        {!isReorderMode && (
                                                            <button
                                                                onClick={() => handleDeleteTable(table.id)}
                                                                className="absolute -top-2 -right-2 p-1.5 bg-secondary rounded-full shadow text-tsecondary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity z-20 border border-border"
                                                                title="Fshij Tavolinën"
                                                            >
                                                                <TrashIcon className="w-3 h-3" />
                                                            </button>
                                                        )}

                                                        {/* Reorder Overlay (Visible only in Reorder Mode) */}
                                                        {isReorderMode && (
                                                            <div className="absolute inset-0 flex items-center justify-center z-10 bg-primary/20">
                                                                {/* Move Icon */}
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-white drop-shadow-md opacity-80">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                                                                </svg>
                                                            </div>
                                                        )}

                                                        {/* Table Name Input */}
                                                        <div className="flex-grow flex items-center justify-center overflow-hidden w-full relative">
                                                            <input
                                                                type="text"
                                                                defaultValue={table.name}
                                                                // Use pointer-events-none to let drag pass through to the container
                                                                className={`bg-transparent text-center font-bold text-tmain w-full focus:bg-secondary focus:outline-none rounded py-1 px-1 
                                                                    ${isReorderMode ? 'pointer-events-none opacity-50' : ''}`}
                                                                style={{ fontSize: `calc(1.5rem * ${tableSizePercent / 100})` }}
                                                                onBlur={(e) => handleRenameTable(table.id, table.name, e.target.value, e)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') e.currentTarget.blur();
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </StrictModeDroppable>
                    </DragDropContext>

                    {filteredTables.length === 0 && (
                        <div className="text-center py-20 text-tsecondary opacity-60">
                            <TableIcon className="w-16 h-16 mx-auto mb-4" />
                            <p className="text-lg">Asnjë tavolinë në {activeSectionId === 'all' ? 'total' : 'këtë zonë'}.</p>
                            {activeSectionId !== 'all' && <p className="text-sm">Përdorni panelin lart për të shtuar tavolina (psh. 101 deri 110).</p>}
                        </div>
                    )}
                </div>
            </div>

            {/* DELETE CONFIRMATION MODAL */}
            {isDeleteModalOpen && sectionToDelete && (
                <div className="fixed inset-0 bg-primary/70 flex items-center justify-center z-50">
                    <div className="bg-secondary p-8 rounded-lg shadow-2xl max-w-md w-full border border-border">
                        <h3 className="text-xl font-bold text-tmain mb-4">Konfirmo Fshirjen</h3>
                        <p className="text-tsecondary mb-6">
                            Jeni të sigurt që doni të fshini zonën <strong className="text-highlight">{sectionToDelete.name}</strong>?
                            <br />
                            <span className="text-danger mt-2 block">Të gjitha tavolinat brenda saj do të çaktivizohen.</span>
                        </p>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={handleCancelDelete}
                                className="px-6 py-2 rounded-md bg-primary text-tmain font-semibold hover:bg-border transition-colors"
                            >
                                Anulo
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                className="px-6 py-2 rounded-md bg-danger text-white font-semibold hover:bg-danger-hover transition-colors"
                            >
                                Fshij Zonën
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE ALL TABLES CONFIRMATION MODAL */}
            {isDeleteAllTablesModalOpen && activeSectionId !== 'all' && (
                <div className="fixed inset-0 bg-primary/70 flex items-center justify-center z-50">
                    <div className="bg-secondary p-8 rounded-lg shadow-2xl max-w-md w-full border border-border">
                        <h3 className="text-xl font-bold text-tmain mb-4">Konfirmo Fshirjen Masive</h3>
                        <p className="text-tsecondary mb-6">
                            Jeni të sigurt që doni të fshini <strong className="text-highlight">{filteredTables.length} tavolina</strong> në zonën <strong className="text-white">{sections.find(s => s.id === activeSectionId)?.name}</strong>?
                            <br />
                            <span className="text-danger mt-2 block">Ky veprim nuk mund të kthehet pas.</span>
                        </p>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => setIsDeleteAllTablesModalOpen(false)}
                                className="px-6 py-2 rounded-md bg-primary text-tmain font-semibold hover:bg-border transition-colors"
                            >
                                Anulo
                            </button>
                            <button
                                onClick={confirmDeleteAllTables}
                                className="px-6 py-2 rounded-md bg-danger text-white font-semibold hover:bg-danger-hover transition-colors"
                            >
                                Fshij Të Gjitha
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GENERIC INFO/ERROR MODAL */}
            {infoModal.isOpen && (
                <div className="fixed inset-0 bg-primary/70 flex items-center justify-center z-50">
                    <div className="bg-secondary p-8 rounded-lg shadow-2xl max-w-md w-full border border-border">
                        <h3 className="text-xl font-bold text-danger mb-4">Veprimi u Ndalua</h3>
                        <p className="text-tsecondary mb-6 whitespace-pre-line">
                            {infoModal.message}
                        </p>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => setInfoModal({ isOpen: false, message: '' })}
                                className="px-8 py-2 rounded-md bg-highlight text-white font-semibold hover:bg-opacity-80 transition-colors"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Utility Component for React 18 Strict Mode Support ---
export const StrictModeDroppable = ({ children, ...props }: DroppableProps) => {
    const [enabled, setEnabled] = useState(false);
    useEffect(() => {
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

export default TableManager;