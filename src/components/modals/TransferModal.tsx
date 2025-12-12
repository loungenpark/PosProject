import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { CloseIcon, SaveIcon } from '../common/Icons';

interface TransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceTableId: number;
    sourceTableName: string;
}

const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose, sourceTableId, sourceTableName }) => {
    const { tables, transferTable } = usePos();
    const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    // Filter for EMPTY tables only
    // Exclude the source table itself (though it has an order so it wouldn't match !t.order, but safe to be sure)
    const availableTables = tables.filter(t => !t.order && t.id !== sourceTableId);

    const handleTransfer = async () => {
        if (!selectedTableId) return;

        try {
            setIsSubmitting(true);
            await transferTable(sourceTableId, selectedTableId);
            onClose();
        } catch (error: any) {
            alert(error.message || 'Transfer failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[70] flex justify-center items-center p-4">
            <div className="bg-secondary rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-accent">
                    <h3 className="text-xl font-bold text-text-main">Transfero: {sourceTableName}</h3>
                    <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-main hover:bg-accent rounded-full transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 overflow-y-auto flex-grow">
                    <p className="text-text-secondary mb-4">Zgjidh tavolinën e re ku dëshironi të transferoni porosinë:</p>

                    {availableTables.length === 0 ? (
                        <div className="text-center py-8 text-text-secondary opacity-60">
                            Nuk ka tavolina të lira.
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            {availableTables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => setSelectedTableId(table.id)}
                                    className={`
                                        h-16 rounded-lg font-bold text-lg flex items-center justify-center transition-all shadow-sm
                                        ${selectedTableId === table.id
                                            ? 'bg-highlight text-white ring-4 ring-blue-900 scale-105'
                                            : 'bg-primary text-text-main hover:bg-accent'
                                        }
                                    `}
                                >
                                    {table.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-accent flex justify-end space-x-3 bg-secondary rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg bg-accent text-text-main hover:bg-gray-600 transition-colors font-semibold"
                    >
                        Anulo
                    </button>
                    <button
                        onClick={handleTransfer}
                        disabled={!selectedTableId || isSubmitting}
                        className="px-5 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-bold flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Duke transferuar...' : (
                            <>
                                <SaveIcon className="w-5 h-5 mr-2" />
                                Transfero
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TransferModal;
