import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_RIGHT, TA_LEFT

# Directories to store generated PDFs for POs and invoices
os.makedirs("purchase_orders", exist_ok=True)
os.makedirs("invoices", exist_ok=True)

MSWIL_ADDRESS = """
Head Office: C-14 A & B, Sector 1, Noida - 201301<br/>
Distt. Gautam Budh Nagar, U.P. India<br/>
GSTIN: 09XXXXXXXXXXXXX | PAN: XXXXXXXXXX <br/>
Tel: +91-120-XXXXXXX | Web: www.motherson.com
"""

def generate_enterprise_pdf(file_path: str, doc_type: str, doc_id: int, customer_details: dict, item_details: list, addresses: dict, meta: dict):
    """
    An enterprise-grade unified generator for building theme-aware POs and Invoices.
    """
    doc = SimpleDocTemplate(file_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    elements = []
    styles = getSampleStyleSheet()
    
    # 1. THEME DEFINITION
    is_invoice = doc_type == "TAX INVOICE"
    theme_color = colors.HexColor('#4f46e5') if is_invoice else colors.HexColor('#059669') # Indigo for Invoices, Emerald for POs
    branding_color = colors.HexColor('#DB2029')
    bg_light = colors.HexColor('#f8fafc')
    
    # Custom Typography Styles
    meta_style = ParagraphStyle(name='Meta', fontSize=10, textColor=colors.darkgray, alignment=TA_RIGHT, leading=14)
    h1_style = ParagraphStyle(name='H1', fontSize=18, fontName='Helvetica-Bold', textColor=branding_color)
    normal_style = ParagraphStyle(name='NormalStyle', fontSize=9, leading=14, textColor=colors.black)
    bold_style = ParagraphStyle(name='BoldStyle', fontSize=9, fontName='Helvetica-Bold', leading=14)

    # 2. HEADER BLOCK (Branding & Document Meta)
    logo_path = "logo.png" 
    if os.path.exists(logo_path):
        branding = Image(logo_path, width=1.5*inch, height=1.5*inch)
        branding.hAlign = 'LEFT'
    else:
        branding = Paragraph("<b>MSWIL</b>", ParagraphStyle(name="Logo", fontSize=28, fontName='Helvetica-Bold', textColor=branding_color))

    # Construct the top-right metadata
    doc_date = meta.get('invoice_date') if is_invoice else meta.get('po_date')
    if not doc_date:
        doc_date = datetime.now().strftime('%d-%b-%Y')

    meta_text = f"<font size='22' color='{theme_color.hexval()}'><b>{doc_type}</b></font><br/><br/>"
    meta_text += f"Document #: <b>{doc_id}</b><br/>"
    if is_invoice and meta.get('po_ref'):
        meta_text += f"PO Ref #: <b>{meta.get('po_ref')}</b><br/>"
    meta_text += f"Date: <b>{doc_date}</b><br/>"
    
    if is_invoice and meta.get('admin_name'):
        meta_text += f"Invoiced By: {meta.get('admin_name')}<br/>"

    header_table = Table([[branding, Paragraph(meta_text, meta_style)]], colWidths=[3*inch, 4*inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10)
    ]))
    elements.append(header_table)
    
    # 3. COMPANY DETAILS
    elements.append(Paragraph("Motherson Sumi Wiring India Limited", h1_style))
    elements.append(Spacer(1, 15))
    elements.append(Paragraph(MSWIL_ADDRESS, normal_style))
    elements.append(Spacer(1, 20))
    
    # 4. ADDRESS BLOCK (Bill To / Bill From)
    buyer_name = meta.get('buyer_name', customer_details.get('company', 'Unknown Buyer'))
    
    customer_info = f"<b>Company:</b> {customer_details.get('company')}<br/>" \
                    f"<b>Contact:</b> {buyer_name}<br/>" \
                    f"<b>GSTIN:</b> {customer_details.get('gst_number', 'Not Provided')}<br/>" \
                    f"<b>Email:</b> {customer_details.get('email', 'N/A')}<br/><br/>" \
                    f"<b>Billing Address:</b><br/>{addresses.get('billing', 'N/A')}<br/><br/>" \
                    f"<b>Shipping Address:</b><br/>{addresses.get('shipping', 'N/A')}"
                    
    supplier_info = f"<b>Motherson Sumi Wiring India Limited</b><br/>" \
                    f"C-14 A & B, Sector 1, Noida - 201301<br/>" \
                    f"GSTIN: 09XXXXXXXXXXXXX<br/>" \
                    f"State: Uttar Pradesh (09)"

    address_data = [
        [Paragraph("<b>Supplier / Bill From:</b>", bold_style), Paragraph("<b>Buyer / Bill To:</b>", bold_style)],
        [Paragraph(supplier_info, normal_style), Paragraph(customer_info, normal_style)]
    ]

    address_table = Table(address_data, colWidths=[3.6*inch, 3.6*inch])
    address_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), bg_light),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ('PADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(address_table)
    elements.append(Spacer(1, 30))
    
    # 5. DYNAMIC LINE ITEMS (The Data Grid)
    grand_total = 0.0
    total_tax = 0.0
    total_base = 0.0
    
    if is_invoice:
        item_data = [['#', 'Item Description', 'HSN/SAC', 'Qty', 'Rate (INR)', 'Base Amt', 'IGST (18%)', 'Total (INR)']]
        # Spacing for each column
        col_widths = [0.3*inch, 1.9*inch, 0.7*inch, 0.4*inch, 0.9*inch, 1.0*inch, 0.9*inch, 1.2*inch]
        
        for idx, item in enumerate(item_details, 1):
            qty = item['quantity']
            rate = item['price']
            base = qty * rate
            igst = base * 0.18
            total = base + igst
            
            total_base += base
            total_tax += igst
            grand_total += total
            
            item_data.append([
                str(idx), Paragraph(item['name'], normal_style), 'XXXXXX', str(qty), 
                f"{rate:,.2f}", f"{base:,.2f}", f"{igst:,.2f}", f"{total:,.2f}"
            ])
            
        # Add the Grand Total Row
        item_data.append([
            'Grand Total', '', '', '', '',
            f"{total_base:,.2f}", f"{total_tax:,.2f}", f"{grand_total:,.2f}"
        ])
        item_data.append(['', '', '', '', '', '', '', Paragraph("<font color='gray' size='7'><i>Incl. of GST</i></font>", ParagraphStyle(name='GST', alignment=TA_RIGHT))])
        
        grand_total_idx = len(item_data) - 2
        span_coords = ('SPAN', (0, grand_total_idx), (4, grand_total_idx)) 
        helper_span = ('SPAN', (0, -1), (6, -1))
        
    else: # PURCHASE ORDER logic
        item_data = [['#', 'Item Description', 'Item Code', 'Qty', 'Rate (INR)', 'Total (INR)']]
        col_widths = [0.4*inch, 2.9*inch, 1.0*inch, 0.6*inch, 1.1*inch, 1.3*inch]
        
        for idx, item in enumerate(item_details, 1):
            qty = item['quantity']
            rate = item['price']
            base = qty * rate
            grand_total += base
            
            item_data.append([
                str(idx), Paragraph(item['name'], normal_style), str(item.get('code', '')), 
                str(qty), f"{rate:,.2f}", f"{base:,.2f}"
            ])
            
        # Add the Grand Total Row
        item_data.append(['Grand Total (Excl. GST)', '', '', '', '', f"{grand_total:,.2f}"])
        
        grand_total_idx = len(item_data) - 1
        span_coords = ('SPAN', (0, grand_total_idx), (4, grand_total_idx))
        helper_span = ('SPAN', (0, 0), (0, 0)) 

    item_table = Table(item_data, colWidths=col_widths)
    
    # Base table styling
    table_styles = [
        ('BACKGROUND', (0, 0), (-1, 0), theme_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('PADDING', (0, 0), (-1, 0), 10),
        
        # Body Style
        ('ALIGN', (2, 1), (-1, -1), 'RIGHT'), # Align numbers to the right
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, grand_total_idx - 1), 0.5, colors.lightgrey),
        ('PADDING', (0, 1), (-1, grand_total_idx - 1), 8),
        ('RIGHTPADDING', (2, 1), (-1, -1), 4),
        
        # Grand Total Row Style
        span_coords,
        ('FONTNAME', (0, grand_total_idx), (-1, grand_total_idx), 'Helvetica-Bold'),
        ('BACKGROUND', (0, grand_total_idx), (-1, grand_total_idx), bg_light),
        ('ALIGN', (0, grand_total_idx), (-1, grand_total_idx), 'RIGHT'),
        ('LINEABOVE', (0, grand_total_idx), (-1, grand_total_idx), 1, colors.black),
        ('LINEBELOW', (0, grand_total_idx), (-1, grand_total_idx), 1.5, colors.black),
        ('TOPPADDING', (0, grand_total_idx), (-1, grand_total_idx), 10),
        ('BOTTOMPADDING', (0, grand_total_idx), (-1, grand_total_idx), 10),
    ]
    
    if is_invoice:
        table_styles.extend([
            helper_span,
            ('LINEBELOW', (0, -1), (-1, -1), 0, colors.white),
            ('LINEABOVE', (0, -1), (-1, -1), 0, colors.white),
            ('PADDING', (0, -1), (-1, -1), 2)
        ])
        
    item_table.setStyle(TableStyle(table_styles))
    elements.append(item_table)
    elements.append(Spacer(1, 40))
    
    # 6. FOOTER & AUTHORIZED SIGNATORY
    terms = "1. Payment Terms: 15 Days from invoice.<br/>2. Taxes applicable as per actuals.<br/>3. Subject to Noida Jurisdiction."
    
    sig_data = [
        [Paragraph("<b>Terms & Conditions:</b>", bold_style), Paragraph("<b>For Motherson Sumi Wiring India Ltd.</b>", ParagraphStyle(name="R", alignment=TA_RIGHT, fontSize=10, fontName="Helvetica-Bold"))],
        [Paragraph(terms, normal_style), ""],
        ["", ""],
        ["", ""],
        ["", Paragraph("Authorized Signatory", ParagraphStyle(name="R2", alignment=TA_RIGHT, fontSize=10, textColor=colors.darkgray))]
    ]
    sig_table = Table(sig_data, colWidths=[4.2*inch, 3*inch])
    sig_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    
    elements.append(sig_table)
    doc.build(elements)