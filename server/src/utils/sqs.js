const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs"); // imports AWS SQS tools

// Creates an SQS client using AWS credentials from .env
const sqs = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Sends a document processing job to the SQS queue
async function sendDocumentJob(jobData) {
  const command = new SendMessageCommand({
    QueueUrl: process.env.AWS_SQS_QUEUE_URL,
    MessageBody: JSON.stringify(jobData),
  });

  await sqs.send(command);
}

module.exports = {
  sendDocumentJob,
};