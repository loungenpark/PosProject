import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { CloseIcon, ChevronLeftIcon } from '../common/Icons';

interface TransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceTableId: number;
    sourceTableName: string;
}

const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose, sourceTableId, sourceTableName }) => {
    const { tables, sections, transferTable } = usePos();

    // Steps: 1 = Select Items, 2 = Select Target Table
    const [step, setStep] = useState<1 | 2>(1);

    // Selection State
    const [selectedItemUniqueIds, setSelectedItemUniqueIds] = useState<string[]>([]);
    const [activeSectionId, setActiveSectionId] = useState<number | 'all'>('all');

    // Get source table details to list items
    const sourceTable = useMemo(() => tables.find(t => t.id === sourceTableId), [tables, sourceTableId]);
    const sourceItems = useMemo(() => sourceTable?.order?.items || [], [sourceTable]);

    // Reset state when opening
    React.useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSelectedItemUniqueIds([]); // Default to none selected
        }
    }, [isOpen]);

    // Handlers
    const toggleItemSelection = (uniqueId: string) => {
        setSelectedItemUniqueIds(prev =>
            prev.includes(uniqueId)
                ? prev.filter(id => id !== uniqueId)
                : [...prev, uniqueId]
        );
    };

    const toggleSelectAll = () => {
        if (selectedItemUniqueIds.length === sourceItems.length) {
            setSelectedItemUniqueIds([]);
        } else {
            // Use uniqueId if available, fallback to constructing one (though Backend expects uniqueId)
            const allIds = sourceItems.map(item => item.uniqueId || '').filter(id => id);
            setSelectedItemUniqueIds(allIds);
        }
    };

    const handleTransfer = async (targetTableId: number) => {
        try {
            // If nothing selected, assume Full Transfer (User skipped selection or selected all manually)
            // But logic below enforces selection to proceed to Step 2.

            // If user selected ALL items, we can send undefined to trigger "Full Transfer" optimization,
            // or just send all IDs. Let's send IDs to be precise.

            const idsToSend = selectedItemUniqueIds.length === sourceItems.length
                ? undefined // Full transfer optimization
                : selectedItemUniqueIds;

            await transferTable(sourceTableId, targetTableId, idsToSend);
            onClose();
        } catch (error: any) {
            alert(error.message || "Gabim gjatë transferimit");
        }
    };

    // Derived Data for Step 2
    const filteredTargetTables = useMemo(() => {
        let targets = tables.filter(t => t.id !== sourceTableId); // Cannot transfer to self
        if (activeSectionId !== 'all') {
            targets = targets.filter(t => t.sectionId === activeSectionId);
        }
        return targets;
    }, [tables, activeSectionId, sourceTableId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-primary/70 z-50 flex items-center justify-center p-4">
            <div className="bg-secondary rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col border border-border">

                {/* HEADER */}
                <div className="flex justify-between items-center p-4 border-b border-border bg-secondary rounded-t-lg">
                    <div className="flex items-center gap-3">
                        {step === 2 && (
                            <button onClick={() => setStep(1)} className="p-1 rounded-full hover:bg-primary text-tsecondary">
                                <ChevronLeftIcon className="w-6 h-6" />
                            </button>
                        )}
                        <h2 className="text-xl font-bold text-tmain">
                            {step === 1 ? `Zgjidh Artikujt (${sourceTableName})` : 'Zgjidh Tavolinën e Re'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-tsecondary hover:tmain hover:bg-danger rounded-full transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* CONTENT */}
                <div className="flex-grow overflow-hidden flex flex-col p-4">

                    {/* STEP 1: SELECT ITEMS */}
                    {step === 1 && (
                        <div className="flex flex-col h-full">
                            <div className="flex justify-between mb-4">
                                <button
                                    onClick={toggleSelectAll}
                                    className="text-highlight font-bold hover:underline"
                                >
                                    {selectedItemUniqueIds.length === sourceItems.length ? "Hiq të gjitha" : "Zgjidh të gjitha"}
                                </button>
                                <span className="text-tsecondary">
                                    {selectedItemUniqueIds.length} artikuj të zgjedhur
                                </span>
                            </div>

                            <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                                {sourceItems.map((item, idx) => {
                                    // Fallback for ID if uniqueId is missing (should not happen with new logic)
                                    const uid = item.uniqueId || `fallback-${idx}`;
                                    const isSelected = selectedItemUniqueIds.includes(uid);

                                    return (
                                        <div
                                            key={uid}
                                            onClick={() => toggleItemSelection(uid)}
                                            className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all
                                                ${isSelected
                                                    ? 'bg-primary/20 border-primary'
                                                    : 'bg-primary border-border hover:border-muted'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center
    ${isSelected ? 'bg-primary border-primary' : 'border-border'}`}
                                                >
                                                    {isSelected && <span className="text-white text-xs">✓</span>}
                                                </div>
                                                <span className="font-semibold text-tmain">{item.name}</span>
                                            </div>
                                            <span className="font-bold text-tmain">
                                                {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(item.price)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-4 pt-4 border-t border-border flex justify-end">
                                <button
                                    onClick={() => setStep(2)}
                                    disabled={selectedItemUniqueIds.length === 0}
                                    className="px-8 py-3 bg-highlight text-white font-bold rounded-lg hover:bg-highlight-hover disabled:bg-muted disabled:cursor-not-allowed transition-colors shadow-lg"
                                >
                                    Vazhdo
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: SELECT TABLE */}
                    {step === 2 && (
                        <div className="flex flex-col h-full">
                            {/* Section Tabs */}
                            <div className="flex space-x-2 overflow-x-auto pb-2 mb-4">
                                <button
                                    onClick={() => setActiveSectionId('all')}
                                    className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition-colors ${activeSectionId === 'all' ? 'bg-highlight text-white' : 'bg-primary text-tsecondary hover:bg-border'}`}
                                >
                                    Të gjitha
                                </button>
                                {sections.filter(s => !s.isHidden).map(section => (
                                    <button
                                        key={section.id}
                                        onClick={() => setActiveSectionId(section.id)}
                                        className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition-colors ${activeSectionId === section.id ? 'bg-highlight text-white' : 'bg-primary text-tsecondary hover:bg-border'}`}
                                    >
                                        {section.name}
                                    </button>
                                ))}
                            </div>

                            {/* Table Grid */}
                            <div className="flex-grow overflow-y-auto pr-2">
                                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {filteredTargetTables.map(table => (
                                        <button
                                            key={table.id}
                                            onClick={() => handleTransfer(table.id)}
                                            className={`aspect-square flex flex-col justify-center items-center rounded-lg shadow-md transition-transform transform hover:-translate-y-1 p-2
                                                ${table.order ? 'bg-warning-bg border-warning border-2' : 'bg-primary border border-border hover:border-highlight'}`}
                                        >
                                            <span className="text-xl font-bold text-tmain">{table.name}</span>
                                            {table.order ? (
                                                <span className="text-xs text-warning font-bold mt-1">
                                                    (E Hapur)
                                                </span>
                                            ) : (
                                                <span className="text-xs text-success font-bold mt-1">
                                                    E Lirë
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default TransferModal;