import { getAuthToken } from './index';
getAuthToken().then(t => console.log('Token acquired:', t.substring(0, 10) + '...')).catch(console.error);
