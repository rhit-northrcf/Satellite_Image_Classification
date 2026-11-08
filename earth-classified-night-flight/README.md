# Earth, Classified — Night Flight · v7

A standalone static HTML, CSS and JavaScript showcase. **No GPU or training code is needed to view it.** Open `index.html` or run `python -m http.server 8000` here and open `http://localhost:8000`.

## Current checkpoint and evaluation
- Source: `ResNetModel(7).ipynb`, cell 9 test and cell 11 robustness.
- Explicit checkpoint: `Model State Archives/96.6%Acc.pth`.
- Clean accuracy **96.56%** (2,664/2,759); test loss **0.1289**; macro F1 **96.33%** derived from the confusion matrix.
- Gaussian noise `x + 0.2 * randn_like(x)` accuracy **95.40%**, vs **71.77%** on the prior `95.7%Acc.pth` checkpoint in `ResNetModel(5).ipynb` (increase +23.63 percentage points). Noise values are not perfectly deterministic because each evaluation adds a new random noise sample. Earlier re-evaluations of the old checkpoint produced 72.35% on a different random noise draw. Avoid suggesting these are matched samples of identical noise.
- Full new-model robustness results: `results/robustness_v7.csv`. Comparison: `results/noise_comparison.json`.
- Updated page presents all current robustness results; the previous model is shown only in the noise-comparison highlight.

## Recovered training history and learning rates
- `results/recovered_finetuning_history.csv`: 52 fine-tuning epochs (first 20 from `Pasted text(20261106-041618).txt`; subsequent 32 from saved output of `ResNetModel(6).ipynb`, unchanged in (7)).
- Epoch 31 has the lowest **recorded** validation loss: **0.1280**. Site marks it with a dashed vertical line on both charts.
- LR stages: 1–20, 21–30, 31–40, 41–46, 47–52; head LR starts at 1e-4 and reduces 10× each stage; encoder LR is 10× lower.
- 12 frozen warm-up epochs precede this history; their per-epoch logs were not preserved and are not invented.

## Interpretation / limitations
- The model showed strong improvement to Gaussian noise under the same nominal noise scale. The cause of improvement is *not established* by this one comparison, and it should not be attributed solely to convolution initialization without controlled experiments.
- The 30° / 45° rotation transforms can introduce blank corners. This is a transform-specific stress test, not an independent held-out test dataset.
- Test images in the gallery are RGB previews derived from the actual EuroSAT 13-band TIFFs. They are not individual model prediction results.
- The training notebook as saved contains a missing comma in `full_train` and the frozen-stage training loop does not call `model.train()` after validation; these do not invalidate the preserved notebook test outputs but should be corrected before a fresh reproducible training run.
