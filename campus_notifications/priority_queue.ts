import axios from 'axios';
import { getAuthToken } from '../auth/index';
import { Log } from '../logging_middleware/index';

type NotificationType = 'Placement' | 'Result' | 'Event';

interface Notification {
    ID: string;
    Type: NotificationType;
    Message: string;
    Timestamp: string;
}

// Priority values: Placement = 3, Result = 2, Event = 1
const TYPE_WEIGHT: Record<NotificationType, number> = {
    'Placement': 3,
    'Result': 2,
    'Event': 1
};

// Priority Queue (Min-Heap) implementation to keep Top K notifications
class TopKNotificationsHeap {
    private heap: Notification[];
    private k: number;

    constructor(k: number) {
        this.k = k;
        this.heap = [];
    }

    private compare(a: Notification, b: Notification): number {
        const weightA = TYPE_WEIGHT[a.Type] || 0;
        const weightB = TYPE_WEIGHT[b.Type] || 0;

        if (weightA !== weightB) {
            return weightA - weightB; // Lower weight is "smaller"
        }

        // Output of Date.parse is milliseconds since epoch
        const timeA = new Date(a.Timestamp.replace(' ', 'T') + 'Z').getTime();
        const timeB = new Date(b.Timestamp.replace(' ', 'T') + 'Z').getTime();

        return timeA - timeB; // Older time is "smaller"
    }

    private pushUp(index: number) {
        let parent = Math.floor((index - 1) / 2);
        while (index > 0 && this.compare(this.heap[index], this.heap[parent]) < 0) {
            const temp = this.heap[index];
            this.heap[index] = this.heap[parent];
            this.heap[parent] = temp;
            index = parent;
            parent = Math.floor((index - 1) / 2);
        }
    }

    private pushDown(index: number) {
        const length = this.heap.length;
        let smallest = index;

        while (true) {
            const left = 2 * index + 1;
            const right = 2 * index + 2;

            if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
                smallest = left;
            }
            if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
                smallest = right;
            }

            if (smallest !== index) {
                const temp = this.heap[index];
                this.heap[index] = this.heap[smallest];
                this.heap[smallest] = temp;
                index = smallest;
            } else {
                break;
            }
        }
    }

    public push(notification: Notification) {
        if (this.heap.length < this.k) {
            this.heap.push(notification);
            this.pushUp(this.heap.length - 1);
        } else if (this.compare(notification, this.heap[0]) > 0) {
            // New notification is more important than the smallest in the heap
            this.heap[0] = notification;
            this.pushDown(0);
        }
    }

    public getSortedTopK(): Notification[] {
        // Sort descending locally to return the most important first
        return [...this.heap].sort((a, b) => this.compare(b, a));
    }
}

async function runPriorityInbox() {
    try {
        const token = await getAuthToken();
        await Log('backend', 'info', 'service', 'Fetching notifications for Priority Inbox');

        const response = await axios.get('http://20.207.122.201/evaluation-service/notifications', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const notifications: Notification[] = response.data.notifications || response.data;
        console.log(`Received ${notifications.length} notifications entirely in memory.`);

        // Maintain top 10 using O(K) space complexity (excluding the massive fetch array)
        const K = 10;
        const pq = new TopKNotificationsHeap(K);

        for (const notif of notifications) {
            pq.push(notif);
        }

        const top10 = pq.getSortedTopK();
        console.log(`\n=== TOP ${K} PRIORITY INBOX ===`);
        top10.forEach((notif, i) => {
            console.log(`[${i + 1}] [${notif.Type}] ${notif.Message} (${notif.Timestamp})`);
        });

        await Log('backend', 'info', 'service', 'Priority Inbox computed successfully');

    } catch (e: any) {
        if (e.response) {
            console.error('Error fetching notifications:', e.response.status, e.response.data);
            await Log('backend', 'error', 'service', 'err fetching notifs ' + e.response.status);
        } else {
            console.error('Error:', e.message);
        }
    }
}

runPriorityInbox();
