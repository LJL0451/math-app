from playwright.sync_api import sync_playwright
import json
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1280,'height':800},device_scale_factor=2)
    pg=ctx.new_page()
    pg.on('console',lambda m: m.type in('error','warning') and errs.append(m.text))
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_selector('.home')
    for r in ['path','topic/fractions','topic/trig','progress','settings','train','review','push/geometry','placement','practice/derivatives','practice/trig','practice/geometry']:
        pg.goto('http://localhost:8765/#'+r); pg.wait_for_timeout(300)
    # practice: draw "4" with synthetic pen events into answer box
    pg.goto('http://localhost:8765/#practice/linear'); pg.wait_for_selector('#ac')
    def stroke(sel, pts, ptype='pen'):
        pg.evaluate("""([sel,pts,pt])=>{const c=document.querySelector(sel),r=c.getBoundingClientRect();
          const ev=(t,p,b)=>c.dispatchEvent(new PointerEvent(t,{pointerId:pt==='pen'?2:3,pointerType:pt,clientX:r.left+p[0],clientY:r.top+p[1],pressure:.6,buttons:b,bubbles:true,cancelable:true}));
          ev('pointerdown',pts[0],1);pts.slice(1).forEach(p=>ev('pointermove',p,1));ev('pointerup',pts[pts.length-1],0);}""",[sel,pts,ptype])
    lin=lambda a,b,n=12:[[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n] for i in range(n+1)]
    stroke('#ac', lin([80,20],[45,90])+lin([45,90],[115,90])[1:])
    stroke('#ac', lin([95,50],[95,130]))
    pg.wait_for_timeout(900)
    print('read:', pg.inner_text('#read'))
    # finger in working area should not ink
    stroke('#wc', lin([50,50],[200,300]), 'touch'); stroke('#wc', lin([50,50],[300,100]), 'pen')
    print('work strokes (expect 1):', pg.evaluate("document.querySelector('#wc').getContext('2d').getImageData(0,0,800,800).data.filter((v,i)=>i%4==3&&v>0).length>0"))
    pg.click('#check'); pg.wait_for_selector('.verdict'); print('verdict:', pg.inner_text('.verdict')[:40]); print('has solution katex:', pg.locator('.solution .katex').count()>0)
    pg.screenshot(path='/tmp/s_land.png')
    pg.click('#next'); pg.wait_for_timeout(300)
    # portrait dark
    pg.set_viewport_size({'width':800,'height':1280}); pg.evaluate("document.documentElement.dataset.theme='dark'"); pg.goto('http://localhost:8765/#practice/trig'); pg.wait_for_timeout(600); pg.screenshot(path='/tmp/s_port.png')
    pg.goto('http://localhost:8765/#topic/quadratics'); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/s_topic.png')
    # offline
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(1500)
    print('sw:', pg.evaluate("navigator.serviceWorker.controller?'controlled':'not yet'"))
    pg.reload(); pg.wait_for_timeout(1000)
    ctx.set_offline(True); pg.goto('http://localhost:8765/#topic/trig'); pg.wait_for_timeout(800)
    print('offline ok:', pg.locator('.prose .katex').count()>0)
    b.close()
print('errors:', json.dumps(errs, indent=1))
