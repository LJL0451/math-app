from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1280,'height':800},accept_downloads=True); pg=ctx.new_page()
    pg.on('console',lambda m: m.type=='error' and errs.append(m.text)); pg.on('pageerror',lambda e: errs.append(str(e)))
    U='http://localhost:8765/'
    pg.goto(U); pg.wait_for_selector('.home')
    for r in ['topic/functions','topic/integrals','push/functions','push/integrals','train','path','placement']+[f'practice/{t}' for t in ['functions','integrals','quadratics','linear']]*4:
        pg.goto(U+'#'+r); pg.wait_for_timeout(250)
    pg.goto(U+'#practice/functions'); pg.wait_for_timeout(300)
    for i in range(6):
        pg.click('#self'); pg.click('#in'); pg.click('#next'); pg.wait_for_timeout(150)
    print('graph svg in L2 functions q:', pg.evaluate("Content.makeQuestion('functions',2,5).svg.includes('curve')"))
    pg.goto(U+'#settings'); pg.wait_for_selector('#exp')
    with pg.expect_download() as d: pg.click('#exp')
    path=d.value.path(); import json; data=json.load(open(path)); print('export keys:', list(data['kv'].keys()), 'srs items:', len(data['kv']['srs']))
    pg.on('dialog', lambda dl: dl.accept()); pg.click('#reset'); pg.wait_for_timeout(600)
    pg.goto(U+'#progress'); pg.wait_for_timeout(300); print('after reset:', pg.inner_text('main').split('\n')[0][:80])
    pg.goto(U+'#settings'); pg.wait_for_selector('#impf', state='attached')
    pg.set_input_files('#impf', path); pg.wait_for_timeout(1000)
    pg.goto(U+'#progress'); pg.wait_for_timeout(300); print('after import:', pg.inner_text('main').split('\n')[0][:80])
    pg.goto(U+'#train'); pg.wait_for_timeout(300); print('teach buttons:', pg.locator('#syms button').count())
    b.close()
print('errors:', errs)
