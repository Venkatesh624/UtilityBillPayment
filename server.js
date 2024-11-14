const express = require('express');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const jsonfile = require('jsonfile');

const app = express();
app.use(express.json());

const logFilePath = './logs/daily_log.json';

class PriorityQueue {
  constructor() { this.items = []; }
  enqueue(item, priority) {
    const newItem = { item, priority };
    const index = this.items.findIndex(i => i.priority < priority);
    index === -1 ? this.items.push(newItem) : this.items.splice(index, 0, newItem);
  }
  dequeue() { return this.items.shift(); }
  isEmpty() { return this.items.length === 0; }
}

class Stack {
  constructor() {
    this.items = [];
  }
  push(item) {
    this.items.push(item);
  }
  pop() {
    return this.items.pop();
  }
  peek() {
    return this.items[this.items.length - 1];
  }
  isEmpty() {
    return this.items.length === 0;
  }
  getItems() {
    return this.items;
  }
}

const paymentQueue = [];
const priorityQueue = new PriorityQueue();
const transactionStack = new Stack();

async function processPayments() {
  while (!priorityQueue.isEmpty() || paymentQueue.length > 0) {
    const transaction = !priorityQueue.isEmpty() ? priorityQueue.dequeue() : paymentQueue.shift();
    await generateInvoice(transaction);
    transactionStack.push(transaction);
    logTransaction(transaction);
  }
}

app.post('/pay-bill', async (req, res) => {
  const transaction = { id: Date.now(), ...req.body, timestamp: new Date(), type: 'standard' };
  paymentQueue.push(transaction);
  await processPayments();
  res.send("Bill payment request received and processed.");
});

app.post('/priority-request', async (req, res) => {
  const transaction = { id: Date.now(), ...req.body, timestamp: new Date(), type: 'priority' };
  priorityQueue.enqueue(transaction, 1);
  await processPayments();
  res.send("Priority bill payment request received and processed.");
});

app.get('/transactions', (req, res) => {
  res.json(transactionStack.getItems());
});

app.post('/undo-transaction', (req, res) => {
  if (transactionStack.isEmpty()) {
    return res.status(400).send("No transactions to undo.");
  }
  const lastTransaction = transactionStack.pop();
  res.send(`Transaction ${lastTransaction.id} has been undone.`);
});

const issueReports = [];

app.post('/report-issue', (req, res) => {
  const { userId, issueType, description, urgency, reportedAt } = req.body;
  const issueId = Date.now();
  const newIssue = { issueId, userId, issueType, description, urgency, reportedAt };
  issueReports.push(newIssue);
  
  res.json({
    message: "Your issue has been reported successfully. Our team will review it shortly.",
    status: "success",
    issueId: issueId
  });
});

const invoicesDir = path.join(__dirname, 'invoices');

async function generateInvoice(transaction) {
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir);  // Ensure invoices directory exists
  }

  const csvWriter = createObjectCsvWriter({
    path: path.join(invoicesDir, `invoice-${transaction.id}.csv`),
    header: [
      { id: 'id', title: 'ID' },
      { id: 'type', title: 'Type' },
      { id: 'amount', title: 'Amount' },
      { id: 'timestamp', title: 'Timestamp' },
      { id: 'details', title: 'Details' }
    ]
  });
  await csvWriter.writeRecords([transaction]);
}

app.get('/download-invoice/:id', (req, res) => {
  const transactionId = req.params.id;
  const invoicePath = path.join(invoicesDir, `invoice-${transactionId}.csv`);
  
  fs.exists(invoicePath, (exists) => {
    if (exists) {
      res.download(invoicePath, `invoice-${transactionId}.csv`, (err) => {
        if (err) {
          console.error('Error while downloading the file:', err);
          res.status(500).send('Error in downloading the file');
        }
      });
    } else {
      res.status(404).send('Invoice not found');
    }
  });
});



function logTransaction(transaction) {
  const logDir = path.join(__dirname, 'logs');

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }

  const logData = {
    transactionId: transaction.id,
    date: transaction.timestamp,
    amount: transaction.amount,
    type: transaction.type
  };

  jsonfile.readFile(logFilePath, (err, data) => {
    if (err && err.code === 'ENOENT') {
      jsonfile.writeFile(logFilePath, [logData], { spaces: 2 });
    } else if (!err) {
      data.push(logData);
      jsonfile.writeFile(logFilePath, data, { spaces: 2 });
    }
  });
}

const PORT = 3000;
app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
