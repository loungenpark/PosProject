// server/printer.js - PARTIAL UPDATE (Replace printOrderTicket)

export const printOrderTicket = async (orderData) => {
  try {
    const isConnected = await printer.isPrinterConnected();
    
    printer.clear();
    printer.bold(true); // Global Bold

    // --- HEADER ---
    printer.alignCenter();
    printer.setTextSize(1, 1); // Title (Huge)
    printer.println("Porosia");
    printer.setTextSize(0, 0); // Reset
    printer.println("--------------------------------");

    // --- METADATA ---
    printer.alignLeft();
    printer.println(`Tavolina: ${orderData.tableName}`);
    printer.println(`User: ${orderData.user?.username || 'Staff'}`);
    
    // Date & Time
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString();
    printer.println(`${dateString} ${timeString}`);
    printer.println("--------------------------------");

    // --- COLUMNS HEADERS ---
    // Widths reduced to 0.55 + 0.35 = 0.90 (Safe for POS58)
    printer.tableCustom([
      { text: "Artikulli", align: "LEFT", width: 0.55 }, 
      { text: "Cmimi", align: "RIGHT", width: 0.35 }     
    ]);
    
    printer.println("--------------------------------");

    // --- ITEMS LOOP ---
    let totalSum = 0;
    if (orderData.items) {
      orderData.items.forEach(item => {
        const qty = item.quantity || 1;
        const price = Number(item.price) || 0;

        // Print items separately (Loop through quantity)
        for (let i = 0; i < qty; i++) {
          printer.tableCustom([
            { text: item.name, align: "LEFT", width: 0.55 },
            { text: price.toFixed(2), align: "RIGHT", width: 0.35 }
          ]);
          totalSum += price;
        }
      });
    }

    printer.println("--------------------------------");

    // --- GRAND TOTAL ---
    printer.alignRight();       // Align Right
    printer.setTextSize(0, 1);  // Double Height Only (Not Huge)
    printer.println(`Total: ${totalSum.toFixed(2)} EUR`);
    printer.setTextSize(0, 0);  // Reset

    // --- EXECUTE ---
    printer.cut();
    await printer.execute();
    console.log("✅ Order Ticket Printed (Fixed Layout)");

  } catch (error) {
    console.error("❌ Printer Error:", error);
  }
};