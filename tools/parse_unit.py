#!/usr/bin/env python3
"""
Trích dữ liệu 1 Unit từ file sách .docx → content/<id>.json cho app Vocabulary 12.

  python3 tools/parse_unit.py <file.docx> [--out content] [--tr tools/translations]

- Chỉ ĐỌC file sách, không sửa.
- Tự kiểm tra: đủ 40 từ + 20 cụm, mỗi câu có 4 phương án, đáp án nhanh khớp lời giải,
  lời giải có đủ A–D, số câu liên tục… Lỗi in ra màn hình (WARN).
- Bản dịch câu/cụm cho mục Đọc bài lấy từ tools/translations/<id>.json (do Claude soạn,
  chờ GV duyệt). Câu nào chưa có bản dịch sẽ để trống và được liệt kê.
"""
import json, os, re, sys, hashlib, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from docx2md import convert

WARN = []
def warn(msg): WARN.append(msg)

def strip_md(s):
    s = re.sub(r'\*\*(.+?)\*\*', r'\1', s)
    s = re.sub(r'__(.+?)__', r'\1', s)
    s = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'\1', s)
    return s.replace('**', '').strip()

def clean(s):
    s = s.replace('\u00a0', ' ')
    s = re.sub(r'\*\*\s*\*\*', '', s)          # **** do run bị cắt
    s = re.sub(r'\*\*(\s+)\*\*', r'\1', s)
    return s.rstrip()

def slug(s):
    s = unicodedata.normalize('NFKD', s.lower())
    s = re.sub(r"[^a-z0-9]+", '-', s).strip('-')
    return s

