'use strict';
(() => {
  const kit = window.EASY1_BRAND;
  if (!kit) return;
  const $ = id => document.getElementById(id);
  const names = {symbol:'E1 symbol',horizontal:'Horizontal logo',stacked:'Stacked logo',wordmark:'Wordmark only'};
  const variantNames = {'colour-dark':'Colour / light lettering','colour-light':'Colour / navy lettering',black:'Solid black',white:'Solid white'};
  function downloads(a) {
    return `<div class="downloads"><a class="download" href="${a.svg}" download aria-label="Download ${a.title} as SVG">SVG <span aria-hidden="true">↓</span></a><a class="download" href="${a.png}" download aria-label="Download ${a.title} as PNG">PNG <span aria-hidden="true">↓</span></a></div>`;
  }
  function logoCard(a) {
    const selected = $('background-filter').value;
    const bg = selected === 'recommended' ? (['white','colour-dark'].includes(a.variant)?'dark':'light') : selected;
    return `<article class="asset-card"><div class="preview preview-${bg}"><img class="${a.layout}" src="${a.svg}" alt="${a.title}" loading="lazy" width="${a.width}" height="${a.height}"></div><div class="card-info"><p class="card-label">${names[a.layout]}</p><p class="card-meta">${variantNames[a.variant]} · Transparent</p>${downloads(a)}</div></article>`;
  }
  function renderLogos() {
    const layout=$('layout-filter').value, colour=$('colour-filter').value;
    const list=kit.assets.filter(a=>a.category==='logos'&&(layout==='all'||a.layout===layout)&&(colour==='all'||(colour==='colour'?a.variant.startsWith('colour-'):a.variant===colour)));
    $('logo-grid').innerHTML=list.map(logoCard).join('');
    $('logo-count').textContent=`${list.length} ${list.length===1?'variant':'variants'}`;
    $('empty-logos').hidden=!!list.length;
  }
  function renderSocial() {
    const layout=$('social-filter').value, theme=$('social-theme').value;
    const list=kit.assets.filter(a=>a.category==='social'&&(layout==='all'||a.layout===layout)&&(theme==='all'||a.variant===theme));
    $('social-grid').innerHTML=list.map(a=>`<article class="asset-card"><div class="preview ${a.layout==='avatar'?'avatar':''} preview-${a.variant==='black'?'white':a.variant==='white'?'black':a.variant}"><img src="${a.svg}" alt="${a.title}" loading="lazy" width="${a.width}" height="${a.height}"></div><div class="card-info"><p class="card-label">${a.title}</p><p class="card-meta">${a.width} × ${a.height} px · Background included</p>${downloads(a)}</div></article>`).join('');
    $('empty-social').hidden=!!list.length;
  }
  ['layout-filter','colour-filter','background-filter'].forEach(id=>$(id).addEventListener('change',renderLogos));
  ['social-filter','social-theme'].forEach(id=>$(id).addEventListener('change',renderSocial));
  $('reset-filters').addEventListener('click',()=>{$('layout-filter').value='all';$('colour-filter').value='all';$('background-filter').value='recommended';renderLogos();});
  $('theme-switch').addEventListener('click',()=>{
    const light=document.documentElement.dataset.theme!=='light';
    document.documentElement.dataset.theme=light?'light':'dark';
    $('nav-logo').src=`assets/easy1-horizontal-colour-${light?'light':'dark'}.svg`;
    $('theme-switch').innerHTML=`${light?'Dark':'Light'} view <span aria-hidden="true">◐</span>`;
    $('theme-switch').setAttribute('aria-label',`Switch to ${light?'dark':'light'} theme`);
    document.querySelector('meta[name="theme-color"]').content=light?kit.palette.ivory:kit.palette.navy;
  });
  let toastTimer;
  async function copyColour(hex) {
    let copied=false;
    try { await navigator.clipboard.writeText(hex);copied=true; } catch {
      const field=document.createElement('textarea');field.value=hex;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();
      try {copied=document.execCommand('copy');} catch {copied=false;}
      field.remove();
    }
    $('toast').textContent=copied?`Copied ${hex}`:`Colour code: ${hex}`;
    $('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2500);
  }
  ['navy','ivory','indigo','blue','teal'].forEach(name=>{
    const hex=kit.palette[name],button=document.createElement('button');
    button.type='button';button.className='swatch';button.setAttribute('aria-label',`Copy ${name} colour ${hex}`);
    button.innerHTML=`<span class="swatch-colour" style="background:${hex}"></span><span class="swatch-info"><strong>${name[0].toUpperCase()+name.slice(1)}</strong><span>${hex} ↗</span></span>`;
    button.addEventListener('click',()=>copyColour(hex));$('palette-grid').appendChild(button);
  });
  $('icon-downloads').innerHTML=kit.assets.filter(a=>a.category==='icons').map(a=>`<a href="${a.png}" download aria-label="Download ${a.width} pixel PNG icon">${a.width}px ↓</a>`).join('');
  renderLogos();renderSocial();
})();
