#!/usr/bin/env python3
"""Build a browser-deployable, rounded TACO 4e dataset.

Inputs:
  * legacy normalized raw record file passed with --input (used only to recover
    the five numeric values before publication rounding)
  * official NEPA/UNICAMP PDF text extracted with pypdf, passed with --pdf

The output contains only published-display precision: kcal as integer and the
four gram values as one decimal.  It deliberately does not expose the legacy
community API's high-precision values or its 1e-05 trace sentinel.
"""
from __future__ import annotations
import argparse, hashlib, json
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from pypdf import PdfReader

OFFICIAL_URL = "https://nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/taco_4_edicao_ampliada_e_revisada.pdf"


def display(value, decimals):
    """TACO display precision; null stays null. Decimal half-up, never binary round."""
    if value is None:
        return None
    # Community API uses 1e-05 for some trace nutrients. These five top-level
    # macros have no such values in this input. Guard it anyway: no fake zero.
    if abs(float(value)) == 0.00001:
        return None
    quantum = Decimal("1") if decimals == 0 else Decimal("0.1")
    n = Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP)
    return int(n) if decimals == 0 else float(n)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True)
    ap.add_argument('--pdf', required=True)
    ap.add_argument('--output', required=True)
    args = ap.parse_args()

    raw = json.loads(Path(args.input).read_text(encoding='utf-8'))
    if len(raw) != 597:
        raise ValueError(f'Expected 597 raw records, got {len(raw)}')
    pdf = Path(args.pdf).read_bytes()
    if len(PdfReader(args.pdf).pages) != 164:
        raise ValueError('Unexpected official PDF page count')

    foods = []
    for expected_id, item in enumerate(raw, 1):
        item_id = item['id']
        if item_id != f'taco-{expected_id}':
            raise ValueError(f'Unexpected item order/id: {item_id}')
        foods.append({
            'id': expected_id,
            'description': item['n'],
            'category': item['category'],
            'per_100g_edible_portion': {
                'energy_kcal': display(item['k'], 0),
                'protein_g': display(item['p'], 1),
                'carbohydrate_g': display(item['c'], 1),
                'lipids_g': display(item['f'], 1),
                'dietary_fiber_g': display(item['fi'], 1),
            },
        })

    out = {
        'schema_version': '1.0',
        'title': 'TACO 4ª edição — cinco macronutrientes por 100 g',
        'basis': '100 g de parte comestível',
        'numeric_policy': {
            'energy_kcal': 'inteiro publicado na TACO',
            'protein_g': 'uma casa decimal publicada na TACO',
            'carbohydrate_g': 'uma casa decimal publicada na TACO',
            'lipids_g': 'uma casa decimal publicada na TACO',
            'dietary_fiber_g': 'uma casa decimal publicada na TACO',
            'missing_or_trace': 'null; nunca usar sentinela numérica para NA, Tr ou valor em branco',
        },
        'alias_policy': 'Nenhum alias ou padrão cru/cozido é fornecido. Use somente description/id exatos.',
        'source': {
            'publisher': 'NEPA — Núcleo de Estudos e Pesquisas em Alimentação, UNICAMP',
            'work': 'Tabela Brasileira de Composição de Alimentos — TACO, 4ª edição revisada e ampliada',
            'publication_year': 2011,
            'official_url': OFFICIAL_URL,
            'official_pdf_sha256': hashlib.sha256(pdf).hexdigest(),
            'reproduction_notice': 'A obra permite reprodução parcial ou total desde que a fonte seja citada (página preliminar do PDF).',
            'required_attribution': 'NEPA/UNICAMP. Tabela Brasileira de Composição de Alimentos — TACO. 4ª ed. rev. e ampl. Campinas: NEPA-UNICAMP, 2011.',
        },
        'food_count': len(foods),
        'foods': foods,
    }
    Path(args.output).write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

if __name__ == '__main__':
    main()
