import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

# Directories to store generated PDFs for POs and invoices
os.makedirs("purchase_orders", exist_ok=True)
os.makedirs("invoices", exist_ok=True)

MSWIL_DATA = """
<b>Motherson Sumi Wiring India Limited</b><br/>
Head Office: C-14 A & B, Sector 1, Noida – 201301 Distt. Gautam Budh Nagar, U.P. India<br/>
GSTIN: 09XXXXXXXXXXXXX | PAN: XXXXXXXXXX <br/>
Tel: +91-120-XXXXXXX, XXXXXXX, Fax: +91-120-XXXXXXX, XXXXXXX, Website: www.motherson.com
"""

def generate_enterprise_pdf(file_path: str, doc_type: str, doc_id: int, customer_details: dict, item_details: list, addresses: dict):
    """
    A unified generator for building both POs and Invoices with multiple line items.
    """
    doc = SimpleDocTemplate(file_path, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(name='TitleStyle', parent=styles['Heading1'], fontSize=18, textColor=colors.darkblue)
    normal_style = styles['Normal']
    
    # 1. HEADER (Title and Date)
    elements.append(Paragraph(f"{doc_type} #{doc_id}", title_style))
    elements.append(Paragraph(f"Date: {datetime.now().strftime('%d-%b-%Y')}", normal_style))
    elements.append(Spacer(1, 20))
    
    # 2. ADDRESS BLOCK
    mswil_paragraph = Paragraph(MSWIL_DATA, normal_style)
    
    customer_info = f"<b>{customer_details['company']}</b><br/>" \
                    f"GSTIN: {customer_details['gst_number']}<br/>" \
                    f"Email: {customer_details['email']}<br/>" \
                    f"<b>Billing:</b> {addresses['billing']}<br/>" \
                    f"<b>Shipping:</b> {addresses['shipping']}"
    customer_paragraph = Paragraph(customer_info, normal_style)
    
    if doc_type == "PURCHASE ORDER":
        address_data = [["Supplier:", "Buyer / Bill To:"], [mswil_paragraph, customer_paragraph]]
    else:
        address_data = [["Supplier / Bill From:", "Buyer / Bill To:"], [mswil_paragraph, customer_paragraph]]
        
    address_table = Table(address_data, colWidths=[270, 270])
    address_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
    ]))
    elements.append(address_table)
    elements.append(Spacer(1, 30))
    
    # 3. DYNAMIC LINE ITEMS (The Grid)
    if doc_type == "TAX INVOICE":
        item_data = [['Description', 'HSN/SAC', 'Qty', 'Rate (INR)', 'Base Amount', 'IGST (18%)', 'Total (INR)']]
        
        for item in item_details:
            qty = item['quantity']
            rate = item['price']
            base_amount = qty * rate
            igst = base_amount * 0.18
            total_amount = base_amount + igst
            
            item_data.append([
                item['name'], 'XXXXXX', str(qty), f"{rate:,.2f}", f"{base_amount:,.2f}", f"{igst:,.2f}", f"{total_amount:,.2f}"
            ])
    else:
        item_data = [['Item Code', 'Description', 'Qty', 'Expected Rate (INR)', 'Expected Total (INR)']]
        
        for item in item_details:
            qty = item['quantity']
            rate = item['price']
            base_amount = qty * rate
            
            item_data.append([
                str(item['code']), item['name'], str(qty), f"{rate:,.2f}", f"{base_amount:,.2f}"
            ])
        
    item_table = Table(item_data)
    item_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 40))
    
    # 4. TERMS & CONDITIONS
    elements.append(Paragraph("<b>Terms & Conditions:</b>", normal_style))
    terms = "1. Payment Terms: 15 Days from invoice.<br/>2. Taxes applicable as per actuals.<br/>3. Subject to Noida Jurisdiction."
    elements.append(Paragraph(terms, normal_style))
    
    # Build the PDF
    doc.build(elements)