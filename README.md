# Smart Wait
Advanced promise-based timeout and retry utilities for Node.js

## Features
- Cancellable timeouts
- Retry with exponential backoff
- Dynamic timeout updates
- Automatic cleanup

## Installation
```bash
npm install smart-wait
```

## Usage
```javascript

import { waitWithRetry, cancelWait } from 'smart-wait';

// Retry API calls
const data = await waitWithRetry(
  async () => {
    const res = await fetch('https://api.example.com');
    return res.json();
  },
  { retries: 3, delay: 1000, backoff: 'exponential' }
);

// Cancellable timeout
const { id, promise } = waitWithId(5000);
cancelWait(id); // Cancel before completion

```

## License
ISC