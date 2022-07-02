/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team
*  See COPYING, COPYING.lesser, and README.md for full details
*/

module.exports = {
    "src_folders": ["tests"],
    // skip_testcases_on_fail: true,
    screenshots: {
        enabled: true,
        path: "./screenshots",
        on_failure: true,
        on_error: true
    },
    webdriver: {
        start_process: true,
        port: 4444,
        server_path: require('chromedriver').path,
        cli_args: [
            // very verbose logs
            // '-vv'
        ]
    },

    test_settings: {
        default: {
            launch_url: 'http://localhost:8124/atompm',
            desiredCapabilities: {
                browserName: 'chrome',
                'goog:chromeOptions': {
                    'args':[
                        'disable-gpu','remote-debugging-port=9222'
                    ]
                }
            }
        },
        run_headless: {
            launch_url: 'http://localhost:8124/atompm',
            desiredCapabilities: {
                browserName: 'chrome',
                'goog:chromeOptions': {
                    'args':[
                        'headless',
                        // 'window-size=2880,1800',
                        'window-size=1920,1080',
                        // "no-sandbox",
                        'disable-gpu','remote-debugging-port=9222'
                    ]
                }
            }
        }
    },
};




