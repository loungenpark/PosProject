// src/components/admin/SettingsTab.tsx

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // LEFT: Import translation hook
import { usePos } from '../../context/PosContext';
import ToggleSwitch from '../common/ToggleSwitch';
import { TrashIcon, PlusIcon } from '../common/Icons';

// --- Tax Settings ---
export const TaxSettings: React.FC = () => {
    const { t } = useTranslation(); // LEFT: Init translation
    const { taxRate, setTaxRate } = usePos();
    const [tax, setTax] = useState(taxRate * 100);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const newTax = Math.max(0, tax);
            await setTaxRate(newTax);
            alert(t('admin.settings.tax_success', { taxRate: newTax }));
        } catch (error) {
            alert(t('admin.settings.tax_fail'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-secondary p-6 rounded-lg max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold mb-4 text-tsecondary">{t('admin.settings.tax_title')}</h3>
            <div className="space-y-6 bg-primary p-6 rounded-lg">
                <div>
                    <label htmlFor="taxRate" className="block text-sm font-medium text-tsecondary">{t('admin.settings.tax_label')}</label>
                    <input
                        type="number"
                        id="taxRate"
                        value={tax}
                        onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.1"
                        className="mt-1 block w-full bg-secondary border-border rounded-md p-2 text-tmain focus:ring-highlight focus:border-highlight"
                    />
                    <p className="text-xs text-tsecondary mt-1">{t('admin.settings.tax_desc')}</p>
                </div>
                <div className="flex justify-end pt-2">
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 rounded-lg bg-highlight text-white font-bold hover:bg-highlight-hover transition-colors disabled:bg-muted">
                        {isSaving ? t('common.saving') : t('admin.settings.btn_save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Printing Settings Component ---
export const PrintingSettings: React.FC = () => {
    const { t } = useTranslation(); // LEFT: Init translation
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
            <h3 className="text-xl font-semibold mb-2 text-tsecondary">{t('admin.settings.print_title')}</h3>
            <p className="text-tsecondary mb-6">{t('admin.settings.print_subtitle')}</p>
            <div className="bg-primary rounded-lg p-6">
                <ToggleSwitch
                    label={t('admin.settings.station_label')}
                    description={t('admin.settings.station_desc')}
                    enabled={isPrintStation}
                    onChange={handlePrintStationChange}
                />
                <ToggleSwitch
                    label={t('admin.settings.order_label')}
                    description={t('admin.settings.order_desc')}
                    enabled={printOrdersEnabled}
                    onChange={handleOrderPrintingChange}
                />
                <ToggleSwitch
                    label={t('admin.settings.receipt_label')}
                    description={t('admin.settings.receipt_desc')}
                    enabled={printReceiptsEnabled}
                    onChange={handleReceiptPrintingChange}
                />
            </div>
        </div>
    );
};

// --- Operational Day Settings Component ---
export const OperationalDaySettings: React.FC = () => {
    const { t } = useTranslation(); // LEFT: Init translation
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
            alert(t('admin.settings.op_day_success', { hour: newHour }));
        } catch (error) {
            alert(t('admin.settings.op_day_fail'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-secondary p-6 rounded-lg max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold mb-4 text-tsecondary">{t('admin.settings.op_day_title')}</h3>
            <div className="space-y-6 bg-primary p-6 rounded-lg">
                <div>
                    <label htmlFor="startHour" className="block text-sm font-medium text-tsecondary">{t('admin.settings.op_day_label')}</label>
                    <input
                        type="number"
                        id="startHour"
                        value={hour}
                        onChange={(e) => setHour(parseInt(e.target.value, 10) || 0)}
                        min="0"
                        max="23"
                        className="mt-1 block w-full bg-secondary border-border rounded-md p-2 text-tmain focus:ring-highlight focus:border-highlight"
                    />
                    <p className="text-xs text-tsecondary mt-1">
                        {t('admin.settings.op_day_desc')}
                    </p>
                </div>
                <div className="flex justify-end pt-2">
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 rounded-lg bg-highlight text-white font-bold hover:bg-highlight-hover transition-colors disabled:bg-muted">
                        {isSaving ? t('common.saving') : t('admin.settings.btn_save')}
                    </button>
                </div>
            </div>
        </div>
    );
};