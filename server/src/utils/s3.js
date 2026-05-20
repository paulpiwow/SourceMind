const fs = require("fs"); // reads local uploaded files before sending them to S3

const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} = require("@aws-sdk/client-s3"); // imports AWS S3 tools

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner"); // creates temporary secure S3 URLs

// Creates an S3 client using credentials and region from .env
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Uploads a local file to S3 and returns the S3 key
async function uploadFileToS3(filePath, originalFilename, userId) {
    const fileStream = fs.createReadStream(filePath);

    const s3Key = `documents/${userId}/${Date.now()}-${originalFilename}`;

    const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
        Body: fileStream,
        ContentType: "application/pdf",
    });

    await s3.send(command);

    return s3Key;
}

// Creates a temporary signed URL for viewing/downloading a private S3 file
async function getS3SignedUrl(s3Key) {
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
    });

    const signedUrl = await getSignedUrl(s3, command, {
        expiresIn: 60 * 5,
    });

    return signedUrl;
}

// Deletes a file from S3 using its S3 key
async function deleteFileFromS3(s3Key) {
    const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
    });

    await s3.send(command);
}

module.exports = {
    uploadFileToS3,
    getS3SignedUrl,
    deleteFileFromS3,
};