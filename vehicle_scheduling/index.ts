import axios from 'axios';
import { getAuthToken } from '../auth/index';
import { Log } from '../logging_middleware/index';

type Depot = { ID: number; MechanicHours: number };
type Vehicle = { TaskID: string; Duration: number; Impact: number };

async function solve() {
    try {
        const token = await getAuthToken();
        
        await Log('backend', 'info', 'service', 'Fetching depots and vehicles data.');
        
        const depotsRes = await axios.get('http://20.207.122.201/evaluation-service/depots', { headers: { 'Authorization': `Bearer ${token}` } });
        const vehiclesRes = await axios.get('http://20.207.122.201/evaluation-service/vehicles', { headers: { 'Authorization': `Bearer ${token}` } });

        const depots: Depot[] = depotsRes.data.depots || depotsRes.data;
        const vehicles: Vehicle[] = vehiclesRes.data.vehicles || vehiclesRes.data;

        // Ensure depots is extracted properly
        let totalBudget = 0;
        const depList = Array.isArray(depots) ? depots : (depotsRes.data.depots || []);
        depList.forEach((d: any) => { totalBudget += d.MechanicHours; });

        const vehList: Vehicle[] = Array.isArray(vehicles) ? vehicles : (vehiclesRes.data.vehicles || []);

        console.log(`Total Budget: ${totalBudget} hours`);
        console.log(`Total Vehicles: ${vehList.length}`);
        
        // 0/1 Knapsack DP where items are vehicles, weights are duration, values are impact
        const N = vehList.length;
        const W = totalBudget;
        
        // dp[i][w] = max impact using first i items and capacity w
        // for path reconstruction, we can store a 2D array or just traceback
        const dp = Array.from({ length: N + 1 }, () => new Float64Array(W + 1).fill(0));
        
        for (let i = 1; i <= N; i++) {
            const v = vehList[i - 1];
            const weight = v.Duration;
            const value = v.Impact;
            for (let w = 0; w <= W; w++) {
                if (weight <= w) {
                    dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - weight] + value);
                } else {
                    dp[i][w] = dp[i - 1][w];
                }
            }
        }
        
        console.log(`Max Impact Score: ${dp[N][W]}`);
        
        // Traceback to find selected TaskIDs
        const selectedTasks: string[] = [];
        let currW = W;
        for (let i = N; i > 0 && currW > 0; i--) {
            if (dp[i][currW] !== dp[i - 1][currW]) {
                // Item i-1 was included
                selectedTasks.push(vehList[i - 1].TaskID);
                currW -= vehList[i - 1].Duration;
            }
        }
        
        console.log('Selected TaskIDs:', JSON.stringify(selectedTasks, null, 2));
        
        await Log('backend', 'info', 'service', 'Scheduler executed successfully.');

    } catch (e: any) {
        if (e.response) {
            console.error('Error fetching data:', e.response.status, e.response.data);
            await Log('backend', 'error', 'service', 'err fetching data ' + e.response.status);
        } else {
            console.error('Error:', e.message);
        }
    }
}

solve();
