import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

# Ensure the directory to store PDFs exists when the server starts
os.makedirs("purchase_orders", exist_ok=True)

def generate_po_pdf(po_id: int, customer_username: str, item_name: str, quantity: int, total_price: float, status: str) -> str:
    """
    Generates a stylized PO PDF using ReportLab.
    Saves it locally to the 'purchase_orders' folder.
    """
    # Create a unique file name based on the order ID and user
    file_path = f"purchase_orders/PO_{po_id}_{customer_username}.pdf"
    
    # Initialize the PDF canvas (this acts like a blank piece of paper)
    c = canvas.Canvas(file_path, pagesize=letter)
    
    # --- HEADER ---
    c.setFont("Helvetica-Bold", 16)
    # X and Y coordinates (from bottom-left corner of the page)
    c.drawString(50, 750, "Motherson Sumi Wiring India Ltd.")
    
    c.setFont("Helvetica", 10)
    c.drawString(50, 735, "Enterprise Inventory System")
    
    # --- PO DETAILS ---
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 690, f"PURCHASE ORDER: #{po_id}")
    
    c.setFont("Helvetica", 11)
    c.drawString(50, 670, f"Date Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    c.drawString(50, 650, f"Customer / Vendor ID: {customer_username}")
    
    # --- LINE ITEMS ---
    c.line(50, 630, 550, 630) # Draws a horizontal line across the page
    
    c.drawString(50, 610, "Order Summary:")
    c.drawString(70, 585, f"Item Requested: {item_name}")
    c.drawString(70, 565, f"Quantity Approved: {quantity} Units")
    c.drawString(70, 545, f"Total Billed Value: ${total_price:.2f}")
    
    # --- STATUS ---
    c.line(50, 520, 550, 520)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 490, f"Current Status: {status.upper()}")
    
    # Save the document to the hard drive
    c.save()
    
    return file_path