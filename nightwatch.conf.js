/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team
*  See COPYING, COPYING.lesser, and README.md for full details
*/

module.exports = {
    "src_folders": ["tests"],
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
                        'window-size=2880,1800',
                        'disable-gpu','remote-debugging-port=9222'
                    ]
                }
            }
        }
    },
};




