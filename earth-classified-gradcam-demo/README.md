# Earth, Classified — Night Flight · v7

A standalone static HTML, CSS and JavaScript showcase. **No GPU or training code is needed to view it.** Open `index.html` or run `python -m http.server 8000` here and open `http://localhost:8000`.

## Current checkpoint and evaluation
- Source: `ResNetModel(7).ipynb`, cell 9 test and cell 11 robustness.
- Explicit checkpoint: `Model State Archives/96.6%Acc.pth`.
- Clean accuracy **96.56%** (2,664/2,759); test loss **0.1289**; macro F1 **96.33%** derived from the confusion matrix.
- Full new-model robustness results: `results/robustness_v7.csv`. Comparison: `results/noise_comparison.json`.
- Updated page presents all current robustness results; the previous model is shown only in the noise-comparison highlight.

## Recovered training history and learning rates
- `results/recovered_finetuning_history.csv`: 52 fine-tuning epochs (first 20 from `Pasted text(20261106-041618).txt`; subsequent 32 from saved output of `ResNetModel(6).ipynb`, unchanged in (7)).
- Epoch 31 has the lowest **recorded** validation loss: **0.1280**. Site marks it with a dashed vertical line on both charts.
- LR stages: 1–20, 21–30, 31–40, 41–46, 47–52; head LR starts at 1e-4 and reduces 10× each stage; encoder LR is 10× lower.
- 12 frozen warm-up epochs precede this history; their per-epoch logs were not preserved and are not invented.

## Interpretation / limitations
- The 30° / 45° rotation transforms can introduce blank corners. This is a transform-specific stress test, not an independent held-out test dataset.
- Test images in the gallery are RGB previews derived from the actual EuroSAT 13-band TIFFs. They are not individual model prediction results.
- The training notebook as saved contains a missing comma in `full_train` and the frozen-stage training loop does not call `model.train()` after validation; these do not invalidate the preserved notebook test outputs but should be corrected before a fresh reproducible training run.

## NEW: Per-image class scores and Grad-CAM attention overlays

**The gallery has an optional model inspector now.** When model exports are present,
clicking any of the 30 samples opens a side panel showing *all ten* class softmax
scores (sorted descending), its actual label, the model's top prediction, and a
switchable Grad-CAM overlay for the top three predicted classes. You can click any
class marked `◉` to inspect the attention heatmap for that specific class.

**Real predictions and Grad-CAM images are now included for all 30 gallery samples.**
The scores and attention maps were computed from the uploaded `96.6%Acc.pth`, 13-band
TIFFs, and `normalization_stats(1).txt`. Nothing is simulated. 29/30 predictions
match the supplied labels; the model predicts River for Highway_1140.tif with
a 98.55% softmax score. These 30 selected images are not a replacement for
the independent held-out test-set metric shown elsewhere on this site.

### Export from the original model

In your Python environment (with matching PyTorch/torchvision versions), install:

```bash
pip install rasterio pillow numpy torch torchvision opencv-python
```

Then from this website's folder:

```bash
python tools/export_explanations.py \
  --eurosat-root "../EuroSATallBands" \
  --checkpoint "../Model State Archives/96.6%Acc.pth" \
  --stats "../normalization_stats.txt"
```

Adjust the paths to match the real files on your computer. The script uses the
**same 13-band normalization** as your `EuroSATDataset.__getitem__`; recreates
your ResNet-50 model with 13 input channels, identity encoder FC, and 2048→256→64→10
classification head; loads your actual `state_dict`; and exports `explanations.js`
and static images to `assets/gradcam`. It uses `encoder.layer3[-1]` by default
for more spatial detail on 64×64 inputs. Try `--layer layer4` to compare a more
semantic but coarser heatmap. Set `--top-cams 10` to enable class-specific
heatmaps for every listed class, at increased export time and size.

**Run the website using a local HTTP server** for consistent browser behavior:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000` and open any sample in the gallery. The model
inference happens once at export time; visitors do not need PyTorch, an API,
or a GPU. For arbitrary new TIFF uploads, use a Python inference API instead.

**Interpretation caution:** Softmax scores rank model preferences, but do not by
themselves show well-calibrated statistical probabilities. Grad-CAM is a rough
spatial attribution method, not proof that a particular spectral feature or
pixel was causally necessary for the prediction. On 64×64 imagery, its maps can
be coarse, especially from the final ResNet block. The overlay uses the existing
RGB preview for display only; the model inference uses all 13 TIFF bands.


## November 2026 presentation revisions

- A model-backed misclassification card opens `Highway_1140.tif` in the existing score/Grad-CAM modal (predicted River). The confusion matrix's aggregate most-common error is a separate statistic.
- Stage I is charted only through epoch 10, the **lowest** Stage I validation loss (0.1310). Epochs 11–20 are retained in raw `data.js` but omitted from the visual graph; other stages retain their original global epoch labels. The request's wording said *highest* validation loss; epoch 1 has the highest (0.3291), so the conventional checkpoint-selection interpretation is used here.
- The robustness section reports all 15 supplied conditions as accuracy and loss, with no old checkpoint comparison. The supplied combined rotate-90/hflip test loss 0.1499 and accuracy 95.76% is noted separately; table loss is rounded to 0.15.

## Interactive visitor classification challenge

In the Results section, the “Can you classify it?” challenge presents an unlabeled RGB gallery image. Visitors select one of the ten classes before the ground truth and model prediction are shown. After guessing, the site reveals all ten **real exported** model softmax scores, with class-selectable top-3 Grad-CAM heatmaps, a full-size inspector, and a next-image button. This is a static presentation feature using the bundled checkpoint exports; it does not run new inference or accept arbitrary uploads.


Blind selection update: The 30-image scene picker contains no class filter, no hover labels, and no filename/ground truth shown until model results are revealed. All three rows are visible without an internal vertical scrollbar.
