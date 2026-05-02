import axios from 'axios';
import { getAuthToken } from '../auth/index';

export type LogStack = 'backend' | 'frontend';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogPackage = 
  | 'cache' | 'controller' | 'cron_job' | 'db' | 'domain' | 'handler' 
  | 'repository' | 'route' | 'service' | 'api' | 'component' | 'hook' 
  | 'page' | 'state' | 'style' | 'auth' | 'config' | 'middleware' | 'utils';

export async function Log(stack: LogStack, level: LogLevel, pkg: LogPackage, message: string) {
    try {
        const token = await getAuthToken();
        const response = await axios.post('http://20.207.122.201/evaluation-service/logs', {
            stack: stack,
            level: level,
            package: pkg,
            message: message
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error: any) {
        if (error.response) {
            console.error('Logging Middleware Error Response:', error.response.data);
        } else {
            console.error('Logging Middleware Error:', error.message);
        }
        throw error;
    }
}
