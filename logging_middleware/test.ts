import { Log } from './index';

async function testLogging() {
    try {
        console.log('Sending test log...');
        const result = await Log('backend', 'info', 'middleware', 'App started and initialized.');
        console.log('Log Success:', result);
    } catch(e) {
        console.error('Test failed.');
    }
}
testLogging();
