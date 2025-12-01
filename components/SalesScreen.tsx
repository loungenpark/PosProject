import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePos } from '../context/PosContext';
import * as api from '../utils/api';
import { Printer, Sale } from '../types';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { 
    ChartBarIcon, 
    RestaurantIcon, 
    CloseIcon, 
    ReceiptIcon, 
    ListIcon,
    RefreshIcon,
    CalendarIcon,
    DownloadIcon 
} from './common/Icons';

const formatCurrency = (amount: number | string) => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount)) return '0,00 €';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(numericAmount);
};

type SalesTab = 'incomes' | 'transactions' | 'items';

const SalesScreen: React.FC = () => {
    const { loggedInUser, setActiveScreen, sales, users, refreshSalesFromServer, companyInfo, taxRate } = usePos();
    const [activeTab, setActiveTab] = useState<SalesTab>('incomes');
    const [orderTickets, setOrderTickets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [exportModalData, setExportModalData] = useState<any | null>(null);


    const handleExportToExcel = async () => {
        if (!exportModalData) return;
        const tx = exportModalData;
        const dateObj = tx.date instanceof Date ? tx.date : new Date(tx.date);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Fatura');

        // 1. Define Columns
        worksheet.columns = [
            { header: '', key: 'name', width: 35 },
            { header: '', key: 'qty', width: 10 },
            { header: '', key: 'price', width: 15 },
            { header: '', key: 'total', width: 15 },
        ];

        // 2. Data Preparation
        const dateStr = dateObj.getDate().toString().padStart(2, '0') + '.' + 
                       (dateObj.getMonth() + 1).toString().padStart(2, '0') + '.' + 
                       dateObj.getFullYear();
        
        // Invoice ID: YY + Last 4 digits of ID (e.g. 256805)
        const year = dateObj.getFullYear().toString().slice(-2);
        const numericId = tx.id.replace(/\D/g, ''); 
        // We take the last 4 digits to keep it short but unique
        const shortId = numericId.slice(-4);
        const invoiceNo = `${year}${shortId}`;

        // 3. Header Row 1: Company Name (Left) | Date (Right)
        const row1 = worksheet.addRow([
            companyInfo.name || 'Restorant POS', 
            '', 
            '', 
            `Data: ${dateStr}`
        ]);
        row1.getCell(1).font = { bold: true, size: 12 }; // Company Name
        row1.getCell(4).alignment = { horizontal: 'right' }; // Date

        // 4. Header Row 2: NUI/Tel (Left) | Fatura No (Right)
        const row2 = worksheet.addRow([
            `NUI: ${companyInfo.nui || '-'} | Tel: ${companyInfo.phone || '-'}`,
            '',
            '',
            `Fatura: ${invoiceNo}`
        ]);
        row2.getCell(1).font = { size: 10 };
        row2.getCell(4).font = { bold: true };
        row2.getCell(4).alignment = { horizontal: 'right' };

        // 5. Header Row 3: Address (Left)
        const row3 = worksheet.addRow([
            `Adresa: ${companyInfo.address || '-'}`,
            '', '', ''
        ]);
        row3.getCell(1).font = { size: 10 };

        worksheet.addRow([]); // Spacer

        // 6. Buyer Section (Blerësi)
        const buyerLabel = worksheet.addRow(['Blerësi:']);
        buyerLabel.font = { bold: true, underline: true };
        
        worksheet.addRow(['Emri i Biznesit']); // Placeholder
        worksheet.addRow(['NUI: 1111']); // Placeholder
        worksheet.addRow(['Adresa: aaaa']); // Placeholder

        worksheet.addRow([]); // Spacer

        // 7. Table Header
        const headerRow = worksheet.addRow(['Artikulli', 'Sasia', 'Çmimi (€)', 'Totali (€)']);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4B5563' }, // Gray-600
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // 8. Items Data
        tx.items.forEach((item: any) => {
            const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
            const quantity = item.quantity;
            const total = price * quantity;

            const row = worksheet.addRow([
                item.name,
                quantity,
                price.toFixed(2),
                total.toFixed(2)
            ]);

            // Add borders to data cells
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            // Align numbers
            row.getCell(2).alignment = { horizontal: 'center' };
            row.getCell(3).alignment = { horizontal: 'right' };
            row.getCell(4).alignment = { horizontal: 'right' };
        });

        // 9. Totals Section
        worksheet.addRow([]); // Spacer

        const subtotal = tx.subtotal !== undefined ? tx.subtotal : tx.total;
        const tax = tx.tax !== undefined ? tx.tax : 0;
        const totalVal = tx.total;

        const addTotalRow = (label: string, value: string, bold = false) => {
            const row = worksheet.addRow(['', '', label, value]);
            row.getCell(3).font = { bold: true };
            row.getCell(3).alignment = { horizontal: 'right' };
            row.getCell(4).alignment = { horizontal: 'right' };
            if (bold) {
                row.getCell(4).font = { bold: true };
                row.getCell(4).border = { bottom: { style: 'double' } };
            }
        };

        addTotalRow('Nëntotali:', subtotal.toFixed(2));
        addTotalRow(`TVSH (${(taxRate * 100).toFixed(0)}%):`, tax.toFixed(2));
        addTotalRow('TOTALI:', totalVal.toFixed(2), true);

        // 10. Signature Section
        worksheet.addRow([]);
        worksheet.addRow([]);
        worksheet.addRow([]);
        worksheet.addRow([]); // 4 empty rows for spacing

        const signatureRow = worksheet.addRow(['', 'Nënshkrimi dhe Vula', '', '']);
        const sigRowNumber = signatureRow.number;

        // Merge B, C, D for wide signature area
        worksheet.mergeCells(`B${sigRowNumber}:D${sigRowNumber}`);
        
        const sigCell = worksheet.getCell(`B${sigRowNumber}`);
        sigCell.font = { bold: true };
        sigCell.alignment = { horizontal: 'center' };
        sigCell.border = {
            top: { style: 'thin' }
        };

        // 11. Generate and Save
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Fatura_${invoiceNo}.xlsx`);

        setExportModalData(null);
    };



    // --- FILTERS ---
    const todayStr = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [selectedUserId, setSelectedUserId] = useState('');

    // --- DATA FETCHING (with manual refresh) ---
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            await refreshSalesFromServer();
            const tickets = await api.getOrderTickets();
            const formattedTickets = tickets.map((t: any) => ({ ...t, date: new Date(t.date) }));
            setOrderTickets(formattedTickets);
        } catch (error) {
            console.error("Failed to load sales data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [refreshSalesFromServer]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // --- HELPER: Filter Logic ---
    const filterByDateAndUser = (date: Date, userId: number) => {
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (date < start) return false;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (date > end) return false;
        }
        if (selectedUserId && userId !== parseInt(selectedUserId, 10)) {
            return false;
        }
        return true;
    };

    // --- 1. TAB: INCOMES (Logic) ---
    const salesSummary = useMemo(() => {
        let totalShankRevenue = 0;
        let totalKuzhinaRevenue = 0;
        const filteredSales = sales.filter(sale => filterByDateAndUser(new Date(sale.date), sale.user.id));
        filteredSales.forEach(sale => {
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
                const shankRatio = subtotalShank / sale.order.subtotal;
                const kuzhinaRatio = subtotalKuzhina / sale.order.subtotal;
                totalShankRevenue += sale.order.total * shankRatio;
                totalKuzhinaRevenue += sale.order.total * kuzhinaRatio;
            }
        });

        return { 
            totalShankRevenue, 
            totalKuzhinaRevenue, 
            totalRevenue: totalShankRevenue + totalKuzhinaRevenue,
            count: filteredSales.length
        };
    }, [sales, startDate, endDate, selectedUserId]);

    const dailySalesStats = useMemo(() => {
        const filteredSales = sales.filter(sale => filterByDateAndUser(new Date(sale.date), sale.user.id));
        const statsMap = new Map<string, { dateStr: string, bar: number, kitchen: number, total: number }>();

        filteredSales.forEach(sale => {
            const dateObj = new Date(sale.date);
            const dateKey = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
            
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

            let saleShank = 0;
            let saleKuzhina = 0;

            if (sale.order.subtotal > 0) {
                const shankRatio = subtotalShank / sale.order.subtotal;
                const kuzhinaRatio = subtotalKuzhina / sale.order.subtotal;
                saleShank = sale.order.total * shankRatio;
                saleKuzhina = sale.order.total * kuzhinaRatio;
            }

            const current = statsMap.get(dateKey) || { dateStr: dateKey, bar: 0, kitchen: 0, total: 0 };
            statsMap.set(dateKey, {
                dateStr: dateKey,
                bar: current.bar + saleShank,
                kitchen: current.kitchen + saleKuzhina,
                total: current.total + sale.order.total
            });
        });

        // Sort descending by date (newest first)
        return Array.from(statsMap.values()).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
    }, [sales, startDate, endDate, selectedUserId]);

    // --- 2. TAB: TRANSACTIONS (Logic) ---

    const filteredTransactions = useMemo(() => {
        const ticketEvents = orderTickets.map(t => ({ 
            id: `ticket-${t.id}`, 
            type: 'ORDER', 
            tableName: t.tableName, 
            user: t.user, 
            date: t.date, 
            items: t.items, 
            total: parseFloat(t.total),
            subtotal: parseFloat(t.total), // Estimate for tickets
            tax: 0
        }));
        const saleEvents = sales.map(s => ({ 
            id: `sale-${s.id}`, 
            type: 'RECEIPT', 
            tableName: s.tableName, 
            user: s.user, 
            date: new Date(s.date), 
            items: s.order.items, 
            total: s.order.total,
            subtotal: s.order.subtotal,
            tax: s.order.tax
        }));
        const combined = [...ticketEvents, ...saleEvents];
        return combined
            .filter(tx => filterByDateAndUser(tx.date, tx.user?.id))
            .sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [sales, orderTickets, startDate, endDate, selectedUserId]);



    // --- 3. TAB: ITEMS (Logic) ---
    const aggregatedItems = useMemo(() => {
        const relevantSales = sales.filter(sale => filterByDateAndUser(new Date(sale.date), sale.user.id));
        const map = new Map<string, { id: number, name: string, quantity: number, total: number }>();
        relevantSales.forEach(sale => {
            sale.order.items.forEach(item => {
                const key = item.id.toString(); 
                const existing = map.get(key);
                const itemTotal = item.price * item.quantity;
                if (existing) {
                    existing.quantity += item.quantity;
                    existing.total += itemTotal;
                } else {
                    map.set(key, { id: item.id, name: item.name, quantity: item.quantity, total: itemTotal });
                }
            });
        });
        return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
    }, [sales, startDate, endDate, selectedUserId]);

    // --- RENDER HELPERS ---
    const FilterBar = () => (
        <div className="bg-secondary p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4 shadow-sm">
            <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-highlight" />
                <span className="font-semibold text-text-main">Periudha:</span>
            </div>
            <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-primary border border-accent rounded-md p-2 text-sm text-text-main focus:ring-highlight focus:border-highlight" />
                <span className="text-text-secondary">-</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-primary border border-accent rounded-md p-2 text-sm text-text-main focus:ring-highlight focus:border-highlight" />
            </div>
            <div className="w-px h-8 bg-accent mx-2 hidden md:block"></div>
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="bg-primary border border-accent rounded-md p-2 text-sm text-text-main focus:ring-highlight focus:border-highlight">
                <option value="">Të gjithë Përdoruesit</option>
                {users.map(user => (
                    <option key={user.id} value={user.id.toString()}>{user.username}</option>
                ))}
            </select>

            <div className="ml-auto flex items-center gap-2">
                <button 
                    onClick={() => { setStartDate(todayStr); setEndDate(todayStr); setSelectedUserId(''); }}
                    className="px-4 py-2 rounded-md bg-accent text-text-main hover:bg-gray-600 text-sm"
                >
                    Pastro
                </button>
                 <button 
                    onClick={loadData}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-md bg-highlight text-white hover:bg-blue-600 text-sm flex items-center gap-2 disabled:bg-gray-500"
                >
                    <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>{isLoading ? '...' : 'Rifresko'}</span>
                </button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-primary z-50 flex flex-col">
            <header className="flex-shrink-0 bg-secondary flex items-center justify-between p-4 shadow-md z-10">
                <h1 className="text-xl font-bold text-text-main flex items-center gap-2">
                    <ChartBarIcon className="w-6 h-6 text-highlight" />
                    Raporte & Statistika
                </h1>
                <div className="flex items-center space-x-4">
                    <button onClick={() => setActiveScreen('pos')} className="px-4 py-2 bg-accent text-text-main font-semibold rounded-lg hover:bg-highlight transition-colors flex items-center space-x-2">
                        <RestaurantIcon className="w-5 h-5" />
                        <span>POS</span>
                    </button>
                    <button onClick={() => setActiveScreen('admin')} className="px-4 py-2 bg-accent text-text-main font-semibold rounded-lg hover:bg-highlight transition-colors">
                        Menaxhimi
                    </button>
                    <div className="w-px h-6 bg-accent mx-2"></div>
                    <span className="text-text-secondary">{loggedInUser?.username}</span>
                    <button onClick={() => setActiveScreen('pos')} className="p-2 rounded-full text-text-secondary hover:bg-accent hover:text-white transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>
            </header>

            <div className="bg-secondary px-4 border-b border-accent flex gap-4">
                <button onClick={() => setActiveTab('incomes')} className={`py-4 px-2 border-b-4 font-semibold flex items-center gap-2 transition-colors ${activeTab === 'incomes' ? 'border-highlight text-highlight' : 'border-transparent text-text-secondary hover:text-text-main'}`}>
                    <ChartBarIcon className="w-5 h-5" />
                    Të Ardhurat
                </button>
                <button onClick={() => setActiveTab('transactions')} className={`py-4 px-2 border-b-4 font-semibold flex items-center gap-2 transition-colors ${activeTab === 'transactions' ? 'border-highlight text-highlight' : 'border-transparent text-text-secondary hover:text-text-main'}`}>
                    <ReceiptIcon className="w-5 h-5" />
                    Transaksionet
                </button>
                <button onClick={() => setActiveTab('items')} className={`py-4 px-2 border-b-4 font-semibold flex items-center gap-2 transition-colors ${activeTab === 'items' ? 'border-highlight text-highlight' : 'border-transparent text-text-secondary hover:text-text-main'}`}>
                    <ListIcon className="w-5 h-5" />
                    Artikujt
                </button>
            </div>

            <main className="flex-grow p-6 overflow-y-auto bg-primary">
                <FilterBar />
                {isLoading && (
                    <div className="text-center py-8 text-text-secondary animate-pulse">
                        Duke ngarkuar të dhënat...
                    </div>
                )}

                {!isLoading && activeTab === 'incomes' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                        <div className="bg-secondary p-6 rounded-lg shadow-lg border border-accent/50 relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><RestaurantIcon className="w-24 h-24 text-highlight" /></div>
                            <h3 className="text-text-secondary text-sm font-bold uppercase tracking-wider mb-2">Shank</h3>
                            <p className="text-4xl font-bold text-highlight">{formatCurrency(salesSummary.totalShankRevenue)}</p>
                        </div>
                        <div className="bg-secondary p-6 rounded-lg shadow-lg border border-accent/50 relative overflow-hidden group">
                             <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><RestaurantIcon className="w-24 h-24 text-green-500" /></div>
                            <h3 className="text-text-secondary text-sm font-bold uppercase tracking-wider mb-2">Kuzhina</h3>
                            <p className="text-4xl font-bold text-highlight">{formatCurrency(salesSummary.totalKuzhinaRevenue)}</p>
                        </div>
                        <div className="bg-secondary p-6 rounded-lg shadow-lg border-l-4 border-highlight relative overflow-hidden">
                            <h3 className="text-text-secondary text-sm font-bold uppercase tracking-wider mb-2">Totali i Përgjithshëm</h3>

                            <p className="text-4xl font-bold text-white">{formatCurrency(salesSummary.totalRevenue)}</p>
                            <p className="text-sm text-text-secondary mt-2">{salesSummary.count} fatura të mbyllura</p>
                        </div>

                        {/* Daily Breakdown Table - Only if date range > 1 day */}
                        {(startDate !== endDate) && dailySalesStats.length > 0 && (
                            <div className="col-span-1 md:col-span-3 mt-4 bg-secondary rounded-lg shadow-lg overflow-hidden animate-fade-in border border-accent/50">
                                <div className="p-4 border-b border-accent bg-secondary/50">
                                    <h3 className="font-bold text-text-main">Detajet Ditore</h3>
                                </div>
                                <table className="w-full text-left">
                                    <thead className="bg-accent text-text-secondary text-xs uppercase font-semibold">
                                        <tr>
                                            <th className="p-4">Data</th>
                                            <th className="p-4 text-right">Shank</th>
                                            <th className="p-4 text-right">Kuzhina</th>
                                            <th className="p-4 text-right">Totali</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-accent text-text-main">
                                        {dailySalesStats.map((stat) => (
                                            <tr key={stat.dateStr} className="hover:bg-primary/30 transition-colors">
                                                <td className="p-4 font-medium">{new Date(stat.dateStr).toLocaleDateString('de-DE')}</td>
                                                <td className="p-4 text-right">{formatCurrency(stat.bar)}</td>
                                                <td className="p-4 text-right">{formatCurrency(stat.kitchen)}</td>
                                                <td className="p-4 text-right font-bold text-highlight">{formatCurrency(stat.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {!isLoading && activeTab === 'transactions' && (
                    <div className="bg-secondary rounded-lg shadow-lg overflow-hidden animate-fade-in">
                        <div className="p-4 border-b border-accent bg-secondary/50"><h3 className="font-bold text-text-main">Historiku i Veprimeve</h3></div>
                        <div className="overflow-x-auto">
                           {filteredTransactions.length > 0 ? (
                            <div className="divide-y divide-accent">
                                {filteredTransactions.map(tx => (
                                    <div key={tx.id} className="p-4 hover:bg-primary/30 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                                 {tx.type === 'ORDER' ? (
                                                    <span className="w-8 h-8 flex items-center justify-center bg-blue-600/20 text-blue-400 rounded-full text-xs font-bold border border-blue-600/50 cursor-default">P</span>
                                                ) : (
                                                    <button 
                                                        onClick={() => setExportModalData(tx)}
                                                        title="Shkarko Faturën në Excel"
                                                        className="w-8 h-8 flex items-center justify-center bg-green-600/20 text-green-400 rounded-full text-xs font-bold border border-green-600/50 hover:bg-green-600 hover:text-white transition-colors animate-pulse-slow"
                                                    >
                                                        F
                                                    </button>
                                                )}
                                                <div>
                                                    <p className="font-bold text-text-main">Tavolina {tx.tableName}<span className="font-normal text-text-secondary text-sm ml-2">({tx.user?.username})</span></p>
                                                    <p className="text-xs text-text-secondary">{tx.date.toLocaleString('de-DE')}</p>
                                                </div>
                                            </div>
                                            <span className={`text-lg font-bold ${tx.type === 'ORDER' ? 'text-blue-400' : 'text-green-400'}`}>{formatCurrency(tx.total)}</span>
                                        </div>
                                        <div className="pl-11 text-sm text-text-secondary">
                                            {tx.items.map((item: any, idx: number) => (<span key={idx} className="mr-3 inline-block">{item.quantity}x {item.name}</span>))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                           ) : (<div className="p-8 text-center text-text-secondary">Nuk u gjetën transaksione.</div>)}
                        </div>
                    </div>
                )}

                {!isLoading && activeTab === 'items' && (
                    <div className="bg-secondary rounded-lg shadow-lg overflow-hidden animate-fade-in">
                         <div className="p-4 border-b border-accent bg-secondary/50 flex justify-between items-center">
                            <h3 className="font-bold text-text-main">Artikujt e Shitur</h3>
                            <span className="text-xs bg-highlight text-white px-2 py-1 rounded-full">{aggregatedItems.length} artikuj të ndryshëm</span>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-accent text-text-secondary text-xs uppercase font-semibold">
                                <tr>
                                    <th className="p-4">Emri i Artikullit</th>
                                    <th className="p-4 text-center">Sasia e Shitut</th>
                                    <th className="p-4 text-right">Vlera Totale</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-accent text-text-main">
                                {aggregatedItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-primary/30 transition-colors">
                                        <td className="p-4 font-medium">{item.name}</td>
                                        <td className="p-4 text-center"><span className="bg-primary px-3 py-1 rounded-full text-sm font-bold border border-accent">x{item.quantity}</span></td>
                                        <td className="p-4 text-right font-bold text-highlight">{formatCurrency(item.total)}</td>
                                    </tr>
                                ))}
                                {aggregatedItems.length === 0 && (
                                    <tr><td colSpan={3} className="p-8 text-center text-text-secondary">Asnjë artikull i shitur në këtë periudhë.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            
            </main>

            {/* Export Confirmation Modal */}
            {exportModalData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
                    <div className="bg-secondary p-6 rounded-lg shadow-2xl max-w-sm w-full border border-accent animate-scale-in">
                        <div className="flex items-center gap-3 mb-4 text-highlight">
                            <ReceiptIcon className="w-8 h-8" />
                            <h3 className="text-xl font-bold text-text-main">Shkarko Faturën?</h3>
                        </div>
                        <p className="text-text-secondary mb-6">
                            A dëshironi të shkarkoni faturën për 
                            <span className="font-bold text-text-main mx-1">Tavolinën {exportModalData.tableName}</span> 
                            në formatin Excel?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button 
                                onClick={() => setExportModalData(null)}
                                className="px-4 py-2 rounded-lg bg-primary text-text-secondary hover:bg-accent transition-colors font-medium"
                            >
                                Jo, Anulo
                            </button>
                            <button 
                                onClick={handleExportToExcel}
                                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-bold shadow-lg flex items-center gap-2"
                            >
                                <DownloadIcon className="w-5 h-5" />
                                <span>Po, Shkarko</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};            

export default SalesScreen;