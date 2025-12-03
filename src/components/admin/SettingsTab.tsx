// src/components/admin/SettingsTab.tsx

import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import ToggleSwitch from '../common/ToggleSwitch';

// --- Tax Settings ---
export const TaxSettings: React.FC = () => {
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
export const TableSettings: React.FC = () => {
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
export const PrintingSettings: React.FC = () => {
    const [isPrintStation, setIsPrintStation] = useState(false);
    const [printOrdersEnabled, setPrintOrdersEnabled] = useState(false);
    const [printReceiptsEnabled, setPrintReceiptsEnabled] = useState(false);
    
    useEffect(() => {
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