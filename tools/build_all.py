#!/usr/bin/env python3
"""
Dựng toàn bộ nội dung cho app:
  python3 tools/build_all.py <thư-mục-chứa-file-sách-docx>

- Đọc mọi file Unit*_Part*.docx (chỉ đọc).
- Unit nào có trong tools/ready.json mới được xuất ra content/ và mở cho học sinh.
- Tạo content/catalog.json (danh mục 3 Part × 10 Unit, phiên bản nội dung, ghi chú "Có gì mới").
- Phiên bản nội dung của một Unit chỉ tăng khi nội dung thật sự thay đổi (so mã nội dung).
"""
import json, os, sys, glob, datetime
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import parse_unit as P

src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'src-books')
ready = json.load(open(os.path.join(HERE, 'ready.json'), encoding='utf-8'))
notes = json.load(open(os.path.join(HERE, 'changes.json'), encoding='utf-8'))
cat_path = os.path.join(ROOT, 'content', 'catalog.json')
old = json.load(open(cat_path, encoding='utf-8')) if os.path.exists(cat_path) else {'parts': []}
old_units = {u['id']: u for p in old.get('parts', []) for u in p['units']}
today = datetime.date.today().strftime('%Y.%m.%d')

LEVELS = {1: 'A2–B1', 2: 'B1–B2', 3: 'B2–C1'}
NAMES = {1: 'Pre-Intermediate', 2: 'Intermediate', 3: 'Upper-Intermediate'}
units = {}
report = []
for f in sorted(glob.glob(os.path.join(src, 'Unit*_*Part*.docx'))):
    P.WARN.clear()
    data, missing = P.parse(f, os.path.join(HERE, 'translations'))
    uid = data['id']
    prev = old_units.get(uid, {})
    if prev.get('hash') == data['contentHash'] and prev.get('contentVersion'):
        cv = prev['contentVersion']
    else:
        cv = today + '-' + data['contentHash'][:4]
    is_ready = uid in ready
    meta = {'id': uid, 'unit': data['unit'], 'title': data['title'], 'ready': is_ready, 'vocabCount': len(data['vocab']),
            'contentVersion': cv, 'hash': data['contentHash']}
    ch = notes.get('units', {}).get(uid, {})
    if ch.get('version') == cv: meta['changes'] = ch.get('items', [])
    units[uid] = (data['part'], meta)
    if is_ready:
        data['contentVersion'] = cv
        json.dump(data, open(os.path.join(ROOT, 'content', uid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    report.append((uid, is_ready, len(P.WARN), missing, list(P.WARN)))

parts = []
for p in (1, 2, 3):
    us = sorted([m for (pp, m) in units.values() if pp == p], key=lambda m: m['unit'])
    parts.append({'part': p, 'level': LEVELS[p], 'name': NAMES[p], 'units': us})
catalog = {'app': notes.get('app', {}).get('version', '0.1.0'), 'defaultUnit': ready[0] if ready else None, 'built': today,
           'parts': parts, 'changes': notes.get('changes', [])}
json.dump(catalog, open(cat_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for uid, r, nw, miss, ws in report:
    flag = 'MỞ ' if r else '   '
    print(f'{flag} {uid}: cảnh báo {nw}, thiếu dịch {miss}')
    if r:
        for w in ws: print('      WARN', w)
print('Đã ghi', cat_path)
