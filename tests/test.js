const { expect } = require('chai');
const axios = require('axios');

describe('gulp-memory-fs', function() {
  it('should get file', async function() {
    const res0 = await axios.get('http://127.0.0.1:7777/index.html');
    const res1 = await axios.get('http://127.0.0.1:7777/js/index.js');
    const res2 = await axios.get('http://127.0.0.1:7777/js/watch.js');

    expect(res0.status).to.be.equal(200);
    expect(res1.status).to.be.equal(200);
    expect(res2.status).to.be.equal(200);
  });
});