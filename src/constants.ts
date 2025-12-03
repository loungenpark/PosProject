import { MenuItem, Printer, User, UserRole } from './types';

export const DEFAULT_USERS: Omit<User, 'id'>[] = [
  { username: 'Admin', pin: '1234', role: UserRole.ADMIN },
  { username: 'Kamarier', pin: '0000', role: UserRole.CASHIER },
];

export const MENU_ITEMS: MenuItem[] = [
  { id: 1, name: 'Pica Margarita', price: 8.50, category: 'Pica', printer: Printer.KITCHEN, stock: 50, stockThreshold: 10, trackStock: true },
  { id: 2, name: 'Pica Peperoni', price: 10.00, category: 'Pica', printer: Printer.KITCHEN, stock: 40, stockThreshold: 10, trackStock: true },
  { id: 3, name: 'Spageti Karbonara', price: 12.00, category: 'Pasta', printer: Printer.KITCHEN, stock: 30, stockThreshold: 5, trackStock: true },
  { id: 4, name: 'Lazanja', price: 11.50, category: 'Pasta', printer: Printer.KITCHEN, stock: 25, stockThreshold: 5, trackStock: true },
  { id: 5, name: 'Sallatë Çezar', price: 7.00, category: 'Sallata', printer: Printer.KITCHEN, stock: 60, stockThreshold: 15, trackStock: true },
  { id: 6, name: 'Tiramisu', price: 6.00, category: 'Ëmbëlsira', printer: Printer.KITCHEN, stock: 20, stockThreshold: 5, trackStock: true },
  { id: 7, name: 'Pana Kota', price: 5.50, category: 'Ëmbëlsira', printer: Printer.KITCHEN, stock: 20, stockThreshold: 5, trackStock: true },
  { id: 8, name: 'Ujë', price: 2.00, category: 'Pije', printer: Printer.BAR, stock: Infinity, stockThreshold: 50, trackStock: false },
  { id: 9, name: 'Coca-Cola', price: 2.50, category: 'Pije', printer: Printer.BAR, stock: Infinity, stockThreshold: 50, trackStock: false },
  { id: 10, name: 'Espreso', price: 1.50, category: 'Pije', printer: Printer.BAR, stock: Infinity, stockThreshold: 0, trackStock: false },
  { id: 11, name: 'Bukë me Hudhra', price: 4.50, category: 'Antipasta', printer: Printer.KITCHEN, stock: 100, stockThreshold: 20, trackStock: true },
  { id: 12, name: 'Brusketa', price: 5.00, category: 'Antipasta', printer: Printer.KITCHEN, stock: 80, stockThreshold: 20, trackStock: true },
];

export const INITIAL_TAX_RATE = 0.09; // 9% tax