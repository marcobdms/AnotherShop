import pandas as pd
import json

df = pd.read_excel('catalogo 02-06.xlsx')
df.columns = [str(c).strip().lower() for c in df.columns]
disp_col = next((c for c in df.columns if 'disponible' in c), None)
id_col = next((c for c in df.columns if 'id' in c), None)

print("Unique values in 'disponible':", df[disp_col].unique())

with open('data/catalog.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

json_products = {p['id']: p for p in data['productos']}

mismatches = []
excel_available = []

for idx, row in df.iterrows():
    raw_id = str(row[id_col]).strip()
    if raw_id == 'nan': continue
    if raw_id.endswith('.0'): raw_id = raw_id[:-2]
    pid = raw_id.zfill(3)
    
    val = str(row[disp_col]).strip().lower()
    # The user said they changed 'no' to 'false' and 'si' to 'true'
    is_disp = False
    if val in ['true', '1', 'si', 'sí', 's']:
        is_disp = True
        
    if is_disp:
        excel_available.append(pid)
        
    if pid in json_products:
        json_disp = json_products[pid]['disponible']
        if json_disp != is_disp:
            mismatches.append(f"ID {pid} ({json_products[pid]['nombre']}): Excel='{val}' (Parsed as {is_disp}), JSON={json_disp}")

print(f"\nTotal available in Excel: {len(excel_available)}")
print("Available IDs:", excel_available)

print("\n--- Discrepancies ---")
if not mismatches:
    print("Everything matches perfectly!")
else:
    for m in mismatches:
        print(m)
