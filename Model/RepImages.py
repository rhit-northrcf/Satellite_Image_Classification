import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio
from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "EuroSATallBands"

def to_rgb(data):
    """Input: EuroSAT 13-band tensor (bands, height, width) in B01..B12 order.
    Output: display-only, true-color RGB array based on Sentinel-2 B04,B03,B02.
    Visualization stretch is per-image and does not alter model inputs.
    """
    rgb = np.stack([data[3], data[2], data[1]], axis=-1).astype(np.float32)
    lo = np.percentile(rgb, 2, axis=(0, 1), keepdims=True)
    hi = np.percentile(rgb, 98, axis=(0, 1), keepdims=True)
    rgb = (rgb - lo) / np.maximum(hi - lo, 1e-6)
    return (np.clip(rgb, 0, 1) * 255).astype(np.uint8)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-dir', type=Path, default=DATA_DIR)
    parser.add_argument('--split', default='test.csv', help='CSV in data-dir, with filepath,classID,className columns')
    parser.add_argument('--per-class', type=int, default=3)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--output', type=Path, default=Path('eurosat-gallery'))
    args = parser.parse_args()
    df = pd.read_csv(args.data_dir / args.split)
    if df.shape[1] < 3:
        raise ValueError('Expected at least three columns: filepath, classID, className')
    df = df.iloc[:, :3].copy()
    df.columns = ['filepath', 'class_id', 'class_name']
    args.output.mkdir(parents=True, exist_ok=True)
    entries = []
    rng = np.random.default_rng(args.seed)
    for class_id, group in df.groupby('class_id', sort=True):
        indices = rng.choice(len(group), size=min(args.per_class, len(group)), replace=False)
        for num, index in enumerate(indices, start=1):
            row = group.iloc[int(index)]
            source = args.data_dir / str(row.filepath)
            if not source.is_file():
                raise FileNotFoundError(f'GeoTIFF not found: {source}')
            with rasterio.open(source) as tif:
                data = tif.read()
            if data.shape[0] != 13:
                raise ValueError(f'Expected 13 bands in {source}, found {data.shape[0]}')
            rgb = to_rgb(data)
            pic = Image.fromarray(rgb).resize((384,384), Image.Resampling.LANCZOS)
            label = str(row.class_name)
            dest = f'{int(class_id):02d}-{label.lower().replace(" ", "-")}-{num:02d}.webp'
            pic.save(args.output / dest, 'WEBP', quality=88, method=6)
            entries.append({'class_id': int(class_id), 'class_name': label, 'image': dest,
                            'source_tiff': str(row.filepath), 'split': args.split,
                            'display': 'Sentinel-2 B04/B03/B02 true-color, per-image 2-98 percentile stretch'})
    (args.output / 'manifest.json').write_text(json.dumps(entries, indent=2), encoding='utf-8')
    # Single overview image, ready for project README / website introduction.
    ncols = min(5, len(entries))
    rows = (len(entries) + ncols - 1) // ncols
    tile_w, tile_h = 240, 270
    sheet = Image.new('RGB', (ncols * tile_w, rows * tile_h), '#0d1722')
    draw = ImageDraw.Draw(sheet)
    for i, entry in enumerate(entries):
        x, y = (i % ncols) * tile_w, (i // ncols) * tile_h
        with Image.open(args.output / entry['image']) as pic:
            sheet.paste(pic.convert('RGB').resize((232,232)), (x + 4, y + 4))
        draw.text((x + 8, y + 241), entry['class_name'], fill='white')
    sheet.save(args.output / 'contact-sheet.webp', 'WEBP', quality=88)
    print(f'Exported {len(entries)} labeled examples into {args.output.resolve()}')
    print('Copy this folder into the website assets/ folder and read manifest.json to build the gallery.')

if __name__ == '__main__':
    main()
