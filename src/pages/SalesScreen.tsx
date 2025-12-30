import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePos } from '../context/PosContext';
import * as api from '../utils/api';
import { Printer, Sale } from '../types';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { BarChart4, Package, Settings } from 'lucide-react';
import {
    ChartBarIcon,
    RestaurantIcon,
    CloseIcon,
    ReceiptIcon,
    ListIcon,
    RefreshIcon,
    CalendarIcon,
    DownloadIcon,
    GridIcon,
    LogoutIcon
} from '../components/common/Icons';

const formatCurrency = (amount: number | string) => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount)) return '0.00 €';
    // Use 'en-US' to ensure Dot (.) separator for decimals (e.g. 10.50 €)
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(numericAmount).replace('€', '').trim() + ' €';
};

type SalesTab = 'incomes' | 'transactions' | 'items';

const SalesScreen: React.FC = () => {
    const { loggedInUser, setActiveScreen, logout, users, companyInfo, taxRate, operationalDayStartHour } = usePos();
    const [activeTab, setActiveTab] = useState<SalesTab>('incomes');
    const [localSales, setLocalSales] = useState<Sale[]>([]);
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

        const year = dateObj.getFullYear().toString().slice(-2);
        const numericId = tx.id.replace(/\D/g, '');
        const shortId = numericId.slice(-4);
        const invoiceNo = `${year}${shortId}`;

        // 3. Header Row 1: Company Name (Left) | Date (Right)
        const row1 = worksheet.addRow([
            companyInfo.name || 'Restorant POS',
            '',
            '',
            `Data: ${dateStr}`
        ]);
        row1.getCell(1).font = { bold: true, size: 12 };
        row1.getCell(4).alignment = { horizontal: 'right' };

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

        worksheet.addRow([]);

        // 6. Buyer Section (Blerësi)
        const buyerLabel = worksheet.addRow(['Blerësi:']);
        buyerLabel.font = { bold: true, underline: true };

        worksheet.addRow(['Emri i Biznesit']);
        worksheet.addRow(['NUI: 1111']);
        worksheet.addRow(['Adresa: aaaa']);

        worksheet.addRow([]);

        // 7. Table Header
        const headerRow = worksheet.addRow(['Artikulli', 'Sasia', 'Çmimi (€)', 'Totali (€)']);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4a5568' }, // Our theme's 'border' color
            };
            cell.border = {
                top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
            };
        });

        // 8. Items Data
        tx.items.forEach((item: any) => {
            const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
            const quantity = item.quantity;
            const total = price * quantity;
            const row = worksheet.addRow([item.name, quantity, price.toFixed(2), total.toFixed(2)]);
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
                };
            });
            row.getCell(2).alignment = { horizontal: 'center' };
            row.getCell(3).alignment = { horizontal: 'right' };
            row.getCell(4).alignment = { horizontal: 'right' };
        });

        // 9. Totals Section
        worksheet.addRow([]);
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
        worksheet.addRows([[], [], [], []]);
        const signatureRow = worksheet.addRow(['', 'Nënshkrimi dhe Vula', '', '']);
        const sigRowNumber = signatureRow.number;
        worksheet.mergeCells(`B${sigRowNumber}:D${sigRowNumber}`);
        const sigCell = worksheet.getCell(`B${sigRowNumber}`);
        sigCell.font = { bold: true };
        sigCell.alignment = { horizontal: 'center' };
        sigCell.border = { top: { style: 'thin' } };

        // 11. Generate and Save
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Fatura_${invoiceNo}.xlsx`);
        setExportModalData(null);
    };

    // --- FILTERS ---
    const todayStr = new Date().toISOString().split('T')[0];
    const [dateRange, setDateRange] = useState({ from: todayStr, to: todayStr });
    const [selectedUserId, setSelectedUserId] = useState('');

    // --- DATA FETCHING (with manual refresh for date range) ---
    const loadData = useCallback(async (from: string, to: string) => {
        setIsLoading(true);
        try {
            // Fetch sales for the range
            const serverSales = await api.getSales(from, to);
            setLocalSales(serverSales.map(s => ({ ...s, date: new Date(s.date) })));

            // Tickets are fetched in bulk; we filter them client-side in useMemo
            const tickets = await api.getOrderTickets();
            const formattedTickets = tickets.map((t: any) => ({ ...t, date: new Date(t.date) }));
            setOrderTickets(formattedTickets);

        } catch (error) {
            console.error("Failed to load sales data:", error);
            setLocalSales([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData(dateRange.from, dateRange.to);
    }, [dateRange, loadData]);

    // --- 1. TAB: INCOMES (Logic) ---
    const salesSummary = useMemo(() => {
        let totalShankRevenue = 0;
        let totalKuzhinaRevenue = 0;
        const filteredSales = localSales.filter(sale => !selectedUserId || sale.user.id === parseInt(selectedUserId, 10));

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
    }, [localSales, selectedUserId]);

    // --- 1.1 DAILY BREAKDOWN (Logic) ---
    const dailyBreakdown = useMemo(() => {
        const filteredSales = localSales.filter(sale => !selectedUserId || sale.user.id === parseInt(selectedUserId, 10));
        const groups: Record<string, { date: Date, total: number, shank: number, kuzhina: number, count: number }> = {};

        filteredSales.forEach(sale => {
            // Determine Operational Date Key
            const opDate = new Date(sale.date);

            // Adjust for Operational Day (if before start hour, counts as previous day)
            if (opDate.getHours() < operationalDayStartHour) {
                opDate.setDate(opDate.getDate() - 1);
            }

            // FIX: Use local date components to avoid UTC timezone shifts
            const year = opDate.getFullYear();
            const month = String(opDate.getMonth() + 1).padStart(2, '0');
            const day = String(opDate.getDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`;

            if (!groups[dateKey]) {
                groups[dateKey] = { date: opDate, total: 0, shank: 0, kuzhina: 0, count: 0 };
            }

            // Calculate Sale Totals
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

            // Distribute Total based on Ratio
            if (sale.order.subtotal > 0) {
                const shankRatio = subtotalShank / sale.order.subtotal;
                const kuzhinaRatio = subtotalKuzhina / sale.order.subtotal;

                groups[dateKey].total += sale.order.total;
                groups[dateKey].shank += sale.order.total * shankRatio;
                groups[dateKey].kuzhina += sale.order.total * kuzhinaRatio;
            }
            groups[dateKey].count += 1;
        });

        // Convert to array and sort DESC (Newest first)
        return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [localSales, selectedUserId, operationalDayStartHour]);

    // --- 2. TAB: TRANSACTIONS (Logic) ---
    const filteredTransactions = useMemo(() => {
        // Calculate range for Tickets (Client-side filtering)
        const start = new Date(dateRange.from);
        start.setHours(operationalDayStartHour, 0, 0, 0);

        const end = new Date(dateRange.to);
        end.setDate(end.getDate() + 1); // Go to next day
        end.setHours(operationalDayStartHour, 0, 0, 0);
        end.setSeconds(end.getSeconds() - 1); // End at 04:59:59

        const ticketEvents = orderTickets
            .filter(t => t.date >= start && t.date <= end)
            .map(t => ({
                id: `ticket-${t.id}`, type: 'ORDER', tableName: t.tableName, user: t.user, date: t.date, items: t.items,
                total: parseFloat(t.total), subtotal: parseFloat(t.total), tax: 0
            }));

        // Sales are already filtered by the server based on the same logic
        const saleEvents = localSales.map(s => ({
            id: `${s.id}`, type: 'RECEIPT', tableName: s.tableName, user: s.user, date: new Date(s.date), items: s.order.items,
            total: s.order.total, subtotal: s.order.subtotal, tax: s.order.tax
        }));

        const combined = [...ticketEvents, ...saleEvents];

        return combined
            .filter(tx => !selectedUserId || tx.user?.id === parseInt(selectedUserId, 10))
            .sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [localSales, orderTickets, dateRange, selectedUserId, operationalDayStartHour]);

    // --- 3. TAB: ITEMS (Logic) ---
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

    interface SoldItemGroup {
        groupKey: string;
        groupName: string;
        isGroup: boolean;
        totalQuantity: number;
        totalValue: number;
        items: { name: string; quantity: number; total: number; }[];
    }

    const aggregatedItems = useMemo((): SoldItemGroup[] => {
        const relevantSales = localSales.filter(sale => !selectedUserId || sale.user.id === parseInt(selectedUserId, 10));
        const map = new Map<string, SoldItemGroup>();

        relevantSales.forEach(sale => {
            sale.order.items.forEach(item => {
                const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
                const itemTotal = price * item.quantity;

                const groupKey = item.stockGroupId || `item-${item.id}`;
                const isGroup = !!item.stockGroupId;

                const existingGroup = map.get(groupKey);

                if (existingGroup) {
                    existingGroup.totalQuantity += item.quantity;
                    existingGroup.totalValue += itemTotal;

                    const existingItem = existingGroup.items.find(i => i.name === item.name);
                    if (existingItem) {
                        existingItem.quantity += item.quantity;
                        existingItem.total += itemTotal;
                    } else {
                        existingGroup.items.push({ name: item.name, quantity: item.quantity, total: itemTotal });
                    }
                } else {
                    map.set(groupKey, {
                        groupKey: groupKey,
                        groupName: isGroup ? (item.stockGroupId.charAt(0).toUpperCase() + item.stockGroupId.slice(1)) : item.name,
                        isGroup: isGroup,
                        totalQuantity: item.quantity,
                        totalValue: itemTotal,
                        items: [{ name: item.name, quantity: item.quantity, total: itemTotal }],
                    });
                }
            });
        });

        return Array.from(map.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
    }, [localSales, selectedUserId]);

    const handleToggleGroup = (groupKey: string) => {
        setExpandedGroups(prev =>
            prev.includes(groupKey) ? prev.filter(key => key !== groupKey) : [...prev, groupKey]
        );
    };

    // --- RENDER HELPERS ---
    const FilterBar = () => (
        <div className="bg-secondary p-4 rounded-lg mb-6 flex flex-col md:flex-row md:items-center gap-4 shadow-sm">

            {/* Label & Dates Container */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
                {/* Mobile Header / Desktop Label */}
                <div className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-highlight" />
                    <span className="font-semibold text-tsecondary">Periudha</span>
                </div>

                {/* Dates - Grid on Mobile (2 cols), Flex on Desktop */}
                <div className="grid grid-cols-2 md:flex md:items-center gap-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                        <span className="text-xs md:text-sm text-tsecondary">Prej:</span>
                        <input
                            type="date"
                            value={dateRange.from}
                            onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                            className="w-full md:w-auto bg-primary border border-border rounded-md p-2 text-sm text-tmain focus:ring-highlight focus:border-highlight"
                        />
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                        <span className="text-xs md:text-sm text-tsecondary">Deri:</span>
                        <input
                            type="date"
                            value={dateRange.to}
                            onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                            className="w-full md:w-auto bg-primary border border-border rounded-md p-2 text-sm text-tmain focus:ring-highlight focus:border-highlight"
                        />
                    </div>
                </div>
            </div>

            <div className="w-px h-8 bg-border mx-2 hidden md:block"></div>

            {/* Row 3 on Mobile: Users (Left Col) + Actions (Right Col) */}
            <div className="grid grid-cols-2 md:flex md:items-center gap-4 w-full md:w-auto md:ml-auto">
                {/* Left Column: Users (Aligns with Prej) */}
                <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full md:w-auto bg-primary border border-border rounded-md p-2 text-sm text-tmain focus:ring-highlight focus:border-highlight"
                >
                    <option value="">Përdoruesit</option>
                    {users.map(user => (
                        <option key={user.id} value={user.id.toString()}>{user.username}</option>
                    ))}
                </select>

                {/* Right Column: Buttons (Aligns with Deri) */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                        onClick={() => { setDateRange({ from: todayStr, to: todayStr }); setSelectedUserId(''); }}
                        className="flex-1 md:flex-none px-3 md:px-4 h-10 rounded-md bg-primary text-tsecondary border border-border hover:text-tmain text-sm transition-colors whitespace-nowrap"
                    >
                        Pastro
                    </button>
                    <button
                        onClick={() => loadData(dateRange.from, dateRange.to)}
                        disabled={isLoading}
                        className="flex-1 md:flex-none px-3 md:px-4 h-10 rounded-md bg-highlight text-white font-semibold hover:bg-highlight-hover text-sm flex justify-center items-center gap-2 disabled:bg-muted disabled:text-tsecondary transition-colors shadow-md md:shadow-none whitespace-nowrap"
                    >
                        <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Rifresko</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-primary z-50 flex flex-col">
            <header className="flex-shrink-0 bg-secondary flex items-center justify-between p-2 md:p-4 shadow-md z-10">
                <h1 className="hidden md:flex text-xl font-semibold text-highlight items-center gap-2">
                    <BarChart4 className="w-6 h-6 text-highlight" />
                    Raporte & Statistika
                </h1>
                <div className="flex items-center justify-end w-full md:w-auto space-x-2 md:space-x-4">
                    {/* POS Button */}
                    <button
                        onClick={() => setActiveScreen('pos')}
                        className="px-4 h-11 bg-primary text-tsecondary font-semibold rounded-lg border-2 border-transparent hover:border-highlight hover:text-highlight transition-colors flex items-center gap-2"
                    >
                        <GridIcon className="w-5 h-5" />
                        <span className="hidden md:inline">POS</span>
                    </button>

                    {/* Raporte Button (Active) */}
                    <button
                        onClick={() => setActiveScreen('sales')}
                        className="px-4 h-11 bg-primary text-highlight font-semibold rounded-lg border-2 border-highlight transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <BarChart4 className="w-5 h-5" />
                        <span className="hidden md:inline">Raporte</span>
                    </button>

                    {/* Stoku Button */}
                    <button
                        onClick={() => setActiveScreen('stock')}
                        className="px-4 h-11 bg-primary text-tsecondary font-semibold rounded-lg border-2 border-transparent hover:border-highlight hover:text-highlight transition-colors flex items-center gap-2"
                    >
                        <Package className="w-5 h-5" />
                        <span className="hidden md:inline">Stoku</span>
                    </button>

                    {/* Menaxhimi Button */}
                    <button
                        onClick={() => setActiveScreen('admin')}
                        className="px-4 h-11 bg-primary text-tsecondary font-semibold rounded-lg border-2 border-transparent hover:border-highlight hover:text-highlight transition-colors flex items-center gap-2"
                    >
                        <Settings className="w-5 h-5" />
                        <span className="hidden md:inline">Menaxhimi</span>
                    </button>

                    <div className="w-px h-6 bg-border mx-2"></div>
                    <span className="hidden md:inline text-tsecondary">{loggedInUser?.username}</span>

                    {/* Logout Button */}
                    <button onClick={logout} className="p-2 rounded-full text-tsecondary hover:bg-border hover:text-tmain transition-colors" title="Dil">
                        <LogoutIcon className="w-6 h-6" />
                    </button>
                </div>
            </header>

            <div className="bg-secondary px-4 border-b border-border flex gap-4">
                {/* Incomes Tab */}
                <button onClick={() => setActiveTab('incomes')} className={`py-4 px-2 border-b-4 font-semibold flex items-center gap-2 transition-colors ${activeTab === 'incomes' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:border-highlight hover:text-highlight'}`}>
                    <ChartBarIcon className="w-5 h-5" />
                    Të Ardhurat
                </button>
                {/* Transactions Tab */}
                <button onClick={() => setActiveTab('transactions')} className={`py-4 px-2 border-b-4 font-semibold flex items-center gap-2 transition-colors ${activeTab === 'transactions' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:border-highlight hover:text-highlight'}`}>
                    <ReceiptIcon className="w-5 h-5" />
                    Transaksionet
                </button>
                {/* Items Tab */}
                <button onClick={() => setActiveTab('items')} className={`py-4 px-2 border-b-4 font-semibold flex items-center gap-2 transition-colors ${activeTab === 'items' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:border-highlight hover:text-highlight'}`}>
                    <ListIcon className="w-5 h-5" />
                    Artikujt
                </button>
            </div>

            <main className="flex-grow p-6 overflow-y-auto bg-primary">
                <FilterBar />
                {isLoading && (
                    <div className="text-center py-8 text-tsecondary animate-pulse">
                        Duke ngarkuar të dhënat...
                    </div>
                )}

                {!isLoading && activeTab === 'incomes' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                        <div className="bg-secondary p-6 rounded-lg shadow-lg border border-border/50 relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><RestaurantIcon className="w-24 h-24 text-highlight" /></div>
                            <h3 className="text-tsecondary text-sm font-bold uppercase tracking-wider mb-2">Shank</h3>
                            <p className="text-4xl font-semibold font-data text-highlight">{formatCurrency(salesSummary.totalShankRevenue)}</p>
                        </div>
                        <div className="bg-secondary p-6 rounded-lg shadow-lg border border-border/50 relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><RestaurantIcon className="w-24 h-24 text-success" /></div>
                            <h3 className="text-tsecondary text-sm font-bold uppercase tracking-wider mb-2">Kuzhina</h3>
                            <p className="text-4xl font-semibold font-data text-highlight">{formatCurrency(salesSummary.totalKuzhinaRevenue)}</p>
                        </div>
                        <div className="bg-secondary p-6 rounded-lg shadow-lg border-l-4 border-highlight relative overflow-hidden">
                            <h3 className="text-tsecondary text-sm font-bold uppercase tracking-wider mb-2">Totali i Përgjithshëm</h3>
                            <p className="text-4xl font-semibold font-data text-highlight">{formatCurrency(salesSummary.totalRevenue)}</p>
                            <p className="text-sm text-tsecondary mt-2">{salesSummary.count} fatura të mbyllura</p>
                        </div>
                    </div>
                )}

                {/* DAILY BREAKDOWN TABLE (Only visible in Incomes tab if we have MORE THAN 1 DAY) */}
                {!isLoading && activeTab === 'incomes' && dailyBreakdown.length > 1 && (
                    <div className="mt-8 bg-secondary rounded-lg shadow-lg overflow-hidden animate-fade-in">
                        <div className="p-4 border-b border-border bg-secondary/50">
                            <h3 className="font-bold text-tsecondary">Detajet Ditore</h3>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-border text-tsecondary text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-2 py-3 text-left">Data</th>
                                    <th className="px-2 py-3 text-right">Shank</th>
                                    <th className="px-2 py-3 text-right">Kuzhina</th>
                                    <th className="px-2 py-3 text-right">Totali</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-highlight">
                                {dailyBreakdown.map((day, idx) => (
                                    <tr key={idx} className="hover:bg-primary/30 transition-colors">
                                        <td className="px-2 py-3 font-medium text-sm">
                                            {day.date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                                        </td>
                                        <td className="px-2 py-3 text-right text-sm font-data">{formatCurrency(day.shank)}</td>
                                        <td className="px-2 py-3 text-right text-sm font-data">{formatCurrency(day.kuzhina)}</td>
                                        <td className="px-2 py-3 text-right font-bold text-sm font-data">{formatCurrency(day.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!isLoading && activeTab === 'transactions' && (
                    <div className="bg-secondary rounded-lg shadow-lg overflow-hidden animate-fade-in">
                        <div className="p-4 border-b border-border bg-secondary/50"><h3 className="font-bold text-tsecondary">Historiku i Veprimeve</h3></div>
                        <div className="overflow-x-auto">
                            {filteredTransactions.length > 0 ? (
                                <div className="divide-y divide-border">
                                    {filteredTransactions.map(tx => (
                                        <div key={tx.id} className="p-4 hover:bg-primary/30 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-3">
                                                    {tx.type === 'ORDER' ? (
                                                        <span className="w-8 h-8 flex items-center justify-center bg-highlight/20 text-highlight rounded-full text-xs font-bold border border-highlight/50 cursor-default">P</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => setExportModalData(tx)}
                                                            title="Shkarko Faturën në Excel"
                                                            className="w-8 h-8 flex items-center justify-center bg-success-bg text-success rounded-full text-xs font-bold border border-success/50 hover:bg-success hover:text-white transition-colors animate-pulse-slow"
                                                        >
                                                            F
                                                        </button>
                                                    )}
                                                    <div>
                                                        <p className="font-semibold text-tmain">Tavolina {tx.tableName}<span className="font-normal text-tsecondary text-sm ml-2">({tx.user?.username})</span></p>
                                                        <p className="text-xs text-tsecondary">{tx.date.toLocaleString('de-DE')}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-lg font-semibold font-data ${tx.type === 'ORDER' ? 'text-highlight' : 'text-success'}`}>{formatCurrency(tx.total)}</span>
                                            </div>
                                            <div className="pl-11 text-sm text-tsecondary">
                                                {tx.items.map((item: any, idx: number) => (<span key={idx} className="mr-3 inline-block font-data">{item.quantity}x <span className="font-sans">{item.name}</span></span>))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (<div className="p-8 text-center text-tsecondary">Nuk u gjetën transaksione.</div>)}
                        </div>
                    </div>
                )}

                {/* ITEMS TABLE (Logic) */}
                {!isLoading && activeTab === 'items' && (
                    <div className="bg-secondary rounded-lg shadow-lg overflow-hidden animate-fade-in">
                        <div className="p-4 border-b border-border bg-secondary/50 flex justify-between items-center">
                            <h3 className="font-bold text-tsecondary">Artikujt e Shitur</h3>
                            <span className="text-xs bg-highlight text-white px-2 py-1 rounded-full">{aggregatedItems.length} grupe/artikuj</span>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-border text-tsecondary text-xs uppercase font-semibold">
                                <tr>
                                    <th className="p-4">Emri i Artikullit / Grupit</th>
                                    <th className="p-4 text-center">Sasia e Shitur</th>
                                    <th className="p-4 text-right">Vlera Totale</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-tmain">
                                {aggregatedItems.map((group) => {
                                    const isExpanded = expandedGroups.includes(group.groupKey);
                                    return (
                                        <React.Fragment key={group.groupKey}>
                                            <tr
                                                className={`hover:bg-primary/30 transition-colors ${group.isGroup ? 'cursor-pointer' : ''}`}
                                                onClick={() => group.isGroup && handleToggleGroup(group.groupKey)}
                                            >
                                                <td className="p-4 font-medium flex items-center gap-2">
                                                    {group.isGroup && (
                                                        <span className="text-highlight w-4 inline-block">
                                                            {isExpanded ? '▼' : '►'}
                                                        </span>
                                                    )}
                                                    {group.groupName}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="bg-primary px-3 py-1 rounded-full text-sm font-semibold border border-border font-data">
                                                        x{group.totalQuantity}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-semibold text-highlight font-data">{formatCurrency(group.totalValue)}</td>
                                            </tr>
                                            {isExpanded && group.items.map((item, index) => (
                                                <tr key={`${group.groupKey}-${index}`} className="bg-primary/20">
                                                    <td className="pl-12 py-2 pr-4 text-sm text-tsecondary">{item.name}</td>
                                                    <td className="py-2 pr-4 text-center text-sm text-tsecondary font-data">x{item.quantity}</td>
                                                    <td className="py-2 pr-4 text-right text-sm text-tsecondary font-data">{formatCurrency(item.total)}</td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                                {aggregatedItems.length === 0 && (
                                    <tr><td colSpan={3} className="p-8 text-center text-tsecondary">Asnjë artikull i shitur në këtë periudhë.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {/* Export Confirmation Modal */}
            {exportModalData && (
                <div className="fixed inset-0 bg-primary/50 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
                    <div className="bg-secondary p-6 rounded-lg shadow-2xl max-w-sm w-full border border-border animate-scale-in">
                        <div className="flex items-center gap-3 mb-4 text-highlight">
                            <ReceiptIcon className="w-8 h-8" />
                            <h3 className="text-xl font-bold text-tmain">Shkarko Faturën?</h3>
                        </div>
                        <p className="text-tsecondary mb-6">
                            A dëshironi të shkarkoni faturën për
                            <span className="font-bold text-tmain mx-1">Tavolinën {exportModalData.tableName}</span>
                            në formatin Excel?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setExportModalData(null)}
                                className="px-4 py-2 rounded-lg bg-primary text-tsecondary hover:bg-border transition-colors font-medium"
                            >
                                Jo, Anulo
                            </button>
                            <button
                                onClick={handleExportToExcel}
                                className="px-4 py-2 rounded-lg bg-success text-white hover:bg-success-hover transition-colors font-bold shadow-lg flex items-center gap-2"
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