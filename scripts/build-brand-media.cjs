/* Rebuild the static brand kit with the installed sharp dependency. SVGs use outlined
 * letters; no font, browser, API call or image-generation service is needed for exports. */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('../easy1staking/node_modules/sharp');
const root = path.resolve(__dirname, '../easy1staking/public/brand');
const out = path.join(root, 'assets');
const brand = JSON.parse(fs.readFileSync(path.join(root, 'source/identity.json')));
const word = JSON.parse(fs.readFileSync(path.join(root, 'source/wordmark.json')));
const C = brand.palette;
const assets = [];
const defs = `<defs><linearGradient id="brand" x1="0" y1="240" x2="240" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="${C.indigo}"/><stop offset=".5" stop-color="${C.blue}"/><stop offset="1" stop-color="${C.teal}"/></linearGradient></defs>`;
const escape = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function mark(x, y, size, fill) {
  return `<g transform="translate(${x} ${y}) scale(${size / 240})" fill="${fill}">${brand.paths.map(d => `<path d="${d}"/>`).join('')}</g>`;
}
function lettering(x, y, width, fill, maxHeight = Infinity) {
  const b = word.bounds;
  const s = Math.min(width / b.width, maxHeight / b.height);
  return { width: b.width * s, height: b.height * s, svg: `<g transform="translate(${x} ${y}) scale(${s}) translate(${-b.x} ${-b.y})"><path d="${word.path}" fill="${fill}"/></g>` };
}
function svg(width, height, content, label, background = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">${escape(label)}</title>${defs}${background ? `<rect width="${width}" height="${height}" fill="${background}"/>` : ''}${content}</svg>\n`;
}
async function save(id, title, category, variant, width, height, content, background = '', layout = '') {
  const source = svg(width, height, content, title, background);
  const svgName = `${id}.svg`, pngName = `${id}.png`;
  fs.writeFileSync(path.join(out, svgName), source);
  await sharp(Buffer.from(source)).resize(width, height).png().toFile(path.join(out, pngName));
  assets.push({id, title, category, variant, layout, width, height, background: background || 'transparent', svg: `assets/${svgName}`, png: `assets/${pngName}`});
}
const variants = [
  {id:'colour-dark', name:'Colour · dark background', ink:C.ivory, mark:'url(#brand)'},
  {id:'colour-light', name:'Colour · light background', ink:C.navy, mark:'url(#brand)'},
  {id:'black', name:'Black', ink:C.black, mark:C.black},
  {id:'white', name:'White', ink:C.white, mark:C.white}
];
async function main() {
  fs.mkdirSync(out, {recursive:true});
  for (const v of variants) {
    await save(`easy1-symbol-${v.id}`, `E1 symbol — ${v.name}`, 'logos', v.id, 1024, 1024, mark(64,64,896,v.mark), '', 'symbol');
    const label = lettering(310, 0, 860, v.ink, 164);
    await save(`easy1-horizontal-${v.id}`, `Horizontal logo — ${v.name}`, 'logos', v.id, 1200, 280, mark(20,20,240,v.mark) + lettering(310,(280-label.height)/2,860,v.ink,164).svg, '', 'horizontal');
    const stacked = lettering(0,0,700,v.ink,145);
    await save(`easy1-stacked-${v.id}`, `Stacked logo — ${v.name}`, 'logos', v.id, 800, 660, mark(220,54,360,v.mark) + lettering((800-stacked.width)/2,475,700,v.ink,145).svg, '', 'stacked');
    const textOnly = lettering(0,0,1100,v.ink,190);
    await save(`easy1-wordmark-${v.id}`, `Wordmark — ${v.name}`, 'logos', v.id, 1200, 280, lettering((1200-textOnly.width)/2,(280-textOnly.height)/2,1100,v.ink,190).svg, '', 'wordmark');
  }
  for (const t of [
    {id:'dark',bg:C.navy,ink:C.ivory,mark:'url(#brand)'},
    {id:'light',bg:C.ivory,ink:C.navy,mark:'url(#brand)'},
    {id:'black',bg:C.white,ink:C.black,mark:C.black},
    {id:'white',bg:C.black,ink:C.white,mark:C.white}
  ]) {
    await save(`easy1-avatar-${t.id}`, `Profile image — ${t.id}`, 'social', t.id, 1024,1024,mark(192,192,640,t.mark),t.bg,'avatar');
  }
  for (const t of [{id:'dark',bg:C.navy,ink:C.ivory},{id:'light',bg:C.ivory,ink:C.navy}]) {
    // Branding is on the right; the left stays clear of overlapping profile photos.
    for (const f of [{id:'x-header',name:'X header',w:1500,h:500},{id:'linkedin-cover',name:'LinkedIn profile cover',w:1584,h:396}]) {
      const size=f.h*.36, start=f.w*.37;
      const type=lettering(0,0,f.w*.40,t.ink,f.h*.20);
      const top=(f.h-size)/2;
      const motif=mark(f.w*.035,(f.h-f.h*.74)/2,f.h*.74,C.blue);
      const content=`<g opacity=".065">${motif}</g>`+mark(start,top,size,'url(#brand)')+lettering(start+size+f.w*.035,(f.h-type.height)/2,f.w*.40,t.ink,f.h*.20).svg;
      await save(`easy1-${f.id}-${t.id}`, `${f.name} — ${t.id}`, 'social', t.id, f.w,f.h,content,t.bg,f.id);
    }
    const size=216, text=lettering(0,0,680,t.ink,120);
    await save(`easy1-share-card-${t.id}`,`Share card — ${t.id}`,'social',t.id,1200,630,mark(86,170,size,'url(#brand)')+lettering(365,170+(size-text.height)/2,680,t.ink,120).svg,t.bg,'share-card');
  }
  for (const size of [16,32,48,180,192,512]) {
    await save(`easy1-icon-${size}`,`App icon · ${size} px`,'icons','dark',size,size,mark(size*.13,size*.13,size*.74,'url(#brand)'),C.navy,'icon');
  }
  const manifest={name:brand.name,direction:brand.direction,version:'2026-10-10',palette:C,wordmark:{font:word.font,outlined:true},sources:brand.sources,assets};
  fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  // Embedded data allows the page to work by double-click as well as over HTTP.
  fs.writeFileSync(path.join(root,'manifest.js'),'window.EASY1_BRAND = '+JSON.stringify(manifest)+';\n');
  console.log(`Created ${assets.length} assets in SVG and PNG (${assets.length*2} files).`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
