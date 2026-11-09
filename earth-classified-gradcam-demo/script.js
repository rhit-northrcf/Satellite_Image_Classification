(() => {
  'use strict';
  const data = window.PROJECT_DATA;
  if (!data) { console.error('Missing data.js'); return; }

  const $ = (id) => document.getElementById(id);
  const names = data.classes;
  const cm = data.matrix;
  const totals = cm.map(row => row.reduce((a,b) => a+b,0));
  const predictedTotals = names.map((_, col) => cm.reduce((sum, row) => sum+row[col],0));
  const count = totals.reduce((a,b)=>a+b,0);
  const correct = cm.reduce((a,row,i)=>a+row[i],0);
  const accuracy = correct/count;
  const recall = names.map((_,i) => cm[i][i] / totals[i]);
  const precision = names.map((_,i) => cm[i][i] / (predictedTotals[i] || 1));
  const f1 = recall.map((r,i)=>(r+precision[i]) ? 2*r*precision[i]/(r+precision[i]) : 0);
  const macroF1 = f1.reduce((a,b)=>a+b,0) / names.length;
  const percent = n => (n*100).toFixed(2) + '%';
  const prettyName = name => ({'AnnualCrop':'Annual Crop','HerbaceousVegetation':'Herbaceous Vegetation','PermanentCrop':'Permanent Crop','SeaLake':'Sea / Lake'}[name] || name);
  $('metric-accuracy').textContent=percent(accuracy);
  $('metric-f1').textContent=percent(macroF1);
  $('metric-count').textContent=count.toLocaleString('en-US');
  $('metric-baseline').textContent='0.13';

  const prettyClass = (name) => ({AnnualCrop:'Annual Crop',HerbaceousVegetation:'Herbaceous Vegetation',PermanentCrop:'Permanent Crop',SeaLake:'Sea / Lake'}[name] || name);
  const classKinds = ['AGRICULTURE','VEGETATION','VEGETATION','INFRASTRUCTURE','BUILT ENVIRONMENT','AGRICULTURE','AGRICULTURE','BUILT ENVIRONMENT','WATER','WATER'];
  const gallery = window.EUROSAT_GALLERY || [];
  const classesGrid=$('class-grid');
  const dialog=$('gallery-dialog');
  const exportsByImage = window.EUROSAT_EXPLANATIONS || {};
  let activeSample = null;
  let activePrediction = null;
  let activeCamClass = null;
  let showHeatmap = false;
  const classIndex = new Map(names.map((name, i) => [name, i]));

  function probLabel(p) {
    const percent = 100 * p;
    if (percent > 0 && percent < 0.01) return '<0.01%';
    return percent.toFixed(2) + '%';
  }
  function renderExplanationImage() {
    if (!activeSample) return;
    const original = 'assets/eurosat-gallery/' + activeSample.image;
    const heatmapUrl = activePrediction && activePrediction.heatmaps
      ? activePrediction.heatmaps[String(activeCamClass)] : null;
    const canShowHeat = !!heatmapUrl;
    if (!canShowHeat) showHeatmap = false;
    const heatActive = showHeatmap && canShowHeat;
    const image = $('gallery-dialog-image');
    image.src = heatActive ? heatmapUrl : original;
    image.alt = heatActive
      ? 'Grad-CAM attention overlay for '+prettyClass(names[activeCamClass])+' on '+prettyClass(activeSample.class_name)+' patch'
      : 'RGB satellite preview for '+prettyClass(activeSample.class_name)+' patch';
    $('explain-image-status').textContent = heatActive ? 'GRAD-CAM / '+prettyClass(names[activeCamClass]).toUpperCase() : 'RGB VIEW';
    $('explain-view-original').classList.toggle('active', !heatActive);
    $('explain-view-original').setAttribute('aria-pressed', String(!heatActive));
    $('explain-view-heatmap').classList.toggle('active', heatActive);
    $('explain-view-heatmap').setAttribute('aria-pressed', String(heatActive));
    $('explain-view-heatmap').disabled = !canShowHeat;
    $('explain-heat-caption').textContent = !activePrediction
      ? 'No model outputs are bundled yet. Run tools/export_explanations.py using your checkpoint, normalization statistics, and 13-band TIFF files.'
      : heatActive
        ? 'Attribution for '+prettyClass(names[activeCamClass])+'. Warmer colors indicate areas supporting this class score. Intensities are relative within this map.'
        : canShowHeat
          ? 'Original RGB preview. Select “Grad-CAM overlay” to see model attribution for '+prettyClass(names[activeCamClass])+'.'
          : 'Heatmaps were exported only for the top-ranked classes. Choose one of the classes marked with an attention symbol.';
  }
  function renderExplanationScores() {
    const list = $('explain-score-list');
    list.replaceChildren();
    if (!activePrediction || !Array.isArray(activePrediction.scores) || !activePrediction.scores.length) {
      $('explain-prediction-heading').textContent = 'Not exported yet';
      $('explain-prediction-subtitle').textContent = 'This gallery includes original scene labels, but not per-image inference outputs.';
      const p = document.createElement('p');
      p.className = 'explain-empty';
      p.textContent = 'Run the included tools/export_explanations.py script to generate genuine scores and heatmaps from your trained model.';
      list.append(p);
      $('explain-score-note').textContent = 'Gallery images are display previews—not valid 13-band inputs to the model.';
      return;
    }
    const top = activePrediction.scores[0];
    $('explain-prediction-heading').textContent = prettyClass(top.class_name);
    $('explain-prediction-subtitle').textContent = 'Predicted class · '+probLabel(top.probability)+' softmax score · Actual class: '+prettyClass(activeSample.class_name);
    $('explain-score-note').textContent = 'All 10 model outputs, sorted by softmax score. Tap a class with an attention symbol to switch its heatmap. Scores are not calibrated confidence estimates.';
    activePrediction.scores.forEach((row, rank) => {
      const canInspect = !!(activePrediction.heatmaps && activePrediction.heatmaps[String(row.class_id)]);
      const el = document.createElement(canInspect ? 'button' : 'div');
      if (canInspect) { el.type = 'button'; el.addEventListener('click', () => {
        activeCamClass = row.class_id;
        showHeatmap = true;
        renderExplanationImage();
        renderExplanationScores();
      }); }
      el.className = 'explain-score-row'+(rank===0?' top-ranked':'')+(row.class_id===activeCamClass?' selected':'');
      const head = document.createElement('div');
      head.className = 'explain-score-head';
      const label = document.createElement('span');
      label.textContent = (rank + 1) + '. ' + prettyClass(row.class_name) + (canInspect ? ' ◉' : '');
      const value = document.createElement('strong');
      value.textContent = probLabel(row.probability);
      head.append(label, value);
      const bar = document.createElement('div');
      bar.className = 'explain-score-track';
      const fill = document.createElement('i');
      fill.style.width = (100 * row.probability) + '%';
      bar.append(fill);
      el.append(head, bar);
      list.append(el);
    });
  }
  function openGallery(item){
    activeSample = item;
    activePrediction = exportsByImage[item.image] || null;
    activeCamClass = activePrediction && activePrediction.scores && activePrediction.scores.length
      ? activePrediction.scores[0].class_id : classIndex.get(item.class_name);
    showHeatmap = !!(activePrediction && activePrediction.heatmaps && activePrediction.heatmaps[String(activeCamClass)]);
    $('gallery-dialog-class').textContent = prettyClass(item.class_name);
    $('gallery-dialog-source').textContent = 'Source: '+item.source_tiff+' · test.csv';
    renderExplanationScores();
    renderExplanationImage();
    if (dialog && dialog.showModal) dialog.showModal();
  }
  const errors = window.EUROSAT_ERRORS || [];
  errors.forEach((e) => {
    const item={image:e.gallery_image,class_name:e.true_class,source_tiff:e.source_tiff};
    exportsByImage[e.gallery_image]={source_tiff:e.source_tiff,true_class:e.true_class,predicted_class:e.predicted_class,predicted_class_id:e.predicted_class_id,scores:e.scores,heatmaps:e.resolved_heatmaps};
    const btn=document.createElement('button');btn.type='button';btn.className='error-card';
    const pic=document.createElement('img');pic.src='assets/eurosat-gallery/'+e.gallery_image;pic.alt='EuroSAT image with ground-truth '+prettyClass(e.true_class);pic.loading='lazy';
    const details=document.createElement('span');details.className='error-card-content';
    const eyebrow=document.createElement('small');eyebrow.textContent='REAL TEST ERROR · '+e.id.toUpperCase();
    const pair=document.createElement('strong');pair.textContent=prettyClass(e.true_class)+' → '+prettyClass(e.predicted_class);
    const sub=document.createElement('span');sub.textContent='Predicted '+prettyClass(e.predicted_class)+' · '+probLabel(e.confidence)+' · Explore heatmaps ↗';
    details.append(eyebrow,pair,sub);btn.append(pic,details);
    btn.addEventListener('click',()=>openGallery(item));$('error-card-grid').append(btn);
  });
  $('explain-view-original').addEventListener('click',()=>{showHeatmap=false;renderExplanationImage();});
  $('explain-view-heatmap').addEventListener('click',()=>{showHeatmap=true;renderExplanationImage();});
  $('gallery-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',(e)=>{if(e.target===dialog) dialog.close();});
  names.forEach((className,i)=>{
    const samples=gallery.filter(x=>x.class_name===className);
    if (!samples.length) return;
    let active=0;
    const article=document.createElement('article'); article.className='class-card';
    const art=document.createElement('button');art.type='button';art.className='class-art real-art';art.title='View full image';
    const img=document.createElement('img');img.src='assets/eurosat-gallery/'+samples[0].image;img.alt='EuroSAT test image showing '+prettyClass(className);img.loading='lazy';img.decoding='async';
    const number=document.createElement('span');number.className='art-number';number.textContent=String(i+1).padStart(2,'0');
    const marker=document.createElement('span');marker.className='art-marker';marker.textContent='↗';
    art.append(img,number,marker);art.addEventListener('click',()=>openGallery(samples[active]));
    const meta=document.createElement('div');meta.className='class-meta';
    const label=document.createElement('strong');label.textContent=prettyClass(className);
    const hint=document.createElement('span');hint.textContent=classKinds[i];meta.append(label,hint);
    const nav=document.createElement('div');nav.className='gallery-choices';nav.setAttribute('role','group');nav.setAttribute('aria-label',`Choose ${prettyClass(className)} image`);
    samples.forEach((sample,n)=>{
      const btn=document.createElement('button');btn.type='button';btn.className='gallery-choice'+(n===0?' active':'');btn.textContent=String(n+1).padStart(2,'0');btn.title=sample.source_tiff;
      btn.setAttribute('aria-pressed',String(n===0));
      btn.addEventListener('click',()=>{active=n;img.src='assets/eurosat-gallery/'+sample.image;img.alt='EuroSAT test sample '+(n+1)+' showing '+prettyClass(className);nav.querySelectorAll('button').forEach((b,k)=>{b.classList.toggle('active',k===n);b.setAttribute('aria-pressed',String(k===n));});});
      nav.append(btn);
    });
    article.append(art,meta,nav);classesGrid.append(article);
  });

  // Free-selection image explorer; no random quiz or running score.
  const challengePool=gallery.filter(item=>exportsByImage[item.image]?.scores?.length);
  let challengeSample=null,challengeGuess=null,challengeAnswered=false,challengeHeat=false,challengeClassId=null;
  const challengeOptions=$('challenge-options'), resultPanel=$('challenge-result-panel'),guessPanel=$('challenge-guess-panel');
  const scenePicker=$('scene-picker');
  const imageButtons=new Map();
  function challengePhoto(){
    if(!challengeSample)return;
    const entry=exportsByImage[challengeSample.image];
    const heatUrl=entry?.heatmaps?.[String(challengeClassId)];
    const isHeat=challengeAnswered&&challengeHeat&&!!heatUrl;
    $('challenge-image').src=isHeat?heatUrl:'assets/eurosat-gallery/'+challengeSample.image;
    $('challenge-image').alt=isHeat?'Grad-CAM overlay for '+prettyClass(names[challengeClassId]):'Selected EuroSAT satellite scene';
    $('challenge-image-mode').textContent=isHeat?'GRAD-CAM / '+prettyClass(names[challengeClassId]).toUpperCase():'RGB PREVIEW';
    $('challenge-cam').disabled=!heatUrl;
    $('challenge-rgb').classList.toggle('active',!isHeat);$('challenge-cam').classList.toggle('active',isHeat);
    $('challenge-rgb').setAttribute('aria-pressed',String(!isHeat));$('challenge-cam').setAttribute('aria-pressed',String(isHeat));
    $('challenge-heat-help').textContent=challengeAnswered?(isHeat?'Warm areas contributed more positively to the selected class score. Heatmap intensity is relative to this map.':'Switch to Grad-CAM, or click one of the available class scores to change its attribution map.'):'The RGB preview shows three display bands; the model used all 13 original bands.';
  }
  function challengeShowScores(){
    const entry=exportsByImage[challengeSample.image],target=$('challenge-scores');target.replaceChildren();
    entry.scores.forEach((r,i)=>{
      const hasCam=!!entry.heatmaps[String(r.class_id)];
      const row=document.createElement(hasCam?'button':'div');row.className='explain-score-row'+(i===0?' top-ranked':'')+(challengeClassId===r.class_id?' selected':'');
      if(hasCam){row.type='button';row.title='View '+prettyClass(r.class_name)+' Grad-CAM';row.addEventListener('click',()=>{challengeClassId=r.class_id;challengeHeat=true;challengePhoto();challengeShowScores();});}
      const head=document.createElement('div');head.className='explain-score-head';
      const label=document.createElement('span');label.textContent=(i+1)+'. '+prettyClass(r.class_name)+(hasCam?' ◉':'');
      const value=document.createElement('strong');value.textContent=probLabel(r.probability);head.append(label,value);
      const track=document.createElement('div');track.className='explain-score-track';const fill=document.createElement('i');fill.style.width=(100*r.probability)+'%';track.append(fill);row.append(head,track);target.append(row);
    });
  }
  function challengeSelect(item){
    challengeSample=item;challengeGuess=null;challengeAnswered=false;challengeHeat=false;challengeClassId=null;
    $('challenge-count').textContent='SCENE / '+String(challengePool.indexOf(item)+1).padStart(2,'0');
    $('challenge-image-controls').hidden=true;resultPanel.hidden=true;guessPanel.hidden=false;
    challengeOptions.querySelectorAll('button').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false');});
    for(const [image,btn] of imageButtons){const active=image===item.image;btn.classList.toggle('selected',active);btn.setAttribute('aria-pressed',String(active));}
    challengePhoto();
  }
  names.forEach(name=>{
    const button=document.createElement('button');button.type='button';button.className='challenge-option';button.textContent=prettyClass(name);button.setAttribute('aria-pressed','false');
    button.addEventListener('click',()=>{challengeGuess=name;challengeOptions.querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});});
    challengeOptions.append(button);
  });
  challengePool.forEach((sample,i)=>{
    const button=document.createElement('button');button.type='button';button.className='scene-tile';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Select satellite scene '+String(i+1).padStart(2,'0'));button.title='';
    const thumb=document.createElement('img');thumb.src='assets/eurosat-gallery/'+sample.image;thumb.alt='Satellite scene '+String(i+1).padStart(2,'0');thumb.loading='lazy';
    const number=document.createElement('span');number.textContent=String(i+1).padStart(2,'0');button.append(thumb,number);
    button.addEventListener('click',()=>challengeSelect(sample));scenePicker.append(button);imageButtons.set(sample.image,button);
  });
  function challengeReveal(){
    if(!challengeSample)return;
    challengeAnswered=true;const entry=exportsByImage[challengeSample.image];
    const correct=entry.predicted_class===challengeSample.class_name;
    $('challenge-count').textContent='SCENE / '+String(challengePool.indexOf(challengeSample)+1).padStart(2,'0')+' · '+challengeSample.source_tiff.split('/').pop();
    $('challenge-result-title').textContent='Model results for this scene';
    $('challenge-verdict').textContent=(challengeGuess===null?'No visitor guess was entered. ':challengeGuess===challengeSample.class_name?'Your classification matches the ground truth. ':'Your classification differs from the ground truth. ')+(correct?'The model predicted correctly.':'The model misclassified this scene.');
    $('challenge-user-label').textContent=challengeGuess===null?'Skipped':prettyClass(challengeGuess);
    $('challenge-actual-label').textContent=prettyClass(challengeSample.class_name);
    $('challenge-model-label').textContent=prettyClass(entry.predicted_class)+' · '+probLabel(entry.scores[0].probability);
    challengeClassId=entry.scores[0].class_id;challengeHeat=!!entry.heatmaps[String(challengeClassId)];
    guessPanel.hidden=true;resultPanel.hidden=false;$('challenge-image-controls').hidden=false;challengeShowScores();challengePhoto();
  }
  $('challenge-reveal').addEventListener('click',challengeReveal);
  $('challenge-change-guess').addEventListener('click',()=>{challengeAnswered=false;challengeHeat=false;$('challenge-count').textContent='SCENE / '+String(challengePool.indexOf(challengeSample)+1).padStart(2,'0');guessPanel.hidden=false;resultPanel.hidden=true;$('challenge-image-controls').hidden=true;challengePhoto();});
  $('challenge-rgb').addEventListener('click',()=>{challengeHeat=false;challengePhoto();});
  $('challenge-cam').addEventListener('click',()=>{challengeHeat=true;challengePhoto();});
  $('challenge-open-inspector').addEventListener('click',()=>{if(challengeSample)openGallery(challengeSample);});
  if(challengePool.length)challengeSelect(challengePool[0]);

  const stageEl=$('stage-list');
  data.stages.forEach((stage,i)=>{
    const item=document.createElement('div');item.className='stage-entry';
    item.innerHTML=`<div><span class="stage-index">STAGE 0${i+1}</span><strong>${stage.name}</strong><small>Epochs ${stage.epochs}</small></div><div class="lr-details">HEAD ${stage.headLr.toExponential(0)}<br>ENCODER ${stage.backboneLr.toExponential(0)}</div>`;
    stageEl.append(item);
  });

  const changeToggle=(selected, other) => {selected.classList.add('active');selected.setAttribute('aria-pressed','true');other.classList.remove('active');other.setAttribute('aria-pressed','false');};
  let chartMode='accuracy';
  $('view-accuracy').addEventListener('click',()=>{chartMode='accuracy';changeToggle($('view-accuracy'),$('view-loss'));renderChart();});
  $('view-loss').addEventListener('click',()=>{chartMode='loss';changeToggle($('view-loss'),$('view-accuracy'));renderChart();});
  // The five learning-rate regimes are extracted from the actual notebook schedule.
  const stageLengths=[10,10,10,6,6];
  // Keep full recorded history intact, but clip Stage I after its best validation loss (epoch 10).
  const plottedHistory=data.history.filter(row=>row.stage!==1 || row.epoch<=10);
  const shownEpochs=plottedHistory.map(row=>row.epoch);
  const plottedIndex=(epoch)=>shownEpochs.indexOf(epoch);
  const stageLabels=['I','II','III','IV','V'];
  const stageStarts=[1,21,31,41,47];
  const stageForEpoch=(epoch)=>Math.min(data.stages.length-1, stageStarts.reduce((acc,n,i)=>epoch>=n?i:acc,0));
  const fmtLR=(v)=>v.toExponential(0).replace('e-0','e-');
  const rail=$('lr-stage-rail');
  rail.innerHTML='';
  data.stages.forEach((stage,i)=>{
    const el=document.createElement('div');
    el.className='lr-rail-segment';
    el.style.flexGrow=String(stageLengths[i]);
    el.style.setProperty('--phase-color',`var(--phase-${i+1})`);
    el.innerHTML=`<span class="lr-rail-name">STAGE ${stageLabels[i]}</span><strong>${fmtLR(stage.headLr)}</strong><small>${stage.epochs} epochs · encoder ${fmtLR(stage.backboneLr)}</small>`;
    rail.append(el);
  });
  function renderChart(){
    const target=$('learning-chart');target.innerHTML='';
    const w=780,h=364,l=52,r=18,t=48,b=45;
    const iw=w-l-r,ih=h-t-b;
    const isAcc=chartMode==='accuracy';
    const lo=isAcc?75:0,hi=isAcc?100:.7;
    const yValue=(entry,source) => isAcc? entry[source+'Accuracy']:entry[source+'Loss'];
    const x=(epoch)=>l+plottedIndex(epoch)/(plottedHistory.length-1)*iw;
    const y=(v)=>t+(hi-v)/(hi-lo)*ih;
    const mkLine=(source)=>plottedHistory.map((row,i)=>`${i && row.stage===plottedHistory[i-1].stage?'L':'M'}${x(row.epoch).toFixed(2)},${y(yValue(row,source)).toFixed(2)}`).join(' ');
    const edges=[l,...[[10,21],[30,31],[40,41],[46,47]].map(([a,b])=>(x(a)+x(b))/2),w-r];
    const palette=['#e4e7ff','#dff7f6','#f2e1fd','#ffecdd','#e5f3de'];
    let bands='';
    data.stages.forEach((stage,i)=>{
      const left=edges[i],width=edges[i+1]-left;
      const mid=left+width/2;
      bands+=`<rect x="${left}" y="${t}" width="${width}" height="${ih}" fill="${palette[i]}"/>`;
      bands+=`<rect x="${left+1}" y="${t-24}" width="${Math.max(0,width-2)}" height="20" rx="4" fill="${palette[i]}" />`;
      bands+=`<text x="${mid}" y="${t-10}" text-anchor="middle" font-size="${i<3?11:10}" font-weight="600" fill="#344460">${stageLabels[i]} · ${fmtLR(stage.headLr)}</text>`;
      if(i>0) bands+=`<line x1="${left}" y1="${t-24}" x2="${left}" y2="${h-b}" stroke="#647592" stroke-width="1.4" stroke-dasharray="4 5" opacity=".8"/>`;
    });
    let grid='';
    for(let i=0;i<=5;i++){
      const v=lo+(hi-lo)*i/5;
      const yy=y(v);
      grid+=`<line x1="${l}" y1="${yy}" x2="${w-r}" y2="${yy}" stroke="#cbd4e0" stroke-width="1"/><text x="${l-9}" y="${yy+4}" text-anchor="end" font-size="11" fill="#64748b">${isAcc?Math.round(v)+'%':v.toFixed(2)}</text>`;
    }
    [1,10,21,30,40,52].forEach(n=>{grid+=`<text x="${x(n)}" y="${h-15}" text-anchor="middle" font-size="11" fill="#52627a">${n}</text>`;});
    const circles=plottedHistory.map(row=>`<circle cx="${x(row.epoch)}" cy="${y(yValue(row,'valid'))}" r="8.5" opacity="0" fill="#4266a8" data-epoch="${row.epoch}" tabindex="0" aria-label="Epoch ${row.epoch}, stage ${stageForEpoch(row.epoch)+1}, head learning rate ${data.stages[stageForEpoch(row.epoch)].headLr}, encoder learning rate ${data.stages[stageForEpoch(row.epoch)].backboneLr}, training ${isAcc?row.trainAccuracy+' percent':row.trainLoss}, validation ${isAcc?row.validAccuracy+' percent':row.validLoss}"/>`).join('');
    const bestEpoch=data.history.reduce((best,row)=>row.validLoss < best.validLoss ? row : best,data.history[0]);
    const bx=x(bestEpoch.epoch),by=y(yValue(bestEpoch,'valid'));
    const bestMarker=`<line x1="${bx}" y1="${t}" x2="${bx}" y2="${h-b}" stroke="#c24eaa" stroke-width="2" stroke-dasharray="5 5"/><circle cx="${bx}" cy="${by}" r="7" fill="#fff" stroke="#c24eaa" stroke-width="3"/><circle cx="${bx}" cy="${by}" r="2.4" fill="#c24eaa"/>`;
    const svg=`<svg role="img" aria-label="${isAcc?'Training and validation accuracy':'Training and validation cross-entropy loss'} over 42 displayed fine-tuning epochs (Stage I truncated at epoch 10), divided into five labeled learning-rate regimes; best validation loss at epoch 31" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><title>${isAcc?'Accuracy':'Loss'} with five annotated learning-rate regimes and best validation-loss epoch 31</title>${bands}${grid}<path d="${mkLine('train')}" fill="none" stroke="#5046df" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/><path d="${mkLine('valid')}" fill="none" stroke="#fb7356" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>${bestMarker}${circles}<text x="${w/2}" y="${h-1}" text-anchor="middle" fill="#52627a" font-size="11">FINE-TUNING EPOCH</text></svg>`;
    const wrap=document.createElement('div');wrap.className='chart-wrap';wrap.innerHTML=svg+'<div class="chart-tooltip" hidden></div>';
    target.append(wrap);
    const tip=wrap.querySelector('.chart-tooltip');
    const showTooltip=(node)=>{
      const row=plottedHistory.find(entry=>entry.epoch===Number(node.dataset.epoch));
      const stageIndex=stageForEpoch(row.epoch);
      const stage=data.stages[stageIndex];
      tip.hidden=false;
      tip.innerHTML=`<strong>Epoch ${row.epoch} / Stage ${stageLabels[stageIndex]}${row.epoch===31?" ✦ Lowest validation loss":""}</strong><br>Head LR ${fmtLR(stage.headLr)} · Encoder LR ${fmtLR(stage.backboneLr)}<br>Train: ${isAcc?row.trainAccuracy.toFixed(2)+'%':row.trainLoss.toFixed(4)}<br>Validation: ${isAcc?row.validAccuracy.toFixed(2)+'%':row.validLoss.toFixed(4)}`;
      const rect=wrap.getBoundingClientRect();
      const viewbox=wrap.querySelector('svg').getBoundingClientRect();
      const tooltipLeft=x(row.epoch)/w*viewbox.width;
      tip.style.left=Math.max(0,Math.min(tooltipLeft,rect.width-215))+'px';
      tip.style.top='8px';
    };
    wrap.querySelectorAll('[data-epoch]').forEach(node=>{
      node.addEventListener('mouseenter',()=>showTooltip(node));
      node.addEventListener('mouseleave',()=>tip.hidden=true);
      node.addEventListener('focus',()=>showTooltip(node));
      node.addEventListener('blur',()=>tip.hidden=true);
    });
  }
  renderChart();

  const best=recall.indexOf(Math.max(...recall));
  const worst=recall.indexOf(Math.min(...recall));
  let confusion={count:-1,row:0,col:0};
  cm.forEach((row,i)=>row.forEach((n,j)=>{if(i!==j && n>confusion.count) confusion={count:n,row:i,col:j};}));
  $('best-class-name').textContent=prettyName(names[best]);
  $('best-class-copy').textContent=`${cm[best][best]} of ${totals[best]} ${prettyName(names[best])} patches correctly classified (${percent(recall[best])} recall).`;
  $('weakest-class-name').textContent=prettyName(names[worst]);
  $('weakest-class-copy').textContent=`${cm[worst][worst]} of ${totals[worst]} identified correctly (${percent(recall[worst])} recall).`;
  $('confusion-name').textContent=`${prettyName(names[confusion.row])} → ${prettyName(names[confusion.col])}`;
  $('confusion-copy').textContent=`${confusion.count} actual ${prettyName(names[confusion.row])} scenes were predicted as ${prettyName(names[confusion.col])}, the most frequent off-diagonal error.`;

  const robustEl=$('robustness-list');
  (window.ROBUSTNESS_RESULTS||[]).forEach((r)=>{
    const row=document.createElement('div');row.className='robust-row';
    const name=document.createElement('span');name.className='robust-name';name.textContent=r.name;
    const track=document.createElement('div');track.className='robust-track';
    const fill=document.createElement('div');fill.className='robust-fill'+(r.accuracy<85?' warning':'');fill.style.width=r.accuracy+'%';track.append(fill);if(r.name.startsWith('gaussian noise')){row.classList.add('robust-row-featured');}
    const score=document.createElement('strong');score.className='robust-score';score.textContent=r.accuracy.toFixed(2)+'%';
    const drop=document.createElement('span');drop.className='robust-drop';drop.textContent='Loss '+r.loss.toFixed(2);
    row.append(name,track,score,drop);robustEl.append(row);
  });

  const barTarget=$('recall-bars');
  names.forEach((name,i)=>{
    const item=document.createElement('div');item.className='recall-row';
    const label=document.createElement('span');label.className='recall-name';label.textContent=prettyName(name);
    const track=document.createElement('div');track.className='recall-track';
    const fill=document.createElement('div');fill.className='recall-fill'+(i===worst?' outlier':'');fill.style.width=(recall[i]*100)+'%';
    track.append(fill);const value=document.createElement('span');value.className='recall-value';value.textContent=(recall[i]*100).toFixed(1)+'%';
    item.append(label,track,value);barTarget.append(item);
  });

  let matrixMode='raw';let activeCell=[confusion.row,confusion.col];
  const labelShort=name=>({'HerbaceousVegetation':'Herbaceous','PermanentCrop':'Permanent Crop','AnnualCrop':'Annual Crop','SeaLake':'Sea/Lake'}[name]||name);
  function pickCell(i,j){
    activeCell=[i,j];
    const n=cm[i][j],share=n/totals[i],same=i===j;
    $('inspect-code').textContent=`ACTUAL ${String(i+1).padStart(2,'0')} / PREDICTED ${String(j+1).padStart(2,'0')}`;
    $('inspect-title').textContent=same?prettyName(names[i]):`${prettyName(names[i])} → ${prettyName(names[j])}`;
    $('inspect-number').textContent=matrixMode==='percent'?(share*100).toFixed(1)+'%':String(n);
    $('inspect-description').textContent=`${n} of ${totals[i]} actual ${prettyName(names[i])} samples ${same?'were correctly classified':'were predicted as '+prettyName(names[j])}. That's ${(share*100).toFixed(1)}% of the actual class.`;
    document.querySelectorAll('.cm-cell').forEach(el=>el.classList.toggle('selected',Number(el.dataset.row)===i&&Number(el.dataset.col)===j));
  }
  function shade(v){
    const q=Math.pow(Math.max(0,Math.min(1,v)),.72);
    const from=[237,243,252],to=[42,91,181];
    const c=from.map((n,i)=>Math.round(n+(to[i]-n)*q));
    return `rgb(${c.join(',')})`;
  }
  function renderMatrix(){
    const plot=$('matrix-plot');plot.innerHTML='';
    const grid=document.createElement('div');grid.className='cm-grid';grid.setAttribute('role','group');grid.setAttribute('aria-label',`10 by 10 confusion matrix, ${matrixMode==='raw'?'raw counts':'row-normalized percentages'}`);
    const corner=document.createElement('div');corner.className='cm-corner';corner.textContent='TRUE ↓ / PRED. →';grid.append(corner);
    names.forEach(name=>{const col=document.createElement('div');col.className='cm-col';const span=document.createElement('span');span.textContent=labelShort(name);col.append(span);grid.append(col);});
    cm.forEach((row,i)=>{
      const label=document.createElement('div');label.className='cm-row';label.textContent=labelShort(names[i]);grid.append(label);
      row.forEach((n,j)=>{
        const v=matrixMode==='raw'?n/Math.max(...cm.flat()):n/totals[i];
        const button=document.createElement('button');button.type='button';button.className='cm-cell';
        button.dataset.row=i;button.dataset.col=j;
        button.style.backgroundColor=shade(v);
        button.style.color=v>.48?'#ffffff':'#1e3555';
        const display=matrixMode==='raw'?String(n):(n/totals[i]*100).toFixed(1)+'%';
        button.title=`Actual: ${prettyName(names[i])} | Predicted: ${prettyName(names[j])} | ${n} / ${totals[i]} (${(n/totals[i]*100).toFixed(1)}%)`;
        button.setAttribute('aria-label',button.title);
        const span=document.createElement('span');span.className='cm-value';span.textContent=display;button.append(span);
        button.addEventListener('click',()=>pickCell(i,j));
        grid.append(button);
      });
    });
    plot.append(grid);pickCell(...activeCell);
  }
  $('matrix-raw').addEventListener('click',()=>{matrixMode='raw';changeToggle($('matrix-raw'),$('matrix-percent'));renderMatrix();});
  $('matrix-percent').addEventListener('click',()=>{matrixMode='percent';changeToggle($('matrix-percent'),$('matrix-raw'));renderMatrix();});
  renderMatrix();
  console.info('EuroSAT test scores calculated from recovered confusion matrix:',{count,accuracy,macroF1});
})();
