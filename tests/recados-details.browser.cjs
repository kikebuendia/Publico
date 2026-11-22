const {chromium} = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox']
  });
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/sync.js*', route => route.abort());
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.addInitScript(() => {
      if (localStorage.getItem('mi-dia-v1')) return;
      localStorage.setItem('mi-dia-v1', JSON.stringify({
        tasks: [{text: 'Pasar la ITV', done: false, nextStep: 'Pedir cita'}],
        people: [], travels: [], meals: '', shopping: '',
        features: {
          routines: [], records: {}, away: {}, packingUrl: '', remindChatGPT: false,
          personal: {procedures: [], savings: [], plans: [{id: 'ramo', name: 'Un ramo de flores', category: 'detalles'}]}
        }
      }));
    });
    await page.goto('http://127.0.0.1:8000/');

    const task = page.locator('#tasks > li').first();
    const checklist = task.locator('details');
    const summary = checklist.locator('summary');
    assert.match(await summary.innerText(), /0\/1/);
    assert.equal(await checklist.locator('form').isVisible(), false);
    await summary.click();
    await checklist.getByRole('textbox').fill('Preparar documentación');
    await checklist.getByRole('button', {name: 'Añadir paso', exact: true}).click();
    await checklist.getByRole('checkbox', {name: 'Pedir cita', exact: true}).check();
    assert.match(await summary.innerText(), /1\/2/);
    assert.match(await task.locator('.next-step').innerText(), /Preparar documentación/);

    await checklist.getByRole('button', {name: 'Editar paso Preparar documentación'}).click();
    await checklist.getByRole('textbox').fill('Revisar documentación');
    await checklist.getByRole('button', {name: 'Guardar paso', exact: true}).click();
    await task.getByRole('button', {name: 'Preparar con ChatGPT: Pasar la ITV'}).click();
    assert.equal(await page.locator('#help-step').inputValue(), 'Revisar documentación');
    await page.locator('#help-step').fill('Buscar ficha técnica');
    await page.locator('#help-save').click();
    await page.locator('#help-close').click();
    assert.match(await task.locator('.next-step').innerText(), /Buscar ficha técnica/);
    assert.equal(await checklist.getByRole('checkbox', {name: 'Pedir cita', exact: true}).isChecked(), true);
    await checklist.getByRole('checkbox', {name: 'Buscar ficha técnica', exact: true}).check();
    assert.match(await summary.innerText(), /2\/2/);
    assert.equal(await task.getByRole('checkbox', {name: 'Completar Pasar la ITV', exact: true}).isChecked(), false);
    await task.getByRole('checkbox', {name: 'Completar Pasar la ITV', exact: true}).check();

    const plans = page.getByRole('article', {name: 'Planes que me apetecen'});
    const details = page.getByRole('article', {name: 'Detalles', exact: true});
    assert.deepEqual(await plans.locator('h3').allTextContents(), ['Con mi mujer', 'Con mis amigos', 'Con mi familia']);
    const categories = ['Detalles a mi mujer', 'Detalles a mis padres', 'Detalles a mi hermano'];
    assert.deepEqual(await details.locator('h3').allTextContents(), categories);
    assert.match(await details.locator('section').first().innerText(), /Un ramo de flores/);
    assert.equal(await plans.getByText('Un ramo de flores').count(), 0);
    await details.getByRole('button', {name: 'Añadir detalle', exact: true}).click();
    assert.deepEqual(await page.locator('#personal-category option').allTextContents(), categories);
    await page.locator('#personal-name').fill('Imprimir una foto');
    await page.locator('#personal-category').selectOption({label: 'Detalles a mis padres'});
    await page.getByRole('button', {name: 'Guardar', exact: true}).click();

    await page.reload();
    assert.match(await summary.innerText(), /2\/2/);
    assert.equal(await task.getByRole('checkbox', {name: 'Completar Pasar la ITV', exact: true}).isChecked(), true);
    assert.match(await details.locator('section').nth(1).innerText(), /Imprimir una foto/);
    await summary.click();
    await checklist.getByRole('button', {name: 'Eliminar paso Buscar ficha técnica', exact: true}).click();
    assert.match(await summary.innerText(), /1\/1/);

    const backup = await page.evaluate(() => {
      const data = miDia.read();
      miDia.apply(data);
      return miDia.read();
    });
    assert.deepEqual(backup.tasks[0].steps, [{text: 'Pedir cita', done: true}]);
    assert.equal(backup.features.taskChecklists, true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log('PASS legacy next step, checklist editing and completion, backup, separate detail categories and mobile layout');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
