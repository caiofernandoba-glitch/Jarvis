#!/usr/bin/env python3
"""Audit taco-data.json against the official 2011 TACO PDF's Table 1.

It checks JSON/schema/ranges, exactly 597 sequential IDs, no raw 1e-05 sentinel,
and every record's official Table 1 line. For non-null selected values, the
published kcal/protein/lipid/carbohydrate/fibre values are checked in their
printed order after the exact official descriptor. Null is used only as an
explicit non-numeric policy and is separately counted, not converted to zero.
"""
from __future__ import annotations
import argparse, hashlib, json, re, unicodedata
from pathlib import Path
from pypdf import PdfReader


def compact_number(n):
    s = str(n)
    if s.endswith('.0'): s = s[:-2]
    # PDF extraction can insert spaces between digits (e.g. 5 13 for 513).
    return r'\s*'.join(map(re.escape, s.replace('.', ',')))


def normal_text(s):
    """Compare PDF-extracted labels despite harmless accents/space splits."""
    s = unicodedata.normalize('NFD', s)
    return ''.join(c.lower() for c in s if unicodedata.category(c) != 'Mn' and c.isalnum())


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--dataset', default='src/taco-data.json')
    p.add_argument('--pdf', required=True)
    p.add_argument('--report', required=True)
    args = p.parse_args()
    data = json.loads(Path(args.dataset).read_text(encoding='utf-8'))
    pdf_bytes = Path(args.pdf).read_bytes()
    reader = PdfReader(args.pdf)
    text = '\n'.join(page.extract_text() or '' for page in reader.pages)

    marker = 'Tabela 1. Composição de alimentos por 100 gramas de parte comestível: Centesimal'
    start = text.index(marker)
    end = text.index('Tabela 2:', start + 1)
    rows = {}
    for line in text[start:end].splitlines():
        found = re.match(r'^\s*(\d{1,3})\s+(.+)$', line)
        if found:
            # Table 1 repeats the IDs for other nutrient columns later; retain
            # the first centesimal-line occurrence only.
            rows.setdefault(int(found.group(1)), found.group(2))

    foods = data.get('foods', [])
    errors = []
    if data.get('food_count') != 597 or len(foods) != 597:
        errors.append('food_count/foods length is not 597')
    if len(reader.pages) != 164:
        errors.append(f'PDF page count expected 164, got {len(reader.pages)}')
    if data.get('source', {}).get('official_pdf_sha256') != hashlib.sha256(pdf_bytes).hexdigest():
        errors.append('dataset official PDF SHA-256 does not match audited PDF')
    if len(rows) != 597 or set(rows) != set(range(1, 598)):
        errors.append(f'Could not find exactly 597 Table 1 centesimal lines; got {len(rows)}')

    descriptor_verified = 0
    macro_line_verified = 0
    nulls = {k: 0 for k in ('energy_kcal','protein_g','carbohydrate_g','lipids_g','dietary_fiber_g')}
    ranges = {k: [] for k in nulls}
    samples = []
    for expected_id, food in enumerate(foods, 1):
        if food.get('id') != expected_id:
            errors.append(f'id order error at position {expected_id}: {food.get("id")}')
            continue
        line = rows.get(expected_id, '')
        desc = food.get('description', '')
        if normal_text(line).startswith(normal_text(desc)):
            descriptor_verified += 1
        else:
            errors.append(f'descriptor mismatch #{expected_id}: {desc!r} / PDF {line[:90]!r}')
            continue
        values = food.get('per_100g_edible_portion', {})
        for key, val in values.items():
            if val is None:
                if key in nulls: nulls[key] += 1
            elif not isinstance(val, (int, float)) or isinstance(val, bool):
                errors.append(f'non-numeric non-null {key} for #{expected_id}')
            else:
                ranges[key].append(val)
                if val == 1e-5:
                    errors.append(f'raw trace sentinel leaked in #{expected_id}/{key}')
        # Macro representation must appear, in order, on that food's official
        # centesimal line.  Null values are deliberately skipped: TACO's NA,
        # Tr and blank cells are semantically distinct but become null here.
        tail = line[len(desc):]
        patterns = []
        for key in ('energy_kcal','protein_g','lipids_g','carbohydrate_g','dietary_fiber_g'):
            v = values.get(key)
            if v is not None:
                patterns.append(compact_number(v))
        pos = 0
        ok = True
        for pattern in patterns:
            found = re.search(pattern, tail[pos:])
            if not found:
                ok = False; break
            pos += found.end()
        if ok:
            macro_line_verified += 1
        else:
            errors.append(f'macro print-order mismatch #{expected_id}: {desc!r}; PDF tail={tail[:160]!r}')

    wanted = [3, 408, 488, 561]
    for ident in wanted:
        f = foods[ident-1]
        samples.append({'id': ident, 'description': f['description'], 'per_100g_edible_portion': f['per_100g_edible_portion'], 'official_pdf_line': rows[ident]})
    report = {
        'audit': 'TACO Table 1 / five selected nutrients',
        'result': 'PASS' if not errors else 'FAIL',
        'official_pdf': {'pages': len(reader.pages), 'sha256': hashlib.sha256(pdf_bytes).hexdigest()},
        'dataset': {'path': args.dataset, 'bytes': Path(args.dataset).stat().st_size, 'food_count': len(foods)},
        'official_table_1_centesimal_rows_found': len(rows),
        'descriptor_lines_verified': descriptor_verified,
        'macro_lines_verified_in_print_order': macro_line_verified,
        'null_counts': nulls,
        'observed_ranges': {k: {'min': min(v), 'max': max(v)} if v else None for k, v in ranges.items()},
        'samples': samples,
        'errors': errors,
        'notes': [
          'The authoritative values are the official PDF display values: kcal integer; gram fields one decimal.',
          'The audit does not treat a TACO Tr, NA, or blank cell as numeric zero; taco-data.json normalizes each to null.',
          'PDF extraction occasionally splits digits with spaces; the verifier tolerates this formatting artifact only.',
        ],
    }
    Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'result': report['result'], 'descriptor_lines_verified': descriptor_verified, 'macro_lines_verified': macro_line_verified, 'errors': len(errors)}, ensure_ascii=False))
    if errors: raise SystemExit(1)

if __name__ == '__main__': main()
