// src/components/admin/SettingsTab.tsx

import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import ToggleSwitch from '../common/ToggleSwitch';
import { TrashIcon, PlusIcon } from '../common/Icons';

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

// --- Operational Day Settings Component ---
export const OperationalDaySettings: React.FC = () => {
    const { operationalDayStartHour, updateOperationalDayStartHour } = usePos();
    const [hour, setHour] = useState(operationalDayStartHour);
    const [isSaving, setIsSaving] = useState(false);
   
    // Sync local state if the global context value changes
    useEffect(() => {
        setHour(operationalDayStartHour);
    }, [operationalDayStartHour]);
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const newHour = Math.max(0, Math.min(23, hour));
            await updateOperationalDayStartHour(newHour);
            alert(`Ora e fillimit të ditës operacionale u ruajt: ${newHour}:00.`);
        } catch (error) {
            alert("Ruajtja dështoi. Ju lutemi provoni përsëri.");
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="bg-secondary p-6 rounded-lg max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold mb-4 text-text-main">Dita Operacionale</h3>
            <div className="space-y-6 bg-primary p-6 rounded-lg">
                <div>
                    <label htmlFor="startHour" className="block text-sm font-medium text-text-secondary">Ora e Fillimit të Ditës</label>
                    <input
                        type="number"
                        id="startHour"
                        value={hour}
                        onChange={(e) => setHour(parseInt(e.target.value, 10) || 0)}
                        min="0"
                        max="23"
                        className="mt-1 block w-full bg-secondary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight"
                    />
                    <p className="text-xs text-text-secondary mt-1">
                        Cakto orën (0-23) kur fillon dita e punës. P.sh., vlera '5' do të thotë që dita zgjat nga ora 5:00 e mëngjesit deri në 4:59 të ditës tjetër.
                    </p>
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