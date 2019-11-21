const { expect } = require('chai');
const axios = require('axios');

const basePath = 'http://127.0.0.1:7777';

describe('gulp-memory-fs test', function() {
  describe('request static files test', function() {
    it('should get files and response status is 200', async function() {
      const res0 = await axios.get(`${ basePath }/index.html`);
      const res1 = await axios.get(`${ basePath }/js/index.js`);
      const res2 = await axios.get(`${ basePath }/js/watch.js`);

      expect(res0.status).to.be.equal(200);
      expect(res1.status).to.be.equal(200);
      expect(res2.status).to.be.equal(200);
    });
  });

  describe('mock data test', function() {
    it('should get mock data and return the correct value', async function() {
      const res0 = await axios.get(`${ basePath }/mock/0`);
      const res1 = await axios.get(`${ basePath }/mock/1`);
      const res2 = await axios.get(`${ basePath }/mock/2`);
      const res3 = await axios.post(`${ basePath }/mock/3`);
      const res4 = await axios.get(`${ basePath }/mock/4`);

      expect(res0.data).to.be.eql([0, 1, 2, 3]);
      expect(res1.data).to.be.eql({ name: 'test', value: 12 });
      expect(res2.data).to.be.equal('Hello, world.');
      expect(res3.data).to.be.eql([{ name: 'test', value: 22 }]);
      expect(res4.data).to.be.eql({ name: 'test', value: 32 });
    });
  });
});