SMALL = {'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'but', 'or', 'with', 'from', 'by', 'as', 'vs', 'into', 'about'}
ACR = {'NASA', 'IT', 'AI', 'UN', 'UNESCO', 'ASEAN', 'VTV', 'USA', 'UK', 'US', 'CEO', 'STEM', 'DIY', 'TV', 'COVID-19', 'WWF', 'BBC', 'CNN', 'EU', 'VR', 'GPS', 'ID', 'II', 'III', 'IV', 'SDG', 'FAQ', 'Q&A', 'HCMC', 'VND', 'MOOC', 'MOOCS', 'CV', 'IUCN', 'CITES'}
def title_case(t):
    t = strip_md(t).replace(' - ', ' – ')
    if t != t.upper():
        return t
    out = []
    for i, w in enumerate(t.split(' ')):
        core = re.sub(r'[^A-Z0-9&\-]', '', w)
        if core in ACR or (re.fullmatch(r'[A-Z]{2,}S?', core or '') and core.rstrip('S') in ACR):
            out.append(w)
        elif w.lower() in SMALL and i > 0 and not out[-1].endswith(('–', ':')):
            out.append(w.lower())
        else:
            lw = w.lower()
            out.append(re.sub(r"[a-z]", lambda m: m.group(0).upper(), lw, count=1))
    return ' '.join(out)

# ---------------- tách khối ----------------
SEC_RE = re.compile(r'^\*\*(\d{1,2})\.\s+(.+?)\*\*\s*$')

def split_sections(lines):
    secs, cur = {}, None
    head = []
    for ln in lines:
        m = SEC_RE.match(ln)
        if m and int(m.group(1)) <= 11 and m.group(2).upper() == m.group(2)[:].upper() and len(m.group(2)) > 6:
            cur = int(m.group(1)); secs[cur] = {'title': strip_md(m.group(2)), 'lines': []}; continue
        if cur is None: head.append(ln)
        else: secs[cur]['lines'].append(ln)
    return head, secs

# ---------------- 1. từ vựng ----------------
def parse_vocab(lines, typ):
    out = []
    for ln in lines:
        m = re.match(r'^(\d+)\.\s+(.*)$', ln)
        if not m: continue
        parts = [p.strip() for p in re.split(r'\s+\|\s+', m.group(2))]
        headp = parts[0]
        hm = re.match(r'^\*\*(.+?)\*\*\s*(.*)$', headp)
        if not hm: warn(f'Từ vựng dòng không đọc được: {ln[:80]}'); continue
        word = strip_md(hm.group(1)); rest = hm.group(2).strip()
        pos = ipa = ''
        pm = re.match(r'^\(([^)]*)\)\s*(.*)$', rest)
        if pm: pos, rest = pm.group(1).strip(), pm.group(2).strip()
        if rest.startswith('/'):
            idx = -1
            for mm in re.finditer(r'(/|\))\s*:\s', rest):
                idx = mm.start(); end = mm.end(); break
            if idx < 0: warn(f'Không tách được IPA: {word}'); meaning = rest
            else: ipa = rest[:idx + 1].strip(); meaning = rest[end:].strip()
        else:
            meaning = re.sub(r'^:\s*', '', rest)
        meaning = strip_md(meaning)
        d = {'type': typ, 'word': word, 'pos': pos if typ == 'word' else (pos or 'phr'), 'ipa': ipa, 'meaning': meaning, 'colloc': '', 'ex': '', 'tr': ''}
        for p in parts[1:]:
            km = re.match(r'^\*\*([^*:]+):\s*\*\*\s*(.*)$', p) or re.match(r'^\*\*([^*]+?)\*\*\s*:?\s*(.*)$', p)
            if not km: continue
            k = km.group(1).strip().rstrip(':').lower(); v = strip_md(km.group(2))
            if k.startswith('colloc'): d['colloc'] = v
            elif k.startswith('ex'): d['ex'] = v
            elif k.startswith('dịch') or k.startswith('dich'): d['tr'] = v
        if not d['ex']: warn(f'Thiếu câu ví dụ: {word}')
        if not d['tr']: warn(f'Thiếu bản dịch câu ví dụ: {word}')
        d['cloze'] = find_cloze(word, d['ex'])
        if not d['cloze']: warn(f'Không tìm thấy “{word}” trong câu ví dụ (bài điền từ sẽ bỏ qua từ này): {d["ex"][:70]}')
        d['key'] = slug(word)
        out.append(d)
    return out

IRREG = {'grow': ['grew', 'grown'], 'bring': ['brought'], 'take': ['took', 'taken'], 'give': ['gave', 'given'], 'keep': ['kept'], 'get': ['got', 'gotten'], 'set': ['set'], 'come': ['came'], 'go': ['went', 'gone'], 'make': ['made'], 'put': ['put'], 'stand': ['stood'], 'pay': ['paid'], 'hold': ['held'], 'break': ['broke', 'broken'], 'fight': ['fought'], 'lend': ['lent'], 'rise': ['rose', 'risen'], 'run': ['ran'], 'find': ['found'], 'think': ['thought'], 'leave': ['left'], 'lead': ['led'], 'catch': ['caught'], 'speak': ['spoke', 'spoken'], 'write': ['wrote', 'written'], 'drive': ['drove', 'driven'], 'fall': ['fell', 'fallen'], 'feel': ['felt'], 'sell': ['sold'], 'buy': ['bought'], 'teach': ['taught'], 'build': ['built'], 'spend': ['spent'], 'win': ['won'], 'lose': ['lost'], 'meet': ['met'], 'send': ['sent'], 'tell': ['told'], 'show': ['shown'], 'throw': ['threw', 'thrown'], 'cut': ['cut'], 'do': ['did', 'done'], 'see': ['saw', 'seen'], 'be': ['was', 'were', 'been'], 'have': ['had'], 'live': ['lived'], 'drop': ['dropped'], 'step': ['stepped'], 'stop': ['stopped'], 'plan': ['planned'], 'cut back': ['cut back'], 'overcome': ['overcame'], 'undergo': ['underwent', 'undergone'], 'withdraw': ['withdrew', 'withdrawn'], 'seek': ['sought'], 'strike': ['struck'], 'bear': ['bore', 'borne'], 'swim': ['swam'], 'shake': ['shook', 'shaken'], 'wake': ['woke', 'woken'], 'arise': ['arose', 'arisen'], 'forbid': ['forbade', 'forbidden'], 'forgive': ['forgave', 'forgiven'], 'freeze': ['froze', 'frozen'], 'hide': ['hid', 'hidden'], 'shut': ['shut'], 'spread': ['spread'], 'upset': ['upset'], 'mislead': ['misled'], 'outgrow': ['outgrew'], 'forecast': ['forecast'], 'spring': ['sprang', 'sprung'], 'wear': ['wore', 'worn'], 'overtake': ['overtook', 'overtaken'], 'lay': ['laid'], 'backslide': ['backslid'], 'blow': ['blew', 'blown'], 'hang': ['hung'], 'enrol': ['enrolled', 'enrols', 'enrolling'], 'level': ['levelled', 'leveled', 'levelling'], 'snow': ['snowed'], 'cut': ['cut'], 'shut': ['shut'], 'light': ['lit'], 'sink': ['sank', 'sunk'], 'swear': ['swore', 'sworn'], 'tear': ['tore', 'torn'], 'stick': ['stuck'], 'dig': ['dug'], 'feed': ['fed'], 'flee': ['fled'], 'grind': ['grinder'], 'bend': ['bent'], 'hit': ['hit'], 'quit': ['quit'], 'rid': ['rid'], 'split': ['split'], 'bet': ['bet'], 'cost': ['cost'], 'let': ['let'], 'hurt': ['hurt'], 'mean': ['meant'], 'deal': ['dealt'], 'burn': ['burnt'], 'learn': ['learnt'], 'dream': ['dreamt'], 'lie': ['lay', 'lain', 'lying'], 'die': ['dying'], 'tie': ['tying']}
def forms(w):
    w = w.lower(); f = {w, w + 's', w + 'es', w + 'ed', w + 'd', w + 'ing', w + 'er', w + 'ly'}
    if len(w) > 3 and w.endswith('s') and not w.endswith('ss'): f.add(w[:-1])
    if w.endswith('ies'): f.add(w[:-3] + 'y')
    if w.endswith('y'): f |= {w[:-1] + 'ies', w[:-1] + 'ied', w[:-1] + 'ily'}
    if w.endswith('e'): f |= {w[:-1] + 'ing', w[:-1] + 'ed'}
    if re.search(r'[^aeiou][aeiou][bdgmnprt]$', w): f |= {w + w[-1] + 'ed', w + w[-1] + 'ing'}
    f |= set(IRREG.get(w, []))
    return f

POSS = ['my', 'your', 'his', 'her', 'its', 'our', 'their', "one's", 'the', 'a', 'an']
REFL = ['myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves', 'themselves', 'oneself']
BE = r"(?:(?:am|is|are|was|were|be|been|being|'m|'re|'s|’m|’re|’s)\s+)?"
def tok_pat(t):
    tl = t.lower()
    if tl in ('sb', 'sth', 'somebody', 'something', '...', '…'): return r"(?:[a-z0-9'’-]+\s+){0,3}?[a-z0-9'’-]+"
    if tl == "sb's": return r"(?:my|your|his|her|its|our|their|[a-z]+'s)"
    if tl in ("one's", 'your', 'his', 'her', 'their', 'my', 'our'): return '(?:' + '|'.join(re.escape(p) for p in POSS if p not in ('the', 'a', 'an')) + ')'
    if tl in REFL: return '(?:' + '|'.join(REFL) + ')'
    return '(?:' + '|'.join(re.escape(x) for x in sorted(forms(tl), key=len, reverse=True)) + ')'

def find_cloze(word, ex):
    if not ex: return ''
    low = ex.lower().replace('’', "'")
    cands = [re.sub(r"\(.*?\)", '', word).strip()]
    paren = re.findall(r"\((.*?)\)", word)
    cands += [p for p in paren if p and len(p) > 1]
    more = []
    for cw in cands:
        tt = cw.split()
        if len(tt) > 2 and tt[-1].lower() in ('to', 'for', 'with', 'on', 'in', 'of', 'at', 'from', 'about'): more.append(' '.join(tt[:-1]))
    for cw in cands + more:
        toks = [t for t in re.split(r'\s+', cw) if t and not t.startswith('+')]
        while toks and toks[-1].lower() in ('sb', 'sth', 'somebody', 'something', '...', '…'): toks = toks[:-1]
        while toks and toks[0].lower() in ('sb', 'sth', 'somebody', 'something'): toks = toks[1:]
        if not toks: continue
        lead_be = toks[0].lower() == 'be' and len(toks) > 1
        if lead_be: toks = toks[1:]
        pat = r"(?<![a-z])" + (BE if lead_be else '') + tok_pat(toks[0])
        for t in toks[1:]:
            pat += r"(?:\s+[a-z0-9'-]+){0,2}?\s+" + tok_pat(t) if t.lower() not in ('sb', 'sth', 'somebody', 'something') else r"\s+" + tok_pat(t)
        pat += r"(?![a-z])"
        try: m = re.search(pat, low)
        except re.error: m = None
        if m and any(t.lower() in ('sb', 'sth', 'somebody', 'something') for t in toks):
            m2 = re.search(r"(?<![a-z])" + tok_pat(toks[0]) + r"(?![a-z])", low[m.start():])
            if m2: return ex[m.start() + m2.start():m.start() + m2.end()]
        if m:
            st = m.start()
            if lead_be:  # không gồm trợ động từ be vào phần cần điền
                mm = re.match(BE, low[st:m.end()])
                if mm: st += len(mm.group(0))
            return ex[st:m.end()]
    return ''

# ---------------- bảng ----------------
def table_rows(lines):
    rows = []
    for ln in lines:
        if ln.startswith('|') and ln.endswith('|'):
            rows.append([strip_md(c).strip() for c in ln.strip('|').split('|')])
    return rows

# ---------------- câu hỏi trắc nghiệm ----------------
Q_RE = re.compile(r'^\*\*Question\s+(\d+)\.\*\*\s*(.*)$')
OPT_SPLIT = re.compile(r'\*\*([A-D])\.\*\*')

def parse_opts(text):
    parts = OPT_SPLIT.split(text)
    opts = {}
    for i in range(1, len(parts) - 1, 2):
        opts[parts[i]] = parts[i + 1].strip().strip('\t').strip()
    return [opts.get(k, '') for k in 'ABCD']

def parse_questions(lines):
    """Trả về (danh sách câu hỏi, các dòng không thuộc câu hỏi nằm trước câu hỏi đầu tiên)."""
    qs, pre, cur = [], [], None
    for ln in lines:
        m = Q_RE.match(ln)
        if m:
            if cur: qs.append(cur)
            cur = {'n': int(m.group(1)), 'stem': m.group(2).strip(), 'extra': [], 'optlines': []}
            continue
        if cur is None: pre.append(ln); continue
        if OPT_SPLIT.search(ln) and re.match(r'^\s*\*\*[A-D]\.\*\*', ln.strip()):
            cur['optlines'].append(ln)
        elif cur['optlines']:
            cur.setdefault('after', []).append(ln)
        else:
            cur['extra'].append(ln)
    if cur: qs.append(cur)
    for q in qs:
        q['opts'] = parse_opts('\t'.join(q.pop('optlines')))
    return qs, pre

# ---------------- đoạn văn ----------------
def is_title(ln):
    s = strip_md(ln)
    return ln.startswith('**') and ln.endswith('**') and s.upper() == s and re.search(r'[A-Z]', s) and not s.startswith('QUESTION') and not s.startswith('READ') and len(s) > 3

def passage_md(ln):
    ln = ln.strip()
    ln = re.sub(r'^•\s*', '• ', ln)
    return ln

# ---------------- lời giải ----------------
def parse_answers(lines):
    subs, cur = [], None
    for ln in lines:
        m = re.match(r'^\*\*([A-F])\.\s+(.+?)\*\*\s*$', ln)
        if m and ('Câu' in m.group(2) or 'Quiz' in m.group(2) or 'Reading' in m.group(2)):
            cur = {'title': m.group(2), 'quick': {}, 'items': {}, 'order': []}; subs.append(cur); qcur = None; continue
        if cur is None: continue
        if 'Đáp án nhanh' in ln or re.match(r'^\s*1\.[A-D]\s*·', strip_md(ln)):
            for n, a in re.findall(r'(\d+)\.([A-D])', strip_md(ln)): cur['quick'][int(n)] = a
            continue
        cm = re.match(r'^\*\*Câu\s+(\d+)\.\s*Đáp án:\s*([A-D])\*\*', ln)
        if cm:
            qcur = {'n': int(cm.group(1)), 'ans': cm.group(2), 'lines': []}; cur['items'][qcur['n']] = qcur; cur['order'].append(qcur['n']); continue
        if qcur is not None and ln.strip():
            if ln.startswith('Unit ') and '|' in ln and 'Trang' in ln: continue
            t = ln.strip()
            t = re.sub(r'^\*\*([A-D])\.\s*\*\*\s*', r'\1. ', t)
            t = re.sub(r'^\*\*([^*]{2,30}?):\s*\*\*\s*', r'\1: ', t)
            qcur['lines'].append(t)
    return subs

def lines_get(lines, label):
    for l in lines:
        if l.startswith(label + ':'): return l[len(label) + 1:].strip()
    return ''

def group_from(kien, kind):
    k = strip_md(kien).lower()
    if kind == 'r3': return 'Sắp xếp câu / đoạn'
    if kind == 'r4': return 'Điền cụm / mệnh đề'
    if kind == 'read':
        rules = [('KHÔNG', 'thông tin KHÔNG được nhắc'), ('ĐÚNG', 'thông tin ĐÚNG/SAI'), ('SAI', 'thông tin ĐÚNG/SAI'), ('đồng nghĩa', 'từ đồng nghĩa'), ('trái nghĩa', 'từ trái nghĩa'), ('quy chiếu', 'quy chiếu'), ('diễn đạt lại', 'diễn đạt lại câu'), ('điền câu', 'điền câu vào vị trí'), ('vị trí', 'điền câu vào vị trí'), ('tiêu đề', 'chọn tiêu đề'), ('ý chính', 'ý chính'), ('đoạn chứa', 'tìm đoạn chứa thông tin'), ('suy luận', 'suy luận'), ('mục đích', 'mục đích / thái độ'), ('thái độ', 'mục đích / thái độ'), ('chi tiết', 'thông tin chi tiết')]
        raw = strip_md(kien)
        for key, name in rules:
            if key in raw or key in raw.lower(): return 'Đọc hiểu: ' + name
        return 'Đọc hiểu: ' + raw.rstrip('.')
    rules = [('phrasal verb', 'Phrasal verb'), ('collocation', 'Collocation & thành ngữ'), ('thành ngữ', 'Collocation & thành ngữ'), ('từ loại', 'Từ loại'),
             ('đại từ quan hệ', 'Mệnh đề quan hệ'), ('mệnh đề quan hệ', 'Mệnh đề quan hệ'), ('giới từ', 'Giới từ'),
             ('bị động', 'Thì & dạng động từ'), ('song song', 'Thì & dạng động từ'), ('thì ', 'Thì & dạng động từ'), ('to v', 'Thì & dạng động từ'), ('v-ing', 'Thì & dạng động từ'),
             ('đảo ngữ', 'Cấu trúc câu'), ('cấu trúc', 'Cấu trúc câu'), ('liên từ', 'Cấu trúc câu'), ('so sánh', 'Cấu trúc câu'), ('điều kiện', 'Cấu trúc câu'),
             ('từ vựng', 'Từ vựng'), ('nghĩa', 'Từ vựng')]
    for key, name in rules:
        if key in k: return name
    return 'Ngữ pháp khác'

# ---------------- tách câu ----------------
ABBR = ['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'St.', 'Prof.', 'a.m.', 'p.m.', 'e.g.', 'i.e.', 'U.S.', 'U.K.', 'etc.', 'No.', 'vs.', 'Jr.', 'Sr.', 'Mt.', 'approx.']
def split_sentences(text):
    t = text
    for i, a in enumerate(ABBR): t = t.replace(a, a.replace('.', f'§{i}§'))
    out = [m.group(0).strip() for m in re.finditer(r'.+?(?:[.!?]+["”’)]?(?=\s+["“‘(]?[A-Z0-9])|$)', t)]
    res = []
    for s in out:
        if not s: continue
        for i, a in enumerate(ABBR): s = s.replace(a.replace('.', f'§{i}§'), a)
        res.append(s)
    return res

# ---------------- bản dịch dạng chữ (dễ đọc, dễ duyệt) ----------------
def read_tr_txt(path):
    """Mỗi câu một khối, cách nhau bằng dòng trống:
         Câu tiếng Anh
         = Bản dịch cả câu
           cụm tiếng Anh || nghĩa cụm      (thụt 2 dấu cách, có thể bỏ trống)
       Dòng bắt đầu bằng # là ghi chú. Dòng “@by gv” trong khối = giáo viên đã duyệt."""
    out = {}
    blocks = re.split(r'\n\s*\n', open(path, encoding='utf-8').read())
    for b in blocks:
        ls = [l.rstrip() for l in b.split('\n') if l.strip() and not l.lstrip().startswith('#')]
        if not ls: continue
        en = ls[0].strip(); vi = ''; chunks = []; by = 'claude'
        for l in ls[1:]:
            if l.startswith('= '): vi = l[2:].strip()
            elif l.strip().startswith('@by'): by = l.strip()[3:].strip() or 'gv'
            elif '||' in l:
                a, c = l.split('||', 1); chunks.append([a.strip(), c.strip()])
        if not chunks: chunks = [[en, vi]]
        out[en] = {'vi': vi, 'chunks': chunks, 'by': by}
    return out

# ---------------- chính ----------------
def parse(path, tr_dir=None):
    md = convert(path)
    lines = [clean(l) for l in md.split('\n')]
    lines = [l for l in lines if l.strip()]
    head, secs = split_sections(lines)
    hm = re.match(r'^\*\*UNIT\s+(\d+)\s*:\s*(.+?)\s*-\s*PART\s+(\d)\s*\((.+?)\)\*\*', head[0] if head else '')
    if not hm: raise SystemExit('Không đọc được dòng tiêu đề Unit: ' + (head[0] if head else ''))
    unit, title, part, level = int(hm.group(1)), title_case(hm.group(2)), int(hm.group(3)), hm.group(4).replace('-', '–')
    uid = f'p{part}-u{unit:02d}'
    lvl_desc = ''
    for l in head[1:]:
        if 'Cấp độ' in l: lvl_desc = strip_md(l.split(':', 1)[1]) if ':' in l else ''

    need = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    for n in need:
        if n not in secs: warn(f'Thiếu mục {n} trong file')

    vocab = parse_vocab(secs.get(1, {'lines': []})['lines'], 'word') + parse_vocab(secs.get(2, {'lines': []})['lines'], 'phrase')
    nw = sum(1 for v in vocab if v['type'] == 'word'); npv = len(vocab) - nw
    if nw != 40: warn(f'Vocabulary Bank có {nw} từ (mong đợi 40)')
    if npv != 20: warn(f'Phrasal verbs có {npv} mục (mong đợi 20)')
    keys = [v['key'] for v in vocab]
    for k in set(keys):
        if keys.count(k) > 1:
            warn(f'Từ bị lặp: {k}')
            c = 0
            for v in vocab:
                if v['key'] == k:
                    c += 1
                    if c > 1: v['key'] = f'{k}-{c}'

    # đồng nghĩa / trái nghĩa
    synrows = table_rows(secs.get(3, {'lines': []})['lines'])[1:]
    synonyms = []
    for r in synrows:
        if len(r) < 3: continue
        w = re.sub(r'\s*\(.*?\)\s*$', '', r[0]).strip()
        syn = [x.strip() for x in r[1].split(',') if x.strip()]; ant = [x.strip() for x in r[2].split(',') if x.strip()]
        synonyms.append({'word': r[0], 'syn': syn, 'ant': ant})
        hit = next((v for v in vocab if v['word'].lower() == w.lower()), None)
        if hit: hit['syn'], hit['ant'] = syn, ant
    patterns = [{'p': r[1], 'm': r[2], 'ex': r[3]} for r in table_rows(secs.get(4, {'lines': []})['lines'])[1:] if len(r) >= 4]
    lad = table_rows(secs.get(5, {'lines': []})['lines'])
    ladder = {'head': lad[0], 'rows': lad[1:]} if lad else None

    # ----- đáp án & lời giải -----
    subs = parse_answers(secs.get(11, {'lines': []})['lines'])
    if len(subs) != 6: warn(f'Phần đáp án có {len(subs)} nhóm (mong đợi 6: Quiz, R1-2, R3, R4, R5, R6)')
    ans_by_n = {}
    for si, sb in enumerate(subs):
        for n, it in sb['items'].items():
            ans_by_n[(si, n)] = it
        for n, a in sb['quick'].items():
            it = sb['items'].get(n)
            if not it: warn(f'{sb["title"]}: câu {n} có trong đáp án nhanh nhưng thiếu lời giải')
            elif it['ans'] != a: warn(f'{sb["title"]}: câu {n} đáp án nhanh {a} ≠ lời giải {it["ans"]}')

    def attach(qs, si, kind, setname):
        sb = subs[si] if si < len(subs) else {'items': {}, 'quick': {}, 'title': setname}
        out = []
        for q in qs:
            it = sb['items'].get(q['n'])
            if not it: warn(f'{setname}: câu {q["n"]} không có lời giải'); continue
            ans = 'ABCD'.index(it['ans'])
            if any(not o for o in q['opts']): warn(f'{setname}: câu {q["n"]} thiếu phương án: {q["opts"]}')
            if len(set(q['opts'])) < 4: warn(f'{setname}: câu {q["n"]} có phương án trùng nhau: {q["opts"]}')
            if re.search(r'\s\d{1,2}\s*$', strip_md(q.get('stem', ''))): warn(f'{setname}: câu {q["n"]} đề bài có số lạ ở cuối: “{q["stem"][-30:]}”')
            # lời giải phải có đủ A–D và khớp phương án
            optl = {l[0]: l[3:] for l in it['lines'] if re.match(r'^[A-D]\.\s', l)}
            if len(optl) < 4: warn(f'{setname}: câu {q["n"]} lời giải thiếu phân tích phương án ({"".join(sorted(optl))})')
            for k, txt in optl.items():
                o = strip_md(q['opts']['ABCD'.index(k)]).rstrip('.?!')
                t0 = strip_md(txt).split(':')[0]
                if '...' in t0 or '…' in t0 or '+' in t0:
                    pre = re.split(r'\.\.\.|…|\+', t0)[0].strip().lower()
                    if pre and not o.lower().startswith(pre[:20]): warn(f'{setname}: câu {q["n"]} phương án {k} trong lời giải không khớp đề: “{o[:40]}” / “{t0[:40]}”')
                    continue
                if o and t0.strip() and o.lower().startswith(t0.strip().lower()): continue
                if o and not strip_md(txt).lower().startswith(o.lower()[:min(len(o), 25)]):
                    warn(f'{setname}: câu {q["n"]} phương án {k} trong lời giải không khớp đề: “{o[:40]}” / “{strip_md(txt)[:40]}”')
            kien = lines_get(it['lines'], 'Kiến thức') or lines_get(it['lines'], 'Dạng câu hỏi')
            d = {'n': q['n'], 'stem': q.get('stem', ''), 'opts': q['opts'], 'ans': ans, 'lines': it['lines'], 'kind': strip_md(kien).rstrip('.'), 'group': group_from(kien, kind)}
            for k in ('p', 'items', 'head', 'tail', 'quote'):
                if q.get(k) is not None: d[k] = q[k]
            out.append(d)
        nums = [q['n'] for q in out]
        if nums and nums != list(range(nums[0], nums[0] + len(nums))): warn(f'{setname}: số câu không liên tục {nums}')
        return out

    sets = []
    # Quiz
    qz, _ = parse_questions(secs.get(6, {'lines': []})['lines'])
    if len(qz) != 20: warn(f'Reflex Quiz có {len(qz)} câu (mong đợi 20)')
    sets.append({'id': 'quiz', 'name': 'Reflex Practice Quiz', 'short': 'Reflex Quiz', 'type': 'mc', 'min': 15, 'qs': attach(qz, 0, 'quiz', 'Reflex Quiz')})

    # Reading 1–2: nhiều đoạn văn có chỗ trống
    def parse_cloze_section(ls, si, setid, name, short, minutes, kind):
        passages, qs_all = [], []
        cur_p = None; instr = ''
        i = 0
        blocks = []  # chuỗi: instr/title/para/question lines
        qs, _ = [], []
        # tách theo câu hỏi nhưng vẫn giữ đoạn văn đứng giữa các câu hỏi
        buf = []
        allq = []
        curq = None
        for ln in ls:
            if Q_RE.match(ln):
                if curq: allq.append(curq)
                m = Q_RE.match(ln); curq = {'n': int(m.group(1)), 'stem': m.group(2).strip(), 'extra': [], 'optlines': [], 'p': len(passages) - 1}
                continue
            if curq and re.match(r'^\s*\*\*[A-D]\.\*\*', ln):
                curq['optlines'].append(ln); continue
            if ln.startswith('**Read the following') or ln.startswith('Read the following') or ln.startswith('Mark the letter') or ln.startswith('**Mark the letter'):
                if curq: allq.append(curq); curq = None
                instr = strip_md(ln); continue
            if ln.startswith('*Nguồn') or ln.startswith('*(Bản dịch'):
                if curq: allq.append(curq); curq = None
                if passages:
                    if ln.startswith('*Nguồn'): passages[-1]['src'] = strip_md(ln)
                    else: passages[-1]['note'] = strip_md(ln)
                continue
            if is_title(ln) and not curq:
                passages.append({'title': title_case(ln), 'paras': [], 'instr': instr}); continue
            if curq and curq['optlines']:
                # dòng lạ sau phương án → coi như hết câu
                allq.append(curq); curq = None
            if curq is None and passages:
                passages[-1]['paras'].append(passage_md(ln))
            elif curq is not None:
                curq['extra'].append(ln)
        if curq: allq.append(curq)
        for q in allq: q['opts'] = parse_opts('\t'.join(q.pop('optlines')))
        return passages, allq

    p12, q12 = parse_cloze_section(secs.get(7, {'lines': []})['lines'], 1, 'r12', '', '', 0, 'cloze')
    sb = subs[1] if len(subs) > 1 else {'items': {}}
    for q in q12:
        it = sb['items'].get(q['n'])
        ctx = lines_get(it['lines'], 'Ngữ cảnh') if it else ''
        q['stem'] = ctx or f'Chỗ trống ({q["n"]})'
    if len(q12) != 12: warn(f'Reading 1–2 có {len(q12)} câu (mong đợi 12)')
    if len(p12) != 2: warn(f'Reading 1–2 có {len(p12)} đoạn văn (mong đợi 2)')
    sets.append({'id': 'r12', 'name': 'Reading 1 & 2', 'short': 'Reading 1–2', 'type': 'cloze', 'min': 12, 'intro': 'Đọc quảng cáo / tờ rơi và chọn phương án điền vào mỗi chỗ trống.', 'passages': [{k: v for k, v in p.items() if k != 'instr'} for p in p12], 'qs': attach(q12, 1, 'cloze', 'Reading 1–2')})

    # Reading 3: sắp xếp
    ls3 = secs.get(8, {'lines': []})['lines']
    q3, pre3 = parse_questions(ls3)
    src3 = ''
    for q in q3:
        items, head_l, tail_l = [], [], []
        for l in q['extra']:
            m = re.match(r'^([a-e])\.\s+(.*)$', l.strip())
            if m: items.append([m.group(1), m.group(2).strip()])
            elif items: tail_l.append(l.strip())
            else: head_l.append(l.strip())
        for l in q.get('after', []):
            if l.startswith('*Nguồn'): src3 = strip_md(l)
        head = ' '.join([q['stem']] + head_l).strip()
        tail_l = [t for t in tail_l if not t.startswith('*Nguồn')]
        q['items'] = items
        if head: q['head'] = head
        if tail_l: q['tail'] = ' '.join(tail_l)
        q['stem'] = 'Chọn cách sắp xếp hợp lý nhất cho các câu sau.'
        if len(items) not in (3, 4, 5): warn(f'Reading 3: câu {q["n"]} có {len(items)} câu cần sắp xếp (mong đợi 3 hoặc 5)')
    for l in ls3:
        if l.startswith('*Nguồn'): src3 = strip_md(l)
    if len(q3) != 5: warn(f'Reading 3 có {len(q3)} câu (mong đợi 5)')
    sets.append({'id': 'r3', 'name': 'Reading 3 (sắp xếp câu)', 'short': 'Reading 3', 'type': 'order', 'min': 8, 'intro': 'Chọn cách sắp xếp câu / lượt lời hợp lý nhất để tạo thành đoạn văn, hội thoại hoặc lá thư mạch lạc.' + (f' {src3}' if src3 else ''), 'qs': attach(q3, 2, 'r3', 'Reading 3')})

    # Reading 4
    p4, q4 = parse_cloze_section(secs.get(9, {'lines': []})['lines'], 3, 'r4', '', '', 0, 'cloze')
    sb = subs[3] if len(subs) > 3 else {'items': {}}
    for q in q4:
        it = sb['items'].get(q['n'])
        q['stem'] = (lines_get(it['lines'], 'Ngữ cảnh') if it else '') or f'Chỗ trống ({q["n"]})'
        q['p'] = 0
    if len(q4) != 5: warn(f'Reading 4 có {len(q4)} câu (mong đợi 5)')
    sets.append({'id': 'r4', 'name': 'Reading 4 (điền cụm / mệnh đề)', 'short': 'Reading 4', 'type': 'cloze', 'min': 8, 'intro': 'Đọc đoạn văn và chọn cụm từ / mệnh đề phù hợp nhất cho mỗi chỗ trống.', 'passages': [{k: v for k, v in p.items() if k != 'instr'} for p in p4], 'qs': attach(q4, 3, 'r4', 'Reading 4')})

    # Reading 5 & 6
    ls56 = secs.get(10, {'lines': []})['lines']
    chunks, cur = [], None
    for l in ls56:
        if re.match(r'^READING\s+[56]\b', strip_md(l).upper()) and 'QUESTIONS' in strip_md(l).upper():
            cur = []; chunks.append(cur); continue
        if 'THE END' in l: break
        if cur is not None: cur.append(l)
    if len(chunks) != 2: warn(f'Reading 5–6: tìm thấy {len(chunks)} bài (mong đợi 2)')
    for ci, ch in enumerate(chunks[:2]):
        rid = 'r5' if ci == 0 else 'r6'
        pre = [l for l in ch if not Q_RE.match(l)]
        idx_q = next((i for i, l in enumerate(ch) if Q_RE.match(l)), len(ch))
        body = ch[:idx_q]
        P = {'title': '', 'paras': [], 'src': '', 'note': ''}
        for l in body:
            if l.startswith('Read the following') or l.startswith('**Read the following'): continue
            if is_title(l) and not P['title']: P['title'] = title_case(l); continue
            if l.startswith('*Nguồn'): P['src'] = strip_md(l); continue
            if l.startswith('*(Bản dịch'): P['note'] = strip_md(l); continue
            P['paras'].append(passage_md(l))
        qs, _ = parse_questions(ch[idx_q:])
        for q in qs:
            q['p'] = 0
            ex = [e for e in q['extra'] if e.strip()]
            if ex: q['quote'] = strip_md(' '.join(ex)).strip('"“”')
        exp = 8 if ci == 0 else 10
        if len(qs) != exp: warn(f'Reading {5 + ci} có {len(qs)} câu (mong đợi {exp})')
        if len(P['paras']) < 3: warn(f'Reading {5 + ci}: bài đọc chỉ có {len(P["paras"])} đoạn')
        sets.append({'id': rid, 'name': f'Reading {5 + ci}', 'short': f'Reading {5 + ci}', 'type': 'reading', 'min': 12 if ci == 0 else 15, 'intro': '', 'passages': [P], 'qs': attach(qs, 4 + ci, 'read', f'Reading {5 + ci}')})

    # ----- bài đọc cho mục Đọc bài (điền đáp án đúng, bỏ ký hiệu) -----
    setmap = {s['id']: s for s in sets}
    def fill_blanks(text, qs):
        def rep(m):
            n = int(m.group(1)); q = next((x for x in qs if x['n'] == n), None)
            return strip_md(q['opts'][q['ans']]) if q else m.group(0)
        return re.sub(r'\((\d+)\)\s?_{2,}', rep, text)
    texts = []
    def add_text(tid, label, P, qs, setid, insert=None, srcnote=''):
        paras = []
        for raw in P['paras']:
            t = fill_blanks(raw, qs) if qs else raw
            t = re.sub(r'\s*\*?\*?\[(?:I{1,3}|IV|V|VI)\]\*?\*?\s*', lambda m: ' §INS§ ' if insert else ' ', t)
            if insert:
                t = t.replace(' §INS§ ', ' ' + insert['text'] + ' ', 1) if insert['mark_here'](raw) else t.replace(' §INS§ ', ' ')
            t = strip_md(t).replace('• ', '').strip()
            t = re.sub(r'\s{2,}', ' ', t)
            if t: paras.append([{'en': s} for s in split_sentences(t)])
        texts.append({'id': tid, 'label': label, 'title': P['title'], 'src': (P.get('src') or 'Bài trong sách Tài liệu Reading – Vocabulary 12') + srcnote, 'set': setid, 'paras': paras})
    for i, P in enumerate(setmap['r12']['passages']):
        add_text('r' + str(i + 1), f'Reading {i + 1}', P, setmap['r12']['qs'], 'r12', srcnote=' (đã điền đáp án đúng)')
    if setmap['r4'].get('passages'): add_text('r4', 'Reading 4', setmap['r4']['passages'][0], setmap['r4']['qs'], 'r4', srcnote=' (đã điền đáp án đúng)')
    if 'r5' in setmap: add_text('r5', 'Reading 5', setmap['r5']['passages'][0], None, 'r5')
    if 'r6' in setmap:
        r6 = setmap['r6']; ins = None
        qplace = next((q for q in r6['qs'] if q.get('quote') and re.fullmatch(r'\[(I{1,3}|IV)\]', strip_md(q['opts'][q['ans']]))), None)
        if qplace:
            mark = strip_md(qplace['opts'][qplace['ans']])
            ins = {'text': qplace['quote'], 'mark_here': lambda raw, mk=mark: mk in strip_md(raw)}
            # chỉ đoạn chứa đúng ký hiệu đáp án mới chèn
            def mk_here(raw, mk=mark):
                return ('[' + mk.strip('[]') + ']') in strip_md(raw)
            ins['mark_here'] = mk_here
        else:
            warn('Reading 6: không tìm thấy câu chèn câu [I]–[IV]')
        add_text('r6', 'Reading 6', r6['passages'][0], None, 'r6', insert=ins, srcnote=f' (đã chèn câu ở vị trí theo đáp án câu {qplace["n"]})' if qplace else '')

    # bản dịch (Claude soạn, GV duyệt)
    missing = 0
    trf = os.path.join(tr_dir, uid + '.json') if tr_dir else None
    TR = {}
    if trf and os.path.exists(trf):
        TR = json.load(open(trf, encoding='utf-8'))
    txt = os.path.join(tr_dir, uid + '.txt') if tr_dir else None
    if txt and os.path.exists(txt):
        for k, v in read_tr_txt(txt).items():
            if k not in TR: TR[k] = v
    for T in texts:
        for p in T['paras']:
            for s in p:
                t = TR.get(s['en'])
                if t:
                    s['vi'] = t.get('vi', ''); s['chunks'] = t.get('chunks', []); s['by'] = t.get('by', 'claude')
                    if s['chunks'] and re.sub(r'\s+', ' ', ' '.join(c[0] for c in s['chunks'])).strip() != s['en']:
                        warn(f'Bản dịch: các cụm không ghép lại đúng câu gốc: {s["en"][:60]}')
                else:
                    missing += 1
    gloss = {}
    for v in vocab:
        if v['type'] == 'word' and ' ' not in v['word']:
            gloss[v['word'].lower()] = v['meaning'].split(';')[0].strip()

    data = {
        'id': uid, 'part': part, 'unit': unit, 'title': title, 'level': level, 'levelDesc': lvl_desc,
        'source': os.path.basename(path),
        'vocab': vocab, 'synonyms': synonyms, 'patterns': patterns, 'ladder': ladder,
        'sets': sets, 'texts': texts, 'gloss': gloss,
    }
    blob = json.dumps({k: data[k] for k in ('vocab', 'sets', 'texts')}, ensure_ascii=False, sort_keys=True)
    data['contentHash'] = hashlib.sha1(blob.encode('utf-8')).hexdigest()[:10]
    return data, missing

def main():
    args = sys.argv[1:]
    out_dir = 'content'; tr_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'translations')
    if '--out' in args: i = args.index('--out'); out_dir = args[i + 1]; del args[i:i + 2]
    if '--tr' in args: i = args.index('--tr'); tr_dir = args[i + 1]; del args[i:i + 2]
    for path in args:
        WARN.clear()
        data, missing = parse(path, tr_dir)
        os.makedirs(out_dir, exist_ok=True)
        fn = os.path.join(out_dir, data['id'] + '.json')
        json.dump(data, open(fn, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        nq = sum(len(s['qs']) for s in data['sets'])
        nsent = sum(len(p) for t in data['texts'] for p in t['paras'])
        print(f"{os.path.basename(path)} → {fn}: {len(data['vocab'])} mục từ, {nq} câu hỏi, {len(data['texts'])} bài đọc ({nsent} câu, thiếu dịch {missing}), mã nội dung {data['contentHash']}")
        for w in WARN: print('   WARN', w)

if __name__ == '__main__':
    main()
