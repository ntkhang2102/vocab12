"""Chuyển file sách .docx thành văn bản có đánh dấu: **đậm**, *nghiêng*, __gạch chân__.
Chỉ đọc file, không sửa file gốc."""
import sys, docx
from docx.oxml.ns import qn

def run_fmt(r):
    b = bool(r.bold); i = bool(r.italic); u = bool(r.underline)
    return (b, i, u)

def para_md(p):
    # gộp các run liền nhau cùng định dạng
    segs = []
    for r in p.runs:
        t = r.text
        if not t: continue
        f = run_fmt(r)
        if segs and segs[-1][1] == f: segs[-1][0] += t
        else: segs.append([t, f])
    out = []
    for t, (b, i, u) in segs:
        if not t.strip():
            out.append(t); continue
        lead = t[:len(t) - len(t.lstrip())]; trail = t[len(t.rstrip()):]; core = t.strip()
        if u: core = '__' + core + '__'
        if i: core = '*' + core + '*'
        if b: core = '**' + core + '**'
        out.append(lead + core + trail)
    s = ''.join(out)
    return s

def iter_block_items(doc):
    body = doc.element.body
    for child in body.iterchildren():
        if child.tag == qn('w:p'):
            yield docx.text.paragraph.Paragraph(child, doc)
        elif child.tag == qn('w:tbl'):
            yield docx.table.Table(child, doc)

def convert(path):
    d = docx.Document(path)
    lines = []
    for b in iter_block_items(d):
        if isinstance(b, docx.table.Table):
            for row in b.rows:
                cells = []
                for c in row.cells:
                    cells.append(' '.join(para_md(p) for p in c.paragraphs).strip())
                lines.append('|' + '|'.join(cells) + '|')
        else:
            lines.append(para_md(b))
    return '\n'.join(lines)

if __name__ == '__main__':
    print(convert(sys.argv[1]))
