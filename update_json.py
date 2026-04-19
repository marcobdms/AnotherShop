import json

JSON_PATHS = [
    r'c:\Users\Marco\Desktop\proyectos\anothershop\data\catalog.json',
    r'c:\Users\Marco\Desktop\proyectos\anothershop\backend\data\catalog.json'
]

for p in JSON_PATHS:
    with open(p, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Remove XXL from filtros.tallas
    if 'XXL' in data['filtros']['tallas']:
        data['filtros']['tallas'].remove('XXL')

    # Add XS to productos that have S,M,L
    for prod in data['productos']:
        if 'S' in prod['tallas'] and 'M' in prod['tallas'] and 'L' in prod['tallas'] and 'XS' not in prod['tallas']:
            prod['tallas'] = ['XS'] + prod['tallas']

    with open(p, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

print("Catalogs updated.")
