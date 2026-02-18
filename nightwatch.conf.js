/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team
*  See COPYING, COPYING.lesser, and README.md for full details
*/

module.exports = {
    src_folders: ['tests'],
    page_objects_path: [],
    custom_commands_path: [],
    custom_assertions_path: [],
    globals_path: 'tests/globals.js',

    webdriver: {
        start_process: true,
        server_path: require('chromedriver').path,
        port: 4444,
        cli_args: []
    },

    test_settings: {
        default: {
            disable_error_log: false,
            detailed_output: true,
            output_timestamp: true,
            launch_url: 'http://localhost:8124/atompm',
            screenshots: {
                enabled: true,
                path: 'screenshots',
                on_failure: true
            },
            desiredCapabilities: {
                browserName: 'chrome',
                chromeOptions: {
                    binary: process.env.CHROME_PATH || undefined,
                    args: ['disable-gpu', 'remote-debugging-port=9222']
                },
                'goog:chromeOptions': {
                    binary: process.env.CHROME_PATH || undefined,
                    args: ['disable-gpu', 'remote-debugging-port=9222']
                }
            }
        },

        run_headless: {
            extends: 'default',
            desiredCapabilities: {
                browserName: 'chrome',
                'goog:chromeOptions': {
                    args: [
                        'headless',
                        'window-size=1920,1080',
                        'disable-gpu',
                        'remote-debugging-port=9222',
                        'no-sandbox',
                        'disable-dev-shm-usage'
                    ]
                }
            }
        }
    }
};




