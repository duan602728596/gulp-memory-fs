import test from 'node:test';
import assert from 'node:assert/strict';

const basePath = 'http://127.0.0.1:7777';

test.describe('gulp-memory-fs test', function() {
  test.describe('request static files test', function() {
    test.it('should get files and response status is 200', async function() {
      const res0 = await fetch(`${ basePath }/index.html`);
      const res1 = await fetch(`${ basePath }/js/index.js`);
      const res2 = await fetch(`${ basePath }/js/watch.js`);

      assert.deepStrictEqual(res0.status, 200);
      assert.deepStrictEqual(res1.status, 200);
      assert.deepStrictEqual(res2.status, 200);
    });
  });

  test.describe('mock data test', function() {
    test.it('should get mock data and return the correct value', async function() {
      const res0 = await fetch(`${ basePath }/mock/0`);
      const res1 = await fetch(`${ basePath }/mock/1`);
      const res2 = await fetch(`${ basePath }/mock/2`);
      const res3 = await fetch(`${ basePath }/mock/3`, { method: 'POST' });
      const res4 = await fetch(`${ basePath }/mock/4`);

      assert.deepStrictEqual(await res0.json(), [0, 1, 2, 3]);
      assert.deepStrictEqual(await res1.json(), { name: 'test', value: 12 });
      assert.deepStrictEqual(await res2.text(), 'Hello, world.');
      assert.deepStrictEqual(await res3.json(), [{ name: 'test', value: 22 }]);
      assert.deepStrictEqual(await res4.json(), { name: 'test', value: 32 });
    });
  });

  test.describe('proxy data test', function() {
    test.it('should get mock data and return the correct value', async function() {
      const res0 = await fetch(`${ basePath }/proxy/raw/githubusercontent/duan602728596/gulp-memory-fs/master/package.json`);

      assert.deepStrictEqual((await res0.json()).name, 'gulp-memory-fs');
    });
  });
});