const fs = require('fs');

module.exports = {
    afterEach(browser, done) {
        // Only capture logs if the session is still active
        if (!browser.sessionId) {
            done();
            return;
        }
        browser.getLog('browser', function (logs) {
            if (logs && logs.length > 0) {
                const testName = browser.currentTest.name.replace(/\s+/g, '_');
                const logFile = `./logs/browser_console_${testName}.log`;
                const content = logs.map(l => `[${l.level}] ${l.message}`).join('\n');
                fs.appendFileSync(logFile, content + '\n');
            }
        });
        done();
    }
};
