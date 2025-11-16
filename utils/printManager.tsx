// C:\Users\loung\PosProject\utils\printManager.tsx
// --- ADDED ORDER TICKET PRINTING ---

import { printComponent } from './print';
import Receipt from '../components/Receipt';
import OrderTicket from '../components/OrderTicket'; // Import the OrderTicket component
import { Sale, Table, OrderItem, User } from '../types';

/**
 * Handles printing a sales receipt.
 * @param sale The sale object to be printed.
 */
export const printSaleReceipt = (sale: Sale): void => {
  const isPrintStation = localStorage.getItem('isPrintStation') === 'true';
  if (isPrintStation) {
    console.log('--- PrintManager: Printing sale receipt directly ---', sale);
    printComponent(<Receipt sale={sale} />);
  } else {
    console.log('--- PrintManager: Not a print station, skipping receipt print. ---');
  }
};

/**
 * ✅ Handles printing an order ticket for the kitchen/bar.
 * @param table The table the order is for.
 * @param newItems The new items to be printed on the ticket.
 * @param user The user who placed the order.
 */
export const printOrderTicket = (table: Table, newItems: OrderItem[], user: User | null): void => {
  const isPrintStation = localStorage.getItem('isPrintStation') === 'true';
  if (isPrintStation && newItems.length > 0) {
    console.log('--- PrintManager: Printing order ticket directly ---', { table, newItems });
    printComponent(<OrderTicket table={table} newItems={newItems} user={user} />);
  } else {
    console.log('--- PrintManager: Not a print station or no new items, skipping order print. ---');
  }
};