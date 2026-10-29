const mode=new URLSearchParams(location.search).get('view')==='projects'?'projects':'editorial';
document.body.classList.toggle('projects-view',mode==='projects');
const comparison=document.getElementById(mode==='projects'?'option-b':'option-a');
if(comparison)comparison.setAttribute('aria-current','page');
const content={
  adawatch:{title:'AdaWatch',copy:'A Telegram and Discord bot built by Giovanni, under EASY1. Follow wallets, DeFi positions and NFT activity from chat. Its independent website explains the bot and how to get started.',url:'https://adawatchbot.xyz',label:'Visit AdaWatch ↗'},
  adamatic:{title:'AdaMatic',copy:'Payment automation built by Giovanni, under EASY1. HOSKY auto-pulls are available today. Recurring ADA payments remain on the roadmap, as stated on the captured product site.',url:'https://adamatic.xyz',label:'Visit AdaMatic ↗'},
  'uplc-link':{title:'UPLC Link',copy:'A Cardano smart contract verification tool built by Giovanni, under EASY1. Compare Aiken source code against on-chain scripts and browse verified contracts.',url:'https://uplc.link',label:'Visit UPLC Link ↗'},
  'cardano-dev-skills':{title:'Cardano Dev Skills',copy:'I started Cardano Dev Skills and handed it over to the Cardano Foundation. It brings together developer workflows, bundled documentation and project context for AI coding agents, including Claude Code and Codex. It remains an important part of the work that began with EASY1.',url:'https://cardano-foundation.github.io/cardano-dev-skills/',label:'Visit Cardano Dev Skills ↗'},
  pool:{title:'Stake with EASY1',copy:'The approved /pool page will bring together pool facts, wallet connection and stake delegation to EASY1. Delegation must preserve the visitor’s existing voting delegation. This visual preview does not connect wallets or create transactions.'},
  about:{title:'Giovanni, behind EASY1',copy:'The approved /about page will connect the journey from a staking platform in 2020 to Cardano software and smart contract development. The final portrait and biography remain to be selected.'}
};
const dialog=document.getElementById('preview-dialog');
document.querySelectorAll('[data-preview]').forEach(a=>a.addEventListener('click',event=>{
  event.preventDefault();const item=content[a.dataset.preview];
  document.getElementById('dialog-title').textContent=item.title;
  document.getElementById('dialog-copy').textContent=item.copy;
  const link=document.getElementById('dialog-link');link.hidden=!item.url;
  if(item.url){link.href=item.url;link.textContent=item.label;}else{link.removeAttribute('href');link.textContent='';}
  dialog.showModal();
  document.querySelectorAll('.mobile-menu[open]').forEach(menu=>menu.open=false);
}));
document.getElementById('close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
document.querySelectorAll('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>a.closest('details').open=false));
