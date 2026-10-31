import "server-only";

function retirementPage(name: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name} retired | EASY1</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f6f5f1; color: #0b1220; font: 1.125rem/1.65 system-ui, sans-serif; }
    header, main { width: min(100% - 3rem, 48rem); margin-inline: auto; }
    header { padding-block: 2rem; }
    header a { color: #0b1220; font-weight: 700; text-decoration: none; }
    main { padding-block: clamp(2rem, 8vw, 6rem); }
    h1 { font-size: clamp(2rem, 6vw, 3.5rem); line-height: 1.15; overflow-wrap: break-word; }
    p { max-width: 38rem; }
    a { color: #4338b8; text-underline-offset: .2em; }
    a:focus-visible { outline: 3px solid #4338b8; outline-offset: 6px; }
  </style>
</head>
<body>
  <header><a href="/" aria-label="EASY1 home">EASY1</a></header>
  <main>
    <p>Page retired · 410</p>
    <h1>${name} has retired</h1>
    <p>This tool is no longer available. EASY1 now brings together Giovanni's Cardano projects and stake pool.</p>
    <p><a href="/pool">Visit the EASY1 Pool</a> for pool information and the current delegation availability.</p>
  </main>
</body>
</html>`;
}


function retiredResponse(body: string, contentType: string, head: boolean) {
  return new Response(head ? null : body, {
    status: 410,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}

export function retiredApiResponse(head = false) {
  return retiredResponse('{"error":"retired"}', "application/json", head);
}

export function retiredPageResponse(name: string, head = false) {
  return retiredResponse(retirementPage(name), "text/html; charset=utf-8", head);
}
