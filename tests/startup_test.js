module.exports = {

  beforeEach : function (browser) {
    browser.url('http://localhost:8124/atompm').pause(300);
  },

  'Test Startup' : function (client) {

    client.getTitle(function(title) {
      this.assert.ok(title.includes("AToMPM"), "Title is AToMPM");
    });


  },

  after : function (browser) {
    browser.end();
  },

};