import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer';

// 1. Configure Printer
const printer = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: '//localhost/POS58', 
  characterSet: CharacterSet.PC852_LATIN2,
  removeSpecialCharacters: false,
  width: 32, 
  options: { timeout: 5000 }
});

// 2. KITCHEN TICKET (Unchanged)
export const printOrderTicket = async (orderData) => {
  try {
    const isConnected = await printer.isPrinterConnected();
    printer.clear();
    printer.bold(true); 

    // HEADER
    printer.alignCenter();
    printer.setTextSize(1, 1); 
    printer.println("Porosia");
    printer.setTextSize(0, 0); 
    printer.println("--------------------------------");

    // INFO
    printer.alignLeft();
    printer.println(`Tavolina: ${orderData.tableName}`);
    printer.println(`User: ${orderData.user?.username || 'Staff'}`);
    
    const now = new Date();
    printer.println(`${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
    printer.println("--------------------------------");

    // COLUMNS
    printer.tableCustom([
      { text: "Artikulli", align: "LEFT", width: 0.60 }, 
      { text: "Cmimi", align: "RIGHT", width: 0.35 }     
    ]);
    printer.println("--------------------------------");

    // ITEMS (Separated)
    let totalSum = 0;
    if (orderData.items) {
      orderData.items.forEach(item => {
        const qty = item.quantity || 1;
        const price = Number(item.price) || 0;

        for (let i = 0; i < qty; i++) {
          printer.tableCustom([
            { text: item.name, align: "LEFT", width: 0.60 },
            { text: price.toFixed(2), align: "RIGHT", width: 0.35 }
          ]);
          totalSum += price;
        }
      });
    }
    printer.println("--------------------------------");

    // TOTAL
    printer.alignRight();
    printer.setTextSize(0, 1);
    printer.bold(true);
    printer.println(`Total: ${totalSum.toFixed(2)} EUR`);
    printer.setTextSize(0, 0); 
    printer.bold(false);

    printer.cut();
    await printer.execute();
    console.log("✅ Order Ticket Printed");

  } catch (error) {
    console.error("❌ Order Ticket Error:", error);
  }
};

// 3. CUSTOMER RECEIPT (Updated: Separated Items)
export const printSaleReceipt = async (saleData) => {
  try {
    const isConnected = await printer.isPrinterConnected();
    printer.clear();
    printer.bold(true);

    // HEADER
    printer.alignCenter();
    printer.setTextSize(1, 1); // Huge Title
    printer.println("Fatura");
    printer.setTextSize(0, 0); 
    printer.println("--------------------------------");

    // INFO
    printer.alignLeft();
    printer.println(`Order #: ${saleData.id.substring(0, 8)}`);
    printer.println(`Date: ${new Date(saleData.date).toLocaleString()}`);
    printer.println(`Server: ${saleData.user?.username || 'Staff'}`);
    printer.println("--------------------------------");

    // COLUMNS
    printer.tableCustom([
      { text: "Artikulli", align: "LEFT", width: 0.60 }, 
      { text: "Cmimi", align: "RIGHT", width: 0.35 }     
    ]);
    printer.println("--------------------------------");

    // ITEMS LOOP (Now Separated like Kitchen Ticket)
    if (saleData.order && saleData.order.items) {
        saleData.order.items.forEach(item => {
          const qty = item.quantity || 1;
          const price = Number(item.price) || 0; // Unit Price

          // Loop through quantity to print separate lines
          for (let i = 0; i < qty; i++) {
             printer.tableCustom([
               { text: item.name, align: "LEFT", width: 0.60 },
               { text: price.toFixed(2), align: "RIGHT", width: 0.35 }
             ]);
          }
        });
    }
    
    printer.println("--------------------------------");

    // TOTAL
    printer.alignRight();
    printer.setTextSize(0, 1); // Double Height
    printer.bold(true);
    
    const totalVal = Number(saleData.order?.total) || 0;
    printer.println(`Total: ${totalVal.toFixed(2)} EUR`);
    
    printer.setTextSize(0, 0); 
    printer.bold(false);

    // FOOTER (Albanian)
    printer.println("--------------------------------");
    printer.alignCenter();
    printer.println("Faleminderit për vizitën!");
    printer.println("Ju lutemi, na vizitoni përsëri.");
    
    printer.cut();
    await printer.execute();
    console.log("✅ Receipt Printed");
  } catch (error) {
    console.error("❌ Receipt Error:", error);
  }
